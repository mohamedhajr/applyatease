import { describe, expect, it } from "vitest";
import {
  extractText,
  normalizeUrl,
  publicAddress,
  observedRequired,
  hasRequisitionEvidence,
} from "../src/workflow/source.ts";

describe("source network boundary", () => {
  it("rejects private, loopback, metadata, multicast and mapped addresses", () => {
    for (const address of [
      "127.0.0.1",
      "10.1.2.3",
      "172.31.1.1",
      "192.168.0.1",
      "169.254.169.254",
      "100.64.0.1",
      "224.0.0.1",
      "::1",
      "::ffff:127.0.0.1",
      "fd12::1",
      "fe80::1",
      "ff02::1",
    ])
      expect(publicAddress(address), address).toBe(false);
    expect(publicAddress("8.8.8.8")).toBe(true);
    expect(publicAddress("2606:4700:4700::1111")).toBe(true);
  });
  it("accepts only public HTTPS domain URLs and removes tracking", () => {
    for (const url of [
      "http://example.com",
      "file:///etc/passwd",
      "https://127.0.0.1",
      "https://[::1]",
      "https://user:pass@example.com",
      "https://example.com:8080",
    ])
      expect(() => normalizeUrl(url)).toThrow();
    expect(
      normalizeUrl("https://example.com/job?id=42&utm_source=search#apply")
        .href,
    ).toBe("https://example.com/job?id=42");
  });
  it("uses observed required attributes without inferring conditional completeness", () => {
    expect(
      observedRequired('<input id="value" aria-required="true">', {
        id: "value",
        label: "Value",
      }),
    ).toBe("required");
    expect(
      observedRequired('<textarea aria-label="Value" aria-required="false">', {
        id: "value",
        label: "Value",
      }),
    ).toBe("optional");
    expect(
      observedRequired('<input id="other" required>', {
        id: "value",
        label: "Value",
      }),
    ).toBe("unknown");
  });
  it("tokenizes attribute names and quoted values before classifying controls", () => {
    const field = { id: "value", label: "Value" };
    expect(
      observedRequired(
        '<input id="value" placeholder="not required today" aria-required="false">',
        field,
      ),
    ).toBe("optional");
    expect(observedRequired('<input data-id="value" required>', field)).toBe(
      "unknown",
    );
    expect(
      observedRequired(
        '<input title=\'id="value" required\' aria-required="true">',
        field,
      ),
    ).toBe("unknown");
    expect(
      observedRequired(
        '<input id=value placeholder="x > y required" aria-required=false>',
        field,
      ),
    ).toBe("optional");
    expect(observedRequired('<input id=value required="false">', field)).toBe(
      "required",
    );
    expect(
      observedRequired('<input ID="value" ARIA-REQUIRED="true">', field),
    ).toBe("required");
    expect(
      observedRequired('<input id="other" id="value" required>', field),
    ).toBe("unknown");
  });
  it("binds a required asterisk to an observed control and explicit source legend", () => {
    const field = {
      id: "value",
      label: "Value",
      evidence: [{ quote: "Value *" }],
    };
    const marker =
      '* indicates a required field Value * <input id="value" type="file">';
    expect(observedRequired(marker, field)).toBe("required");
    expect(observedRequired('Value * <input id="value">', field)).toBe(
      "unknown",
    );
    expect(
      observedRequired(
        '* indicates a required field Value * <input id="other">',
        field,
      ),
    ).toBe("unknown");
    expect(
      observedRequired(marker, { ...field, evidence: [{ quote: "Other *" }] }),
    ).toBe("unknown");
    expect(
      observedRequired(
        '* indicates a required field Value <input id="value" placeholder="Value *">',
        field,
      ),
    ).toBe("unknown");
    expect(
      observedRequired(
        '* indicates a required field Value * <input id="value" aria-required="false">',
        field,
      ),
    ).toBe("unknown");
  });
  it("requires an explicitly labeled adjacent requisition identifier", () => {
    expect(hasRequisitionEvidence("Requisition ID: R-311", "R-311")).toBe(true);
    expect(hasRequisitionEvidence('"requisition_id":"311"', "311")).toBe(true);
    expect(hasRequisitionEvidence("Req #: 311", "311")).toBe(true);
    expect(
      hasRequisitionEvidence(
        "https://example.com/postings/6008895004",
        "6008895004",
      ),
    ).toBe(false);
    expect(
      hasRequisitionEvidence(
        "Posting ID: 6008895004; Requisition ID: 311",
        "6008895004",
      ),
    ).toBe(false);
    expect(
      hasRequisitionEvidence(
        "Requisition information and another value 311",
        "311",
      ),
    ).toBe(false);
    expect(hasRequisitionEvidence("Required: 311", "311")).toBe(false);
    expect(hasRequisitionEvidence("Requisition ID: 3119", "311")).toBe(false);
    expect(hasRequisitionEvidence("Requisition ID: 311", "ID")).toBe(false);
    expect(
      hasRequisitionEvidence(
        "Requisition information and another value 311",
        "information",
      ),
    ).toBe(false);
  });
  it("keeps actual static controls and structured data without executing scripts", () => {
    const text = extractText(
      '<script>alert(1)</script><script type="application/ld+json">{"@type":"JobPosting"}</script><input required maxlength="40"><style>body{}</style>',
    );
    expect(text).not.toContain("alert(1)");
    expect(text).not.toContain("body{}");
    expect(text).toContain('required maxlength="40"');
    expect(text).toContain('"@type":"JobPosting"');
    expect(text).toContain("not rendered interaction");
  });
});
