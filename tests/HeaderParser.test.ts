import { describe, it, expect } from "vitest";
import { BlockReader } from "../src/core/BlockReader.js";
import { parseHeaderAt, HEADER_SIZE } from "../src/core/HeaderParser.js";

function makeBlob(headers: object[]): Blob {
  const parts: Uint8Array[] = [];
  const enc = new TextEncoder();
  for (const h of headers) {
    const json = JSON.stringify(h);
    const buf = new Uint8Array(HEADER_SIZE);
    buf.set(enc.encode(json));
    parts.push(buf);
  }
  parts.push(new Uint8Array(1024));
  return new Blob(parts);
}

describe("parseHeaderAt", () => {
  it("parses a header at a non-zero offset", async () => {
    const primary = {
      version: "0.7.0",
      indexBlock: { Start: 100, End: 200 },
      nextHeaderOffset: HEADER_SIZE,
    };
    const secondary = {
      version: "0.7.0",
      indexBlock: { Start: 300, End: 400 },
    };
    const blob = makeBlob([primary, secondary]);
    const reader = new BlockReader(blob);

    const got = await parseHeaderAt(reader, HEADER_SIZE);
    expect(got.indexBlock.Start).toBe(300);
    expect(got.indexBlock.End).toBe(400);
  });

  it("throws when offset + HEADER_SIZE exceeds file size", async () => {
    const blob = new Blob([new Uint8Array(100)]);
    const reader = new BlockReader(blob);
    await expect(parseHeaderAt(reader, 0)).rejects.toThrow(/File too small/);
  });

  it("throws when header indexBlock is missing", async () => {
    const enc = new TextEncoder();
    const buf = new Uint8Array(HEADER_SIZE);
    buf.set(enc.encode(JSON.stringify({ version: "0.7.0" }))); // no indexBlock
    const blob = new Blob([buf]);
    const reader = new BlockReader(blob);
    await expect(parseHeaderAt(reader, 0)).rejects.toThrow(/missing required field: indexBlock/);
  });

  it("throws when indexBlock range is invalid (Start >= End)", async () => {
    const enc = new TextEncoder();
    const buf = new Uint8Array(HEADER_SIZE);
    buf.set(
      enc.encode(
        JSON.stringify({
          version: "0.7.0",
          indexBlock: { Start: 500, End: 100 },
        })
      )
    );
    const blob = new Blob([buf, new Uint8Array(1024)]);
    const reader = new BlockReader(blob);
    await expect(parseHeaderAt(reader, 0)).rejects.toThrow(/invalid indexBlock/);
  });
});
