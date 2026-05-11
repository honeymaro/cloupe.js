/**
 * HeaderParser - Parses the .cloupe file header
 *
 * The header occupies the first 4096 bytes of the file and contains
 * JSON-encoded metadata including version and index block location.
 *
 * The .cloupe format supports a linked list of headers: the primary header
 * (at offset 0) may point to a secondary header via `nextHeaderOffset`. Loupe
 * Browser writes user-created annotations into that secondary header's index
 * block. Use `parseHeaderAt` to read non-primary headers (lenient validation —
 * the secondary header may omit fields like `version`).
 */

import { CloupeError, CloupeErrorCode, type CloupeHeader } from "../types/index.js";
import type { BlockReader } from "./BlockReader.js";

/**
 * Header size in bytes (fixed at 4096)
 */
export const HEADER_SIZE = 4096;

/**
 * Reads and JSON-parses a 4096-byte header at the given offset.
 * Performs no field validation — callers (`HeaderParser.parse` or
 * `parseHeaderAt`) apply the appropriate strict/lenient checks.
 */
async function parseAtOffset(reader: BlockReader, offset: number): Promise<CloupeHeader> {
  if (reader.size < offset + HEADER_SIZE) {
    throw new CloupeError(
      `File too small for header at offset ${offset}: need ${offset + HEADER_SIZE}, have ${reader.size}`,
      CloupeErrorCode.INVALID_HEADER
    );
  }
  const headerBuffer = await reader.readRaw(offset, offset + HEADER_SIZE);
  const headerBytes = new Uint8Array(headerBuffer);
  let jsonEnd = HEADER_SIZE;
  for (let i = 0; i < HEADER_SIZE; i++) {
    if (headerBytes[i] === 0) {
      jsonEnd = i;
      break;
    }
  }
  const headerString = new TextDecoder("utf-8").decode(headerBytes.subarray(0, jsonEnd));
  let header: CloupeHeader;
  try {
    header = JSON.parse(headerString) as CloupeHeader;
  } catch (error) {
    throw new CloupeError(
      `Failed to parse header JSON at offset ${offset}`,
      CloupeErrorCode.INVALID_HEADER,
      error
    );
  }
  return header;
}

/**
 * Parses a non-primary header at the given offset using lenient validation.
 *
 * Secondary headers (linked via `nextHeaderOffset`) may omit fields like
 * `version` — they only need a valid `indexBlock` so that we can read their
 * appended annotations. See `cellgeni/cloupe/cloupe/__init__.py:169-176`.
 */
export async function parseHeaderAt(reader: BlockReader, offset: number): Promise<CloupeHeader> {
  const header = await parseAtOffset(reader, offset);
  // Lenient validation — secondary headers may omit fields like version.
  if (!header.indexBlock) {
    throw new CloupeError(
      `Header at offset ${offset} missing required field: indexBlock`,
      CloupeErrorCode.INVALID_HEADER
    );
  }
  if (
    typeof header.indexBlock.Start !== "number" ||
    typeof header.indexBlock.End !== "number" ||
    header.indexBlock.Start >= header.indexBlock.End ||
    header.indexBlock.End > reader.size
  ) {
    throw new CloupeError(
      `Header at offset ${offset} has invalid indexBlock`,
      CloupeErrorCode.INVALID_HEADER
    );
  }
  return header;
}

/**
 * Parses the .cloupe file header from a BlockReader
 */
export class HeaderParser {
  private reader: BlockReader;

  constructor(reader: BlockReader) {
    this.reader = reader;
  }

  /**
   * Reads and parses the primary header (offset 0) with strict validation.
   * @returns Parsed CloupeHeader object
   * @throws CloupeError if header is invalid
   */
  async parse(): Promise<CloupeHeader> {
    const header = await parseAtOffset(this.reader, 0);
    this.validateHeader(header);
    return header;
  }

  /**
   * Validates the primary header structure (strict — requires `version`).
   */
  private validateHeader(header: CloupeHeader): void {
    if (!header.version) {
      throw new CloupeError(
        "Header missing required field: version",
        CloupeErrorCode.INVALID_HEADER
      );
    }

    if (!header.indexBlock) {
      throw new CloupeError(
        "Header missing required field: indexBlock",
        CloupeErrorCode.INVALID_HEADER
      );
    }

    if (typeof header.indexBlock.Start !== "number" || typeof header.indexBlock.End !== "number") {
      throw new CloupeError(
        "Header indexBlock missing Start/End fields",
        CloupeErrorCode.INVALID_HEADER
      );
    }

    if (header.indexBlock.Start >= header.indexBlock.End) {
      throw new CloupeError(
        `Invalid indexBlock range: [${header.indexBlock.Start}, ${header.indexBlock.End})`,
        CloupeErrorCode.INVALID_HEADER
      );
    }

    if (header.indexBlock.End > this.reader.size) {
      throw new CloupeError(
        `indexBlock end (${header.indexBlock.End}) exceeds file size (${this.reader.size})`,
        CloupeErrorCode.INVALID_HEADER
      );
    }
  }
}

/**
 * Convenience function to parse the primary header from a BlockReader.
 */
export async function parseHeader(reader: BlockReader): Promise<CloupeHeader> {
  const parser = new HeaderParser(reader);
  return parser.parse();
}
