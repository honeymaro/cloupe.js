/**
 * BlockReader - Handles random access file reading with lazy loading
 *
 * Supports two data sources:
 * 1. File/Blob - Uses slice() for efficient partial reading
 * 2. URL - Uses HTTP Range Requests for remote file access
 *
 * This enables browser-based random access without loading entire file into memory.
 */

import {
  CloupeError,
  CloupeErrorCode,
  type BlockLocation,
  type MatrixBlock,
  CompressionType,
} from "../types/index.js";
import { decompress, decompressToJson, decompressWithIndex } from "../utils/Decompressor.js";
import { BinaryReader } from "../utils/BinaryReader.js";

/**
 * Source type for BlockReader
 */
export type BlockReaderSource = File | Blob | { url: string; size: number };

/**
 * Provides random access reading capabilities for File/Blob/URL sources
 */
export class BlockReader {
  private source: BlockReaderSource;
  private _size: number;

  constructor(source: BlockReaderSource) {
    this.source = source;
    if ("url" in source) {
      this._size = source.size;
    } else {
      this._size = source.size;
    }
  }

  /**
   * Creates a BlockReader from a URL using HTTP Range Requests
   * First fetches file size via HEAD request
   */
  static async fromUrl(url: string): Promise<BlockReader> {
    // Fetch file size via HEAD request
    const headResponse = await fetch(url, { method: "HEAD" });
    if (!headResponse.ok) {
      throw new CloupeError(
        `Failed to fetch file info: HTTP ${headResponse.status}`,
        CloupeErrorCode.FILE_READ_ERROR
      );
    }

    const contentLength = headResponse.headers.get("Content-Length");
    if (!contentLength) {
      throw new CloupeError(
        "Server did not return Content-Length header",
        CloupeErrorCode.FILE_READ_ERROR
      );
    }

    const size = parseInt(contentLength, 10);

    // Check if server supports Range requests
    // Some servers don't advertise Accept-Ranges but still support it
    const acceptRanges = headResponse.headers.get("Accept-Ranges");
    if (acceptRanges === "none") {
      throw new CloupeError(
        "Server explicitly does not support Range requests",
        CloupeErrorCode.FILE_READ_ERROR
      );
    }

    // Test Range request support with a small request
    if (acceptRanges !== "bytes") {
      const testResponse = await fetch(url, {
        method: "GET",
        headers: { Range: "bytes=0-0" },
      });
      if (testResponse.status !== 206) {
        throw new CloupeError(
          "Server does not support Range requests",
          CloupeErrorCode.FILE_READ_ERROR
        );
      }
    }

    return new BlockReader({ url, size });
  }

  /**
   * Gets the total file size in bytes
   */
  get size(): number {
    return this._size;
  }

  /**
   * Checks if this reader is using a remote URL
   */
  get isRemote(): boolean {
    return "url" in this.source;
  }

  /**
   * Reads a raw block of bytes from the file
   * @param start - Start byte offset (inclusive)
   * @param end - End byte offset (exclusive)
   * @returns ArrayBuffer containing the requested bytes
   */
  async readRaw(start: number, end: number): Promise<ArrayBuffer> {
    if (start < 0 || end > this._size || start >= end) {
      throw new CloupeError(
        `Invalid byte range [${start}, ${end}) for file of size ${this._size}`,
        CloupeErrorCode.FILE_READ_ERROR
      );
    }

    try {
      if ("url" in this.source) {
        // Use HTTP Range Request for remote files
        return await this.fetchRange(this.source.url, start, end);
      } else {
        // Use Blob.slice() for local files
        const slice = this.source.slice(start, end);
        return await slice.arrayBuffer();
      }
    } catch (error) {
      throw new CloupeError(
        `Failed to read bytes [${start}, ${end})`,
        CloupeErrorCode.FILE_READ_ERROR,
        error
      );
    }
  }

