/**
 * Decompressor - Handles gzip decompression for .cloupe file blocks
 *
 * Uses fflate library for efficient browser-compatible decompression.
 * Automatically detects gzip-compressed data by checking magic bytes.
 *
 * Supports:
 * - CompressionType=0: No compression
 * - CompressionType=1: Standard gzip
 * - CompressionType=2: Block-indexed compression (multiple gzip blocks)
 */

import { gunzipSync, inflateSync, Gunzip, gunzip } from "fflate";
import { CloupeError, CloupeErrorCode } from "../types/index.js";

/**
 * Gzip magic bytes (0x1F 0x8B)
 */
const GZIP_MAGIC = new Uint8Array([0x1f, 0x8b]);

/**
 * Promisified async gunzip
 */
function gunzipAsync(data: Uint8Array): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    gunzip(data, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

/**
 * Checks if data is gzip-compressed by examining magic bytes
 */
export function isGzipCompressed(data: Uint8Array): boolean {
  return data.length >= 2 && data[0] === GZIP_MAGIC[0] && data[1] === GZIP_MAGIC[1];
}

/**
 * Tries to decompress gzip data using streaming API (more robust for edge cases)
 * Returns null if decompression fails
 */
function tryStreamingGunzip(data: Uint8Array): Uint8Array | null {
  try {
    const chunks: Uint8Array[] = [];
    let totalLength = 0;

    const gunzip = new Gunzip((chunk) => {
      chunks.push(chunk);
      totalLength += chunk.length;
    });

    gunzip.push(data, true);

    if (chunks.length === 0) {
      return null;
    }

    // Concatenate chunks
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  } catch {
    return null;
  }
}

/**
 * Tries to decompress raw deflate data (skipping gzip header/trailer)
 * Gzip header is at least 10 bytes: magic(2) + method(1) + flags(1) + mtime(4) + xfl(1) + os(1)
 */
function tryRawInflate(data: Uint8Array): Uint8Array | null {
  if (!isGzipCompressed(data) || data.length < 10) {
    return null;
  }

  try {
    // Parse gzip header to find where deflate data starts
    const flags = data[3];
    let offset = 10; // Basic header size

    // FEXTRA flag (bit 2)
    if (flags & 0x04) {
      if (offset + 2 > data.length) return null;
      const xlen = data[offset] | (data[offset + 1] << 8);
      offset += 2 + xlen;
    }

    // FNAME flag (bit 3) - null-terminated filename
    if (flags & 0x08) {
      while (offset < data.length && data[offset] !== 0) offset++;
      offset++; // Skip null terminator
    }

    // FCOMMENT flag (bit 4) - null-terminated comment
    if (flags & 0x10) {
      while (offset < data.length && data[offset] !== 0) offset++;
      offset++; // Skip null terminator
    }

    // FHCRC flag (bit 1) - 2-byte header CRC
    if (flags & 0x02) {
      offset += 2;
    }

    if (offset >= data.length - 8) {
      return null; // Not enough data for deflate stream + trailer
    }

    // Deflate data is from offset to (length - 8) (8 bytes for CRC32 + ISIZE trailer)
    const deflateData = data.subarray(offset, data.length - 8);

    // Try raw inflate
    return inflateSync(deflateData);
  } catch {
    return null;
  }
}

/**
 * Finds all gzip block boundaries in data
 * Returns array of start offsets for each gzip block
 */
function findGzipBlocks(data: Uint8Array): number[] {
  const blocks: number[] = [];

  for (let i = 0; i < data.length - 1; i++) {
    if (data[i] === GZIP_MAGIC[0] && data[i + 1] === GZIP_MAGIC[1]) {
      blocks.push(i);
    }
  }

  return blocks;
}

/**
 * Decompresses gzip data if compressed, otherwise returns as-is
 * @param data - The potentially compressed data
 * @returns Decompressed data as Uint8Array
 * @throws CloupeError if decompression fails
 */
export function decompress(data: Uint8Array): Uint8Array {
  if (!isGzipCompressed(data)) {
    // Data is not gzip compressed - return as-is
    return data;
  }

  // Try method 1: Standard gunzipSync
  try {
    const result = gunzipSync(data);
    if (result.length > 0 || data.length === 0) {
      return result;
    }
  } catch {
    // Continue to next method
  }

  // Try method 2: Streaming gunzip (more robust for edge cases)
  const streamingResult = tryStreamingGunzip(data);
  if (streamingResult && streamingResult.length > 0) {
    return streamingResult;
  }

  // Try method 3: Raw inflate (skip gzip header/trailer parsing)
  const rawResult = tryRawInflate(data);
  if (rawResult && rawResult.length > 0) {
    return rawResult;
  }

  // Try method 4: Block-indexed decompression
  try {
    const result = decompressBlockIndexed(data);
    if (result.length > 0) {
      return result;
    }
  } catch {
    // Continue to error
  }

  // All methods failed
  throw new CloupeError("Failed to decompress gzip data", CloupeErrorCode.DECOMPRESSION_FAILED);
}

/**
 * Decompresses block-indexed compressed data (CompressionType=2)
 *
 * Block-indexed compression stores multiple gzip blocks concatenated together,
 * potentially with an index at the end for random access.
 *
 * @param data - The block-indexed compressed data
 * @returns Decompressed data as Uint8Array
 */
export function decompressBlockIndexed(data: Uint8Array): Uint8Array {
  const blocks = findGzipBlocks(data);

  if (blocks.length === 0) {
    // No gzip blocks found, return as-is
    return data;
  }

  if (blocks.length === 1) {
    // Single block, use standard decompression
    return gunzipSync(data.subarray(blocks[0]));
  }

  // Multiple blocks - decompress each and concatenate
  const decompressedParts: Uint8Array[] = [];
  let totalLength = 0;

  for (let i = 0; i < blocks.length; i++) {
    const start = blocks[i];
    const end = i < blocks.length - 1 ? blocks[i + 1] : data.length;

    try {
      const blockData = data.subarray(start, end);
      const decompressed = gunzipSync(blockData);
      decompressedParts.push(decompressed);
      totalLength += decompressed.length;
    } catch {
      // If a block fails to decompress, it might be the index block or false positive
      // Skip it and continue
      continue;
    }
  }

  if (decompressedParts.length === 0) {
    throw new CloupeError(
      "No valid gzip blocks found in block-indexed data",
      CloupeErrorCode.DECOMPRESSION_FAILED
    );
  }

  // Concatenate all decompressed parts
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const part of decompressedParts) {
    result.set(part, offset);
    offset += part.length;
  }

  return result;
}

