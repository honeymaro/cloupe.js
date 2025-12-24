/**
 * HeaderParser - Parses the .cloupe file header
 *
 * The header occupies the first 4096 bytes of the file and contains
 * JSON-encoded metadata including version and index block location.
 */

import { CloupeError, CloupeErrorCode, type CloupeHeader } from "../types/index.js";
import type { BlockReader } from "./BlockReader.js";

/**
 * Header size in bytes (fixed at 4096)
 */
export const HEADER_SIZE = 4096;

/**
 * Parses the .cloupe file header from a BlockReader
 */
export class HeaderParser {
  private reader: BlockReader;

  constructor(reader: BlockReader) {
    this.reader = reader;
  }

  /**
   * Reads and parses the header
   * @returns Parsed CloupeHeader object
   * @throws CloupeError if header is invalid
   */
  async parse(): Promise<CloupeHeader> {
    // Validate file size
    if (this.reader.size < HEADER_SIZE) {
      throw new CloupeError(
        `File too small: ${this.reader.size} bytes (minimum ${HEADER_SIZE})`,
        CloupeErrorCode.INVALID_HEADER
      );
    }

    // Read header bytes
    const headerBuffer = await this.reader.readRaw(0, HEADER_SIZE);
    const headerBytes = new Uint8Array(headerBuffer);

    // Find the end of JSON (first null byte or end of buffer)
    let jsonEnd = HEADER_SIZE;
    for (let i = 0; i < HEADER_SIZE; i++) {
      if (headerBytes[i] === 0) {
        jsonEnd = i;
        break;
      }
    }

    // Decode as UTF-8 string
    const headerString = new TextDecoder("utf-8").decode(headerBytes.subarray(0, jsonEnd));

    // Parse JSON
    let header: CloupeHeader;
    try {
      header = JSON.parse(headerString) as CloupeHeader;
    } catch (error) {
      throw new CloupeError("Failed to parse header JSON", CloupeErrorCode.INVALID_HEADER, error);
    }

    // Validate required fields
    this.validateHeader(header);

    return header;
  }

  /**
   * Validates the header structure
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
 * Convenience function to parse header from BlockReader
 */
export async function parseHeader(reader: BlockReader): Promise<CloupeHeader> {
  const parser = new HeaderParser(reader);
  return parser.parse();
}