  /**
   * Fetches a byte range from a remote URL
   */
  private async fetchRange(url: string, start: number, end: number): Promise<ArrayBuffer> {
    // HTTP Range header uses inclusive end, so subtract 1
    const response = await fetch(url, {
      headers: {
        Range: `bytes=${start}-${end - 1}`,
      },
    });

    if (!response.ok && response.status !== 206) {
      throw new CloupeError(
        `Range request failed: HTTP ${response.status}`,
        CloupeErrorCode.FILE_READ_ERROR
      );
    }

    return await response.arrayBuffer();
  }

  /**
   * Reads a block using BlockLocation
   */
  async readBlock(location: BlockLocation): Promise<ArrayBuffer> {
    return this.readRaw(location.Start, location.End);
  }

  /**
   * Reads a block as Uint8Array
   */
  async readAsUint8Array(start: number, end: number): Promise<Uint8Array> {
    const buffer = await this.readRaw(start, end);
    return new Uint8Array(buffer);
  }

  /**
   * Reads a block and automatically decompresses if gzip-compressed
   */
  async readDecompressed(start: number, end: number): Promise<Uint8Array> {
    const data = await this.readAsUint8Array(start, end);
    return decompress(data);
  }

  /**
   * Reads a block, decompresses if needed, and returns as ArrayBuffer
   */
  async readDecompressedBuffer(start: number, end: number): Promise<ArrayBuffer> {
    const data = await this.readDecompressed(start, end);
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  }

  /**
   * Reads a block, decompresses if needed, and returns a BinaryReader
   */
  async readAsBinaryReader(start: number, end: number): Promise<BinaryReader> {
    const buffer = await this.readDecompressedBuffer(start, end);
    return new BinaryReader(buffer);
  }

  /**
   * Reads a block as UTF-8 string (with optional decompression)
   */
  async readAsString(start: number, end: number, autoDecompress = true): Promise<string> {
    const data = autoDecompress
      ? await this.readDecompressed(start, end)
      : await this.readAsUint8Array(start, end);
    return new TextDecoder("utf-8").decode(data);
  }

  /**
   * Reads a block as JSON (with optional decompression)
   */
  async readAsJson<T = unknown>(start: number, end: number, autoDecompress = true): Promise<T> {
    if (autoDecompress) {
      const data = await this.readAsUint8Array(start, end);
      return decompressToJson<T>(data);
    }

    const str = await this.readAsString(start, end, false);
    try {
      return JSON.parse(str) as T;
    } catch (error) {
      throw new CloupeError("Failed to parse block as JSON", CloupeErrorCode.INVALID_DATA, error);
    }
  }

  /**
   * Reads a block using BlockLocation and parses as JSON
   */
  async readBlockAsJson<T = unknown>(location: BlockLocation): Promise<T> {
    return this.readAsJson<T>(location.Start, location.End);
  }

  /**
   * Reads fixed-width strings from a block
   * @param start - Start byte offset
   * @param end - End byte offset
   * @param width - Fixed width of each string (including null padding)
   * @param count - Number of strings to read
   */
  async readFixedStrings(
    start: number,
    end: number,
    width: number,
    count: number
  ): Promise<string[]> {
    const reader = await this.readAsBinaryReader(start, end);
    const strings: string[] = [];

    for (let i = 0; i < count && reader.hasMore; i++) {
      strings.push(reader.readFixedString(width));
    }

    return strings;
  }

  /**
   * Reads an array of 64-bit doubles from a block
   */
  async readFloat64Array(start: number, end: number, count: number): Promise<Float64Array> {
    const reader = await this.readAsBinaryReader(start, end);
    return reader.readFloat64Array(count);
  }

  /**
   * Reads an array of unsigned 64-bit integers as Float64Array
   */
  async readUint64Array(start: number, end: number, count: number): Promise<Float64Array> {
    const reader = await this.readAsBinaryReader(start, end);
    return reader.readUint64Array(count);
  }