/**
 * Decompresses data and returns as ArrayBuffer
 */
export function decompressToArrayBuffer(data: Uint8Array): ArrayBuffer {
  const decompressed = decompress(data);
  return decompressed.buffer.slice(
    decompressed.byteOffset,
    decompressed.byteOffset + decompressed.byteLength
  ) as ArrayBuffer;
}

/**
 * Decompresses data and decodes as UTF-8 string
 */
export function decompressToString(data: Uint8Array): string {
  const decompressed = decompress(data);
  return new TextDecoder("utf-8").decode(decompressed);
}

/**
 * Decompresses data and parses as JSON
 * @throws CloupeError if decompression or JSON parsing fails
 */
export function decompressToJson<T = unknown>(data: Uint8Array): T {
  const str = decompressToString(data);
  try {
    return JSON.parse(str) as T;
  } catch (error) {
    throw new CloupeError(
      "Failed to parse decompressed data as JSON",
      CloupeErrorCode.INVALID_DATA,
      error
    );
  }
}

/**
 * Decompresses block-indexed data using the provided index (ASYNC with parallel decompression)
 *
 * The index format is:
 * - index[0]: Decompressed block size (typically 65280 bytes)
 * - index[1..N]: Byte offsets into compressed data for each block start
 *
 * @param data - The compressed data
 * @param index - Array of byte offsets (read from Index block as Uint64)
 * @returns Decompressed data as Uint8Array
 */
