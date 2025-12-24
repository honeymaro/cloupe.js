/**
 * BarcodeReader - Reads barcode (cell identifier) data from .cloupe files
 *
 * Barcodes are stored as fixed-width UTF-8 strings with null padding.
 * This reader supports partial loading for large datasets.
 */

import {
  CloupeError,
  CloupeErrorCode,
  CompressionType,
  type MatrixInfo,
  type PaginationOptions,
} from "../types/index.js";
import type { BlockReader } from "../core/BlockReader.js";

/**
 * Reads barcode data from a .cloupe file
 */
export class BarcodeReader {
  private blockReader: BlockReader;
  private matrixInfo: MatrixInfo;
  private cachedBarcodes: string[] | null = null;

  constructor(blockReader: BlockReader, matrixInfo: MatrixInfo) {
    this.blockReader = blockReader;
    this.matrixInfo = matrixInfo;
  }

  /**
   * Gets the total number of barcodes
   */
  get count(): number {
    // Try explicit counts first
    if (this.matrixInfo.CellCount && this.matrixInfo.CellCount > 0) {
      return this.matrixInfo.CellCount;
    }
    if (this.matrixInfo.Columns && this.matrixInfo.Columns > 0) {
      return this.matrixInfo.Columns;
    }

    // Try ArraySize from Barcodes block
    const barcodesBlock = this.matrixInfo.Barcodes;
    if (barcodesBlock?.ArraySize && barcodesBlock.ArraySize > 0) {
      return barcodesBlock.ArraySize;
    }

    // Try ArraySize from BarcodeNames block
    const barcodeNamesBlock = this.matrixInfo.BarcodeNames;
    if (barcodeNamesBlock?.ArraySize && barcodeNamesBlock.ArraySize > 0) {
      return barcodeNamesBlock.ArraySize;
    }

    // For CSC format: numBarcodes = CSCPointers.ArraySize - 1
    const cscPointers = this.matrixInfo.CSCPointers;
    if (cscPointers?.ArraySize && cscPointers.ArraySize > 1) {
      return cscPointers.ArraySize - 1;
    }

    // For CSR format: numBarcodes from CSRIndices max or just use ArraySize
    const csrPointers = this.matrixInfo.CSRPointers;
    if (csrPointers?.ArraySize && csrPointers.ArraySize > 1) {
      // CSR: rows are features, so this gives feature count, not barcodes
      // But CSRIndices max value + 1 would give barcode count
    }

    // Calculate from block size as last resort
    if (barcodesBlock && barcodesBlock.ArrayWidth && barcodesBlock.ArrayWidth > 0) {
      const blockSize = barcodesBlock.End - barcodesBlock.Start;
      if (blockSize > 0) {
        return Math.floor(blockSize / barcodesBlock.ArrayWidth);
      }
    }
    if (barcodeNamesBlock && barcodeNamesBlock.ArrayWidth && barcodeNamesBlock.ArrayWidth > 0) {
      const blockSize = barcodeNamesBlock.End - barcodeNamesBlock.Start;
      if (blockSize > 0) {
        return Math.floor(blockSize / barcodeNamesBlock.ArrayWidth);
      }
    }

    return 0;
  }

  /**
   * Gets the barcode block information
   * Note: Uses Barcodes or BarcodeNames field
   */
  private get barcodeBlock() {
    return this.matrixInfo.Barcodes ?? this.matrixInfo.BarcodeNames;
  }

  /**
   * Checks if barcode data is available
   */
  get isAvailable(): boolean {
    return this.barcodeBlock !== undefined;
  }

  /**
   * Reads all barcodes (cached after first read)
   */
  async readAll(): Promise<string[]> {
    if (this.cachedBarcodes) {
      return this.cachedBarcodes;
    }

    const barcodes = await this.read();
    this.cachedBarcodes = barcodes;
    return barcodes;
  }

  /**
   * Reads barcodes with optional pagination
   * @param options - Pagination options (offset, limit)
   */
  async read(options?: PaginationOptions): Promise<string[]> {
    const block = this.barcodeBlock;

    if (!block) {
      throw new CloupeError("Barcode data not available in this file", CloupeErrorCode.NOT_FOUND);
    }

    const { offset = 0, limit } = options ?? {};
    const totalCount = block.ArraySize;
    const width = block.ArrayWidth;

    // Calculate actual range to read
    const startIndex = Math.max(0, Math.min(offset, totalCount));
    const endIndex = limit !== undefined ? Math.min(startIndex + limit, totalCount) : totalCount;
    const readCount = endIndex - startIndex;

    if (readCount <= 0) {
      return [];
    }

    // Helper to read all barcodes (handles CompressionType=2)
    const readAllBarcodes = async (): Promise<string[]> => {
      if (block.CompressionType === CompressionType.BLOCK && block.Index) {
        return this.blockReader.readFixedStringsFromBlock(block);
      }
      return this.blockReader.readFixedStrings(block.Start, block.End, width, totalCount);
    };

    // If reading all data, use the full block
    if (startIndex === 0 && endIndex === totalCount) {
      return readAllBarcodes();
    }

    // For partial reads, we need to read the entire block first due to compression
    // This is a limitation - partial reads from compressed blocks aren't efficient
    const allBarcodes = await readAllBarcodes();

    return allBarcodes.slice(startIndex, endIndex);
  }

  /**
   * Reads a single barcode by index
   */
  async readOne(index: number): Promise<string> {
    const block = this.barcodeBlock;

    if (!block) {
      throw new CloupeError("Barcode data not available in this file", CloupeErrorCode.NOT_FOUND);
    }

    if (index < 0 || index >= block.ArraySize) {
      throw new CloupeError(
        `Barcode index ${index} out of range [0, ${block.ArraySize})`,
        CloupeErrorCode.INVALID_DATA
      );
    }

    // Use cached data if available
    if (this.cachedBarcodes) {
      return this.cachedBarcodes[index];
    }

    // Load all barcodes (due to compression)
    const barcodes = await this.readAll();
    return barcodes[index];
  }

  /**
   * Reads multiple barcodes by indices
   */
  async readByIndices(indices: number[]): Promise<string[]> {
    if (indices.length === 0) {
      return [];
    }

    // Load all barcodes and select
    const barcodes = await this.readAll();
    return indices.map((i) => {
      if (i < 0 || i >= barcodes.length) {
        throw new CloupeError(
          `Barcode index ${i} out of range [0, ${barcodes.length})`,
          CloupeErrorCode.INVALID_DATA
        );
      }
      return barcodes[i];
    });
  }

  /**
   * Searches for barcodes matching a pattern
   * Note: Requires loading all barcodes for full search
   */
  async search(pattern: string | RegExp): Promise<{ index: number; barcode: string }[]> {
    const barcodes = await this.readAll();
    const regex = typeof pattern === "string" ? new RegExp(pattern) : pattern;

    const results: { index: number; barcode: string }[] = [];
    for (let i = 0; i < barcodes.length; i++) {
      if (regex.test(barcodes[i])) {
        results.push({ index: i, barcode: barcodes[i] });
      }
    }

    return results;
  }

  /**
   * Clears the cached barcodes
   */
  clearCache(): void {
    this.cachedBarcodes = null;
  }
}