  /**
   * Reads an array of signed 16-bit integers
   */
  async readInt16Array(start: number, end: number, count: number): Promise<Int16Array> {
    const reader = await this.readAsBinaryReader(start, end);
    return reader.readInt16Array(count);
  }

  /**
   * Reads an array of unsigned 32-bit integers
   */
  async readUint32Array(start: number, end: number, count: number): Promise<Uint32Array> {
    const reader = await this.readAsBinaryReader(start, end);
    return reader.readUint32Array(count);
  }

  /**
   * Reads an array of signed 32-bit integers
   */
  async readInt32Array(start: number, end: number, count: number): Promise<Int32Array> {
    const reader = await this.readAsBinaryReader(start, end);
    return reader.readInt32Array(count);
  }

  // ============================================================================
  // Block-indexed compression support (CompressionType=2)
  // ============================================================================

  /**
   * Reads a block with CompressionType=2 using its Index
   * @param block - MatrixBlock with CompressionType=2 and Index field
   */
  async readBlockWithIndex(block: MatrixBlock): Promise<Uint8Array> {
    if (!block.Index || block.CompressionType !== CompressionType.BLOCK) {
      // Fall back to standard decompression
      return this.readDecompressed(block.Start, block.End);
    }

    // Read the index block (uncompressed)
    const indexData = await this.readAsUint8Array(block.Index.Start, block.Index.End);
    const indexView = new DataView(indexData.buffer, indexData.byteOffset, indexData.byteLength);

    // Read index values as Uint64
    const indexCount = block.Index.ArraySize ?? Math.floor(indexData.length / 8);
    const indexValues = new Float64Array(indexCount);
    for (let i = 0; i < indexCount; i++) {
      // Read as two 32-bit values and combine
      const low = indexView.getUint32(i * 8, true);
      const high = indexView.getUint32(i * 8 + 4, true);
      indexValues[i] = low + high * 0x100000000;
    }

    // Read compressed data
    const compressedData = await this.readAsUint8Array(block.Start, block.End);

    // Decompress using index (async for parallel decompression)
    return await decompressWithIndex(compressedData, indexValues);
  }

  /**
   * Reads Float64 array from a MatrixBlock, handling CompressionType=2
   */
  async readFloat64ArrayFromBlock(block: MatrixBlock): Promise<Float64Array> {
    const decompressed = await this.readBlockWithIndex(block);

    const view = new DataView(
      decompressed.buffer,
      decompressed.byteOffset,
      decompressed.byteLength
    );

    // Use ArraySize as the authoritative count if available
    // Decompression may produce extra bytes (padding, etc.)
    const maxCount = Math.floor(decompressed.length / 8);
    const count =
      block.ArraySize && block.ArraySize > 0 ? Math.min(block.ArraySize, maxCount) : maxCount;

    const result = new Float64Array(count);
    for (let i = 0; i < count; i++) {
      result[i] = view.getFloat64(i * 8, true);
    }
    return result;
  }

  /**
   * Reads Uint64 array from a MatrixBlock, handling CompressionType=2
   */
  async readUint64ArrayFromBlock(block: MatrixBlock): Promise<Float64Array> {
    const decompressed = await this.readBlockWithIndex(block);
    const view = new DataView(
      decompressed.buffer,
      decompressed.byteOffset,
      decompressed.byteLength
    );

    // Use ArraySize as the authoritative count if available
    const maxCount = Math.floor(decompressed.length / 8);
    const count =
      block.ArraySize && block.ArraySize > 0 ? Math.min(block.ArraySize, maxCount) : maxCount;

    const result = new Float64Array(count);
    for (let i = 0; i < count; i++) {
      // Read as two 32-bit values
      const low = view.getUint32(i * 8, true);
      const high = view.getUint32(i * 8 + 4, true);
      result[i] = low + high * 0x100000000;
    }
    return result;
  }