export async function decompressWithIndex(
  data: Uint8Array,
  index: Float64Array
): Promise<Uint8Array> {
  if (index.length < 2) {
    return decompress(data);
  }

  // Check if this looks like single block by examining if there are multiple distinct offsets
  // Index format: [expectedDecompressedBlockSize, offset0=0, offset1, offset2, ...]
  // Single block case: only has [expectedSize, 0] or [expectedSize, 0, 0, ...]
  // Multi block case: has distinct non-zero offsets after index[1]
  let hasMultipleBlocks = false;
  for (let i = 2; i < index.length; i++) {
    if (index[i] > 0 && index[i] > index[i - 1]) {
      hasMultipleBlocks = true;
      break;
    }
  }

  if (!hasMultipleBlocks && index[0] > data.length && index[1] === 0) {
    try {
      return await gunzipAsync(data);
    } catch {
      const streamingResult = tryStreamingGunzip(data);
      if (streamingResult && streamingResult.length > 0) {
        return streamingResult;
      }
      const rawResult = tryRawInflate(data);
      if (rawResult && rawResult.length > 0) {
        return rawResult;
      }
    }
  }

  // Build block ranges (Format 1: skip index[0] as it may be expected size)
  const blocks: { start: number; end: number }[] = [];
  const seenRanges = new Set<string>();

  for (let i = 1; i < index.length; i++) {
    const start = index[i];
    let end = i < index.length - 1 ? index[i + 1] : data.length;
    if (end <= start) end = data.length;
    if (start >= data.length) break;

    const actualEnd = Math.min(end, data.length);
    const rangeKey = `${start}-${actualEnd}`;

    // Skip duplicate ranges (caused by duplicate trailing index values)
    if (!seenRanges.has(rangeKey)) {
      seenRanges.add(rangeKey);
      blocks.push({ start, end: actualEnd });
    }
  }

  if (blocks.length === 0) {
    // Try Format 2: all entries are offsets
    for (let i = 0; i < index.length; i++) {
      const start = index[i];
      let end = i < index.length - 1 ? index[i + 1] : data.length;
      if (end <= start) end = data.length;
      if (start >= data.length) break;

      const actualEnd = Math.min(end, data.length);
      const rangeKey = `${start}-${actualEnd}`;

      if (!seenRanges.has(rangeKey)) {
        seenRanges.add(rangeKey);
        blocks.push({ start, end: actualEnd });
      }
    }
  }

  if (blocks.length === 0) {
    try {
      return decompress(data);
    } catch {
      if (data.length > 0) {
        return data;
      }
      throw new CloupeError(
        "No valid gzip blocks found using index",
        CloupeErrorCode.DECOMPRESSION_FAILED
      );
    }
  }

  // Parallel decompression with batching
  const BATCH_SIZE = 100;
  const decompressedParts: Uint8Array[] = new Array(blocks.length);
  let successCount = 0;

  for (let batchStart = 0; batchStart < blocks.length; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, blocks.length);
    const batchPromises: Promise<void>[] = [];

    for (let i = batchStart; i < batchEnd; i++) {
      const { start, end } = blocks[i];
      const blockData = data.subarray(start, end);
      if (blockData.length === 0) continue;

      const idx = i;
      batchPromises.push(
        gunzipAsync(blockData)
          .then((result) => {
            decompressedParts[idx] = result;
            successCount++;
          })
          .catch(() => {
            // Block might contain multiple concatenated gzip streams
            // Try scanning for gzip headers within the block
            try {
              const scannedResult = decompressBlockIndexed(blockData);
              if (scannedResult.length > 0) {
                decompressedParts[idx] = scannedResult;
                successCount++;
              }
            } catch {
              // Skip failed blocks
            }
          })
      );
    }

    await Promise.all(batchPromises);
  }

  if (successCount === 0) {
    try {
      return decompress(data);
    } catch {
      if (data.length > 0) {
        return data;
      }
      throw new CloupeError(
        "No valid gzip blocks found using index",
        CloupeErrorCode.DECOMPRESSION_FAILED
      );
    }
  }

  // Concatenate
  let totalLength = 0;
  for (const part of decompressedParts) {
    if (part) totalLength += part.length;
  }

  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of decompressedParts) {
    if (part) {
      result.set(part, offset);
      offset += part.length;
    }
  }

  return result;
}
