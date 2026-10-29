import { mkdtemp, writeFile, readFile, stat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { Schema } from "effect";
import { workflowInstructions } from "./skills/core.ts";
import { execute } from "../analysis/codex.ts";
import type { RunMetadata } from "@applyatease/contracts/workflow";
let active = 0;
export async function runSkill<
  S extends Schema.Top & Schema.ConstraintDecoder<unknown>,
>(
  schema: S,
  operation: string,
  input: unknown,
  profileVersion = "",
  sourceHashes: readonly string[] = [],
  search = false,
  signal?: AbortSignal,
): Promise<{ result: S["Type"]; run: RunMetadata }> {
  if (active >= 2)
    throw new Error(
      "Two workflow operations are already running. Retry after one finishes.",
    );
  active++;
  let directory: string | undefined;
  try {
    directory = await mkdtemp(join(tmpdir(), "applyatease-workflow-"));
    const skill = workflowInstructions;
    const document = Schema.toJsonSchemaDocument(schema);
    const strict = JSON.parse(
      JSON.stringify(document.schema),
      (_key, value: unknown) =>
        value &&
        typeof value === "object" &&
        "type" in value &&
        value.type === "object"
          ? { ...value, additionalProperties: false }
          : value,
    );
    const path = join(directory, "schema.json");
    await writeFile(path, JSON.stringify(strict), { mode: 0o600 });
    const started = Date.now();
    const lastMessage = join(directory, "result.json");
    const response = await execute(
      [
        "exec",
        "--json",
        "--output-last-message",
        lastMessage,
        "--ignore-user-config",
        "--ephemeral",
        "--skip-git-repo-check",
        "--sandbox",
        "read-only",
        "--color",
        "never",
        "--output-schema",
        path,
        "-c",
        'approval_policy="never"',
        "-c",
        "features.shell_tool=false",
        "-c",
        "agents.enabled=false",
        "-c",
        "features.multi_agent=false",
        "-c",
        "features.plugins=false",
        "-c",
        "features.remote_plugin=false",
        "-c",
        "features.memories=false",
        "-c",
        "features.apps=false",
        "-c",
        `web_search="${search ? "live" : "disabled"}"`,
        "-c",
        "project_doc_max_bytes=0",
        "-c",
        'history.persistence="none"',
        ...(process.env.CODEX_ANALYSIS_MODEL
          ? ["--model", process.env.CODEX_ANALYSIS_MODEL]
          : []),
        "-",
      ],
      directory,
      `${skill}\nOperation: ${operation}\n${search ? "Use live web search only to find actual employer posting URLs. No other tools. Return leads, not verified jobs." : "No tools, files, browsing or external actions. Reason only over the supplied evidence."}\nINPUT JSON:\n${JSON.stringify(input)}`,
      240000,
      signal,
    );
    let result: S["Type"];
    try {
      if ((await stat(lastMessage)).size > 2000000)
        throw new Error("Model output exceeded its limit.");
      result = Schema.decodeUnknownSync(schema)(
        JSON.parse(await readFile(lastMessage, "utf8")),
      );
    } catch {
      throw new Error(
        "The model result did not match the workflow contract. Retry this operation; saved evidence is preserved.",
      );
    }
    const eventSchema = Schema.Struct({
      type: Schema.String,
      item: Schema.optionalKey(
        Schema.Struct({
          type: Schema.String,
          query: Schema.optionalKey(Schema.String),
          results: Schema.optionalKey(
            Schema.Array(
              Schema.Struct({ url: Schema.optionalKey(Schema.String) }),
            ),
          ),
        }),
      ),
      usage: Schema.optionalKey(
        Schema.Struct({
          input_tokens: Schema.Finite,
          output_tokens: Schema.Finite,
        }),
      ),
    });
    const events = response.stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => Schema.decodeUnknownSync(eventSchema)(JSON.parse(line)));
    const usage = events.findLast(
      (event) => event.type === "turn.completed",
    )?.usage;
    const searchEvidence = events
      .filter(
        (event) =>
          event.type === "item.completed" && event.item?.type === "web_search",
      )
      .slice(0, 20)
      .map((event) => ({
        query: event.item?.query ?? "",
        urls: (event.item?.results ?? [])
          .flatMap((result) => (result.url ? [result.url] : []))
          .slice(0, 20),
      }));
    const model =
      process.env.CODEX_ANALYSIS_MODEL ||
      "Configured model (identity not reported by event protocol)";
    return {
      result,
      run: {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        model,
        skillVersion: "evidence-workflow-v1",
        skillHash: createHash("sha256")
          .update(JSON.stringify([skill, operation, strict]))
          .digest("hex"),
        operation,
        validationAttempts: 1,
        elapsedMs: Date.now() - started,
        tokensUsed: usage ? usage.input_tokens + usage.output_tokens : null,
        searchObserved: searchEvidence.length > 0,
        searchEvidence,
        profileVersion,
        sourceHashes,
      },
    };
  } finally {
    active--;
    if (directory) await rm(directory, { recursive: true, force: true });
  }
}

export async function runValidatedSkill<
  S extends Schema.Top & Schema.ConstraintDecoder<unknown>,
>(
  schema: S,
  operation: string,
  input: unknown,
  profileVersion: string,
  sourceHashes: readonly string[],
  search: boolean,
  signal: AbortSignal | undefined,
  validate: (response: { result: S["Type"]; run: RunMetadata }) => void,
) {
  const first = await runSkill(
    schema,
    operation,
    input,
    profileVersion,
    sourceHashes,
    search,
    signal,
  );
  try {
    validate(first);
    return first;
  } catch (error) {
    const feedback =
      error instanceof Error ? error.message : "Source validation failed.";
    const repaired = await runSkill(
      schema,
      operation +
        " Repair one rejected result: " +
        feedback +
        " Re-evaluate against original evidence. CV citation section MUST exactly equal a supplied profile.source.sections[].label, never append an inferred subsection. Cite only source names actually supplied: job for job.text, form only for form.text. Quotes must be short exact contiguous spans; never paraphrase, combine spans, insert ellipses or change punctuation. Remove unsupported assertions rather than invent evidence.",
      input,
      profileVersion,
      sourceHashes,
      search,
      signal,
    );
    validate(repaired);
    return {
      ...repaired,
      run: {
        ...repaired.run,
        validationAttempts: 2,
        elapsedMs: first.run.elapsedMs + repaired.run.elapsedMs,
        tokensUsed:
          first.run.tokensUsed === null || repaired.run.tokensUsed === null
            ? null
            : first.run.tokensUsed + repaired.run.tokensUsed,
        searchObserved: first.run.searchObserved || repaired.run.searchObserved,
        searchEvidence: [
          ...first.run.searchEvidence,
          ...repaired.run.searchEvidence,
        ],
      },
    };
  }
}
