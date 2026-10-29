import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";
import { createHash, randomUUID } from "node:crypto";
import type { SourceCapture } from "@applyatease/contracts/workflow";

export function publicAddress(address: string): boolean {
  if (address.includes(":")) {
    const a = address.toLowerCase();
    if (!/^[23]/.test(a) || a.startsWith("2002:") || a.startsWith("2001:0:"))
      return false;
    return (
      !a.startsWith("::") &&
      !a.startsWith("fc") &&
      !a.startsWith("fd") &&
      !a.startsWith("fe") &&
      !a.startsWith("ff") &&
      !a.startsWith("2001:db8")
    );
  }
  const n = address.split(".").map(Number);
  const a = n[0]!,
    b = n[1]!;
  return (
    n.length === 4 &&
    ![0, 10, 127].includes(a) &&
    a < 224 &&
    !(a === 169 && b === 254) &&
    !(a === 172 && b >= 16 && b <= 31) &&
    !(a === 192 && (b === 168 || b === 0 || b === 2)) &&
    !(a === 100 && b >= 64 && b <= 127) &&
    !(a === 198 && (b === 18 || b === 19 || b === 51)) &&
    !(a === 203 && b === 0)
  );
}
export function normalizeUrl(raw: string) {
  const url = new URL(raw);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    isIP(url.hostname.replace(/^\[|\]$/g, ""))
  )
    throw new Error(
      "Use a public HTTPS employer URL without credentials or an IP address.",
    );
  url.hash = "";
  for (const key of [...url.searchParams.keys()])
    if (/^(utm_|gclid$|fbclid$|gh_src$)/i.test(key))
      url.searchParams.delete(key);
  return url;
}
function readUrl(
  url: URL,
  signal?: AbortSignal,
): Promise<{
  bytes: Buffer;
  status: number;
  location: string;
  contentType: string;
}> {
  let dnsDeadline: ReturnType<typeof setTimeout>;
  const dns = Promise.race([
    lookup(url.hostname, { all: true }),
    new Promise<never>((_resolve, reject) => {
      dnsDeadline = setTimeout(
        () => reject(new Error("Source DNS lookup timed out.")),
        5000,
      );
    }),
  ]).finally(() => clearTimeout(dnsDeadline));
  return dns.then((addresses) => {
    if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
      throw new Error("The source resolves to a non-public network address.");
    const address = addresses[0]!;
    return new Promise((resolve, reject) => {
      const req = request(
        url,
        {
          method: "GET",
          family: address.family,
          signal,
          headers: {
            "user-agent": "ApplyAtEase/0.1 (read-only source inspection)",
            accept: "text/html,application/json,text/plain",
          },
          lookup: (_host, _options, callback) =>
            callback(null, address.address, address.family),
        },
        (res) => {
          const chunks: Buffer[] = [];
          let size = 0;
          res.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > 1500000) {
              req.destroy(new Error("Source exceeds the inspection limit."));
              return;
            }
            chunks.push(chunk);
          });
          res.on("end", () =>
            resolve({
              bytes: Buffer.concat(chunks),
              status: res.statusCode ?? 0,
              location: res.headers.location ?? "",
              contentType: res.headers["content-type"] ?? "",
            }),
          );
          res.on("error", reject);
        },
      );
      const deadline = setTimeout(
        () =>
          req.destroy(
            new Error("Source inspection exceeded its total deadline."),
          ),
        20000,
      );
      req.on("close", () => clearTimeout(deadline));
      req.setTimeout(15000, () =>
        req.destroy(new Error("Source inspection timed out.")),
      );
      req.on("error", reject);
      req.end();
    });
  });
}
export function extractText(html: string) {
  const metadata = [
    ...[
      ...html.matchAll(
        /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
      ),
    ].map((m) => m[1] ?? ""),
    ...[
      ...html.matchAll(
        /<(?:input|textarea|select|option|label|form|a)\b[^>]*>/gi,
      ),
    ].map((m) => m[0]),
  ]
    .join("\n")
    .slice(0, 60000);
  return (
    html
      .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim() +
    (metadata
      ? "\nSTATIC SOURCE METADATA (untrusted markup, not rendered interaction):\n" +
        metadata
      : "")
  );
}
const captures = new Map<string, SourceCapture>();
let activeFetches = 0;
export function verifyCapture(source: SourceCapture) {
  const stored = captures.get(source.id);
  if (!stored || JSON.stringify(stored) !== JSON.stringify(source))
    throw new Error(
      "Refresh this source: its capture could not be verified by this service session.",
    );
}
function remember(source: SourceCapture) {
  if (captures.size >= 200) captures.delete(captures.keys().next().value!);
  captures.set(source.id, source);
  return source;
}
export async function captureSource(
  raw: string,
  signal?: AbortSignal,
): Promise<SourceCapture> {
  const original = normalizeUrl(raw).href;
  if (activeFetches >= 4)
    throw new Error(
      "Four source inspections are already running. Retry after one finishes.",
    );
  activeFetches++;
  let url = new URL(original);
  const base = {
    id: randomUUID(),
    originalUrl: original,
    finalUrl: original,
    canonicalUrl: original,
    retrievedAt: new Date().toISOString(),
    hash: "",
    text: "",
    status: "inaccessible" as const,
    httpStatus: 0,
    limitations: [] as string[],
  };
  try {
    for (let redirects = 0; redirects < 4; redirects++) {
      const response = await readUrl(url, signal);
      if (
        response.status >= 300 &&
        response.status < 400 &&
        response.location
      ) {
        url = normalizeUrl(new URL(response.location, url).href);
        continue;
      }
      const hash = createHash("sha256").update(response.bytes).digest("hex");
      const supported = /text\/html|application\/json|text\/plain/i.test(
        response.contentType,
      );
      const text = supported
        ? extractText(response.bytes.toString("utf8")).slice(0, 180000)
        : "";
      const limitations = [
        "Static HTTP inspection only; rendered and conditional content has not been inspected.",
      ];
      if (!supported)
        limitations.push(
          "This content type cannot be extracted by the available source inspector.",
        );
      if (text.length === 180000)
        limitations.push("Source text was truncated at the inspection limit.");
      return remember({
        ...base,
        id: base.id,
        finalUrl: url.href,
        canonicalUrl: url.href,
        hash,
        text,
        httpStatus: response.status,
        status:
          response.status >= 200 && response.status < 300 && text
            ? "inspected"
            : "inaccessible",
        limitations,
      });
    }
    throw new Error("Source exceeded the redirect limit.");
  } catch (error) {
    return {
      ...base,
      finalUrl: url.href,
      limitations: [
        error instanceof Error ? error.message : "Source inspection failed.",
      ],
    };
  } finally {
    activeFetches--;
  }
}