  /**
   * Reads Int16 array from a MatrixBlock, handling CompressionType=2
   */
  async readInt16ArrayFromBlock(block: MatrixBlock): Promise<Int16Array> {
    const decompressed = await this.readBlockWithIndex(block);
    const view = new DataView(
      decompressed.buffer,
      decompressed.byteOffset,
      decompressed.byteLength
    );

    // Use ArraySize as the authoritative count if available
    const maxCount = Math.floor(decompressed.length / 2);
    const count =
      block.ArraySize && block.ArraySize > 0 ? Math.min(block.ArraySize, maxCount) : maxCount;

    const result = new Int16Array(count);
    for (let i = 0; i < count; i++) {
      result[i] = view.getInt16(i * 2, true);
    }
    return result;
  }

  /**
   * Reads Int32 array from a MatrixBlock, handling CompressionType=2
   */
  async readInt32ArrayFromBlock(block: MatrixBlock): Promise<Int32Array> {
    const decompressed = await this.readBlockWithIndex(block);
    const view = new DataView(
      decompressed.buffer,
      decompressed.byteOffset,
      decompressed.byteLength
    );

    // Use ArraySize as the authoritative count if available
    const maxCount = Math.floor(decompressed.length / 4);
    const count =
      block.ArraySize && block.ArraySize > 0 ? Math.min(block.ArraySize, maxCount) : maxCount;

    const result = new Int32Array(count);
    for (let i = 0; i < count; i++) {
      result[i] = view.getInt32(i * 4, true);
    }
    return result;
  }

  /**
   * Reads signed integer array from a MatrixBlock, auto-detecting element size (Int16 or Int32)
   * Based on decompressed size vs ArraySize
   */
  async readSignedIntArrayFromBlock(block: MatrixBlock): Promise<Int16Array | Int32Array> {
    const decompressed = await this.readBlockWithIndex(block);
    const view = new DataView(
      decompressed.buffer,
      decompressed.byteOffset,
      decompressed.byteLength
    );

    // Determine element size from decompressed data
    const arraySize = block.ArraySize ?? 0;
    if (arraySize === 0) {
      // Fall back to Int16 if no ArraySize
      const count = Math.floor(decompressed.length / 2);
      const result = new Int16Array(count);
      for (let i = 0; i < count; i++) {
        result[i] = view.getInt16(i * 2, true);
      }
      return result;
    }

    // Calculate element size: decompressed_bytes / element_count
    const elementSize = decompressed.length / arraySize;

    if (elementSize >= 3.5 && elementSize <= 4.5) {
      // Int32 (4 bytes per element)
      const count = Math.min(arraySize, Math.floor(decompressed.length / 4));
      const result = new Int32Array(count);
      for (let i = 0; i < count; i++) {
        result[i] = view.getInt32(i * 4, true);
      }
      return result;
    } else {
      // Int16 (2 bytes per element) - default
      const count = Math.min(arraySize, Math.floor(decompressed.length / 2));
      const result = new Int16Array(count);
      for (let i = 0; i < count; i++) {
        result[i] = view.getInt16(i * 2, true);
      }
      return result;
    }
  }

  /**
   * Reads fixed-width strings from a MatrixBlock, handling CompressionType=2
   */
  async readFixedStringsFromBlock(block: MatrixBlock): Promise<string[]> {
    const decompressed = await this.readBlockWithIndex(block);

    const width = block.ArrayWidth ?? 0;
    const count = block.ArraySize ?? 0;

    if (width === 0 || count === 0) {
      return [];
    }

    const decoder = new TextDecoder("utf-8");
    const strings: string[] = [];

    for (let i = 0; i < count; i++) {
      const start = i * width;
      const end = start + width;

      if (end > decompressed.length) break;

      const slice = decompressed.subarray(start, end);
      // Find null terminator
      let nullPos = slice.indexOf(0);
      if (nullPos === -1) nullPos = slice.length;

      const str = decoder.decode(slice.subarray(0, nullPos));
      strings.push(str);
    }

    return strings;
  }
}