export function observedRequired(
  text: string,
  field: { id: string; label: string; evidence?: readonly { quote: string }[] },
): "required" | "optional" | "unknown" {
  const tags = [
    ...text.matchAll(
      /<(?:input|textarea|select)\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi,
    ),
  ].map((match) => {
    const attributes = new Map<string, string>();
    const body = match[0].replace(/^<[^\s>]+/, "").replace(/\/?>$/, "");
    const attribute =
      /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    for (const value of body.matchAll(attribute)) {
      const name = value[1]!.toLowerCase();
      if (!attributes.has(name))
        attributes.set(name, value[2] ?? value[3] ?? value[4] ?? "");
    }
    return attributes;
  });
  const matched = tags.filter(
    (attributes) =>
      attributes.get("id") === field.id ||
      attributes.get("aria-label") === field.label,
  );
  const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
  const visibleText = text
    .split(
      "\nSTATIC SOURCE METADATA (untrusted markup, not rendered interaction):\n",
    )[0]!
    .replace(/<(?:[^"'<>]|"[^"]*"|'[^']*')*>/g, " ");
  const visibleMarker =
    matched.length > 0 &&
    /\*\s+indicates\s+(?:a\s+)?required\s+field\b/i.test(visibleText) &&
    (field.evidence ?? []).some(
      (evidence) =>
        normalize(evidence.quote) === normalize(field.label) + " *" &&
        normalize(visibleText).includes(normalize(evidence.quote)),
    );
  const required =
    visibleMarker ||
    matched.some(
      (attributes) =>
        attributes.get("aria-required") === "true" ||
        attributes.has("required"),
    );
  const optional = matched.some(
    (attributes) => attributes.get("aria-required") === "false",
  );
  if (required && !optional) return "required";
  if (optional && !required) return "optional";
  return "unknown";
}

export function hasRequisitionEvidence(
  text: string,
  identifier: string,
): boolean {
  if (
    !identifier.trim() ||
    identifier !== identifier.trim() ||
    identifier.length > 100
  )
    return false;
  const labels =
    /\b(?:(?:requisition|req)[\s_-]*(?:id|number|no\.?)["'\s:#=_-]{1,12}|(?:requisition|req)["'\s]{0,4}[:#=]["'\s:#=_-]{0,12})([A-Za-z0-9][A-Za-z0-9._/-]{0,99})(?![A-Za-z0-9._/-])/gi;
  return [...text.replace(/\s+/g, " ").matchAll(labels)].some(
    (match) => match[1] === identifier,
  );
}
