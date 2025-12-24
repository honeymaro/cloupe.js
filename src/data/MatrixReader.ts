/**
 * MatrixReader - Reads expression matrix data from .cloupe files
 *
 * The .cloupe file stores expression matrices in CSC (Compressed Sparse Column)
 * format where:
 * - CSCValues: non-zero values
 * - CSCIndices: row indices for each value
 * - CSCPointers: column pointers (start index in data/indices for each column)
 * - Shape: [numGenes, numCells] (features x barcodes)
 *
 * This reader provides efficient access to both row (feature) and column (cell) data.
 */

import {
  CloupeError,
  CloupeErrorCode,
  type SparseMatrix,
  type SparseRow,
  type SparseColumn,
  type SliceOptions,
  type MatrixInfo,
  type MatrixBlock,
} from "../types/index.js";
import type { BlockReader } from "../core/BlockReader.js";
import * as Sparse from "./SparseMatrix.js";

/**
 * Reads expression matrix data from a .cloupe file
 */
export class MatrixReader {
  private blockReader: BlockReader;
  private matrixInfo: MatrixInfo;

  // Cached data (lazy loaded)
  private cachedColptr: Uint32Array | null = null;
  private cachedMatrix: SparseMatrix | null = null;
  private cachedUmiCounts: Float64Array | null = null;

  // Cached CSC components (for efficient row queries without full CSR conversion)
  private cachedCSCValues: Float64Array | null = null;
  private cachedCSCIndices: Uint32Array | null = null;

  constructor(blockReader: BlockReader, matrixInfo: MatrixInfo) {
    this.blockReader = blockReader;
    this.matrixInfo = matrixInfo;
  }

  /**
   * Gets the matrix shape [numFeatures, numBarcodes]
   */
  get shape(): [number, number] {
    let numFeatures = this.matrixInfo.GeneCount ?? this.matrixInfo.Rows ?? 0;
    let numBarcodes = this.matrixInfo.CellCount ?? this.matrixInfo.Columns ?? 0;

    // Fallback to data block sizes if counts are 0
    if (numBarcodes === 0 && this.pointersBlock) {
      // For CSC: numColumns = pointers.length - 1
      numBarcodes = this.pointersBlock.ArraySize - 1;
    }
    if (numFeatures === 0) {
      // Try to get feature count from various block metadata
      const featureBlock =
        this.matrixInfo.Genes ??
        this.matrixInfo.GeneNames ??
        this.matrixInfo.Features ??
        this.matrixInfo.FeatureNames;
      if (featureBlock?.ArraySize) {
        numFeatures = featureBlock.ArraySize;
      }
    }

    return [numFeatures, numBarcodes];
  }

  /**
   * Gets the number of features (rows)
   */
  get numFeatures(): number {
    return this.shape[0];
  }

  /**
   * Gets the number of barcodes (columns)
   */
  get numBarcodes(): number {
    return this.shape[1];
  }

  /**
   * Checks if CSC matrix data is available
   */
  get hasCSCData(): boolean {
    return !!(
      this.matrixInfo.CSCValues &&
      this.matrixInfo.CSCPointers &&
      this.matrixInfo.CSCIndices
    );
  }

  /**
   * Checks if legacy CSR matrix data is available
   */
  get hasCSRData(): boolean {
    return !!(
      this.matrixInfo.CSRValues &&
      this.matrixInfo.CSRPointers &&
      this.matrixInfo.CSRIndices
    );
  }

  /**
   * Checks if UMI counts are available
   */
  get hasUmiCounts(): boolean {
    return !!this.matrixInfo.UMICounts;
  }

  /**
   * Gets the values block (CSC or CSR)
   */
  private get valuesBlock() {
    return this.matrixInfo.CSCValues ?? this.matrixInfo.CSRValues;
  }

  /**
   * Gets the pointers block (CSC or CSR)
   */
  private get pointersBlock() {
    return this.matrixInfo.CSCPointers ?? this.matrixInfo.CSRPointers;
  }

  /**
   * Gets the indices block (CSC or CSR)
   */
  private get indicesBlock() {
    return this.matrixInfo.CSCIndices ?? this.matrixInfo.CSRIndices;
  }

  /**
   * Checks if matrix is in CSC format (column-compressed)
   */
  get isCSC(): boolean {
    return !!this.matrixInfo.CSCValues;
  }

  /**
   * Loads the column pointers for CSC matrix (or row pointers for CSR)
   */
  async loadPointers(): Promise<Uint32Array> {
    if (this.cachedColptr) {
      return this.cachedColptr;
    }

    const pointersBlock = this.pointersBlock;
    if (!pointersBlock) {
      throw new CloupeError("Matrix pointers not available", CloupeErrorCode.NOT_FOUND);
    }

    // Pointers are stored as uint64 or int32
    const rawPointers = await this.blockReader.readUint64Array(
      pointersBlock.Start,
      pointersBlock.End,
      pointersBlock.ArraySize
    );

    // Convert to Uint32Array
    this.cachedColptr = new Uint32Array(rawPointers.length);
    for (let i = 0; i < rawPointers.length; i++) {
      this.cachedColptr[i] = rawPointers[i];
    }

    return this.cachedColptr;
  }

  /**
   * Reads the full CSR matrix (use with caution for large datasets)
   * Note: CSC format is converted to CSR for consistency
   */
  async readFullMatrix(): Promise<SparseMatrix> {
    if (this.cachedMatrix) {
      return this.cachedMatrix;
    }

    if (!this.valuesBlock || !this.pointersBlock || !this.indicesBlock) {
      throw new CloupeError("Full matrix data not available", CloupeErrorCode.NOT_FOUND);
    }

    const [pointers, data, indices] = await Promise.all([
      this.loadPointers(),
      this.loadValues(),
      this.loadIndices(),
    ]);

    if (this.isCSC) {
      // Convert CSC to CSR for consistent API
      this.cachedMatrix = this.cscToCSR(data, indices, pointers);
    } else {
      this.cachedMatrix = {
        data,
        indices,
        indptr: pointers,
        shape: this.shape,
      };
    }

    return this.cachedMatrix;
  }

  /**
   * Converts CSC to CSR format
   */
  private cscToCSR(
    cscData: Float64Array,
    cscRowIndices: Uint32Array,
    cscColPtr: Uint32Array
  ): SparseMatrix {
    const [numRows, numCols] = this.shape;
    const nnz = cscData.length;

    // Count non-zeros per row
    const rowCounts = new Uint32Array(numRows);
    for (let i = 0; i < nnz; i++) {
      rowCounts[cscRowIndices[i]]++;
    }

    // Build row pointers
    const csrRowPtr = new Uint32Array(numRows + 1);
    for (let i = 0; i < numRows; i++) {
      csrRowPtr[i + 1] = csrRowPtr[i] + rowCounts[i];
    }

    // Build CSR arrays
    const csrData = new Float64Array(nnz);
    const csrColIndices = new Uint32Array(nnz);
    const currentPos = new Uint32Array(numRows);

    for (let col = 0; col < numCols; col++) {
      const colStart = cscColPtr[col];
      const colEnd = cscColPtr[col + 1];

      for (let i = colStart; i < colEnd; i++) {
        const row = cscRowIndices[i];
        const pos = csrRowPtr[row] + currentPos[row];
        csrData[pos] = cscData[i];
        csrColIndices[pos] = col;
        currentPos[row]++;
      }
    }

    return {
      data: csrData,
      indices: csrColIndices,
      indptr: csrRowPtr,
      shape: [numRows, numCols],
    };
  }

  /**
   * Loads matrix values
   */
  private async loadValues(): Promise<Float64Array> {
    const valuesBlock = this.valuesBlock;
    if (!valuesBlock) {
      throw new CloupeError("Matrix values not available", CloupeErrorCode.NOT_FOUND);
    }

    // Use block-indexed decompression if available
    if (valuesBlock.CompressionType === 2 && valuesBlock.Index) {
      return this.blockReader.readFloat64ArrayFromBlock(valuesBlock);
    }

    return this.blockReader.readFloat64Array(
      valuesBlock.Start,
      valuesBlock.End,
      valuesBlock.ArraySize
    );
  }

  /**
   * Loads matrix indices
   */
  private async loadIndices(): Promise<Uint32Array> {
    const indicesBlock = this.indicesBlock;
    if (!indicesBlock) {
      throw new CloupeError("Matrix indices not available", CloupeErrorCode.NOT_FOUND);
    }

    let rawIndices: Float64Array;

    // Use block-indexed decompression if available
    if (indicesBlock.CompressionType === 2 && indicesBlock.Index) {
      rawIndices = await this.blockReader.readUint64ArrayFromBlock(indicesBlock);
    } else {
      rawIndices = await this.blockReader.readUint64Array(
        indicesBlock.Start,
        indicesBlock.End,
        indicesBlock.ArraySize
      );
    }

    // Convert to Uint32Array
    const indices = new Uint32Array(rawIndices.length);
    for (let i = 0; i < rawIndices.length; i++) {
      indices[i] = rawIndices[i];
    }

    return indices;
  }

  /**
   * Reads UMI counts for all barcodes
   */
  async readUmiCounts(): Promise<Float64Array> {
    if (this.cachedUmiCounts) {
      return this.cachedUmiCounts;
    }

    const umiBlock = this.matrixInfo.UMICounts;
    if (!umiBlock) {
      throw new CloupeError("UMI counts not available in this matrix", CloupeErrorCode.NOT_FOUND);
    }

    this.cachedUmiCounts = await this.blockReader.readUint64Array(
      umiBlock.Start,
      umiBlock.End,
      umiBlock.ArraySize
    );

    return this.cachedUmiCounts;
  }

  /**
   * Loads CSC values with caching
   */
  private async loadCSCValues(): Promise<Float64Array> {
    if (this.cachedCSCValues) {
      return this.cachedCSCValues;
    }
    this.cachedCSCValues = await this.loadValues();
    return this.cachedCSCValues;
  }

  /**
   * Loads CSC indices with caching
   */
  private async loadCSCIndices(): Promise<Uint32Array> {
    if (this.cachedCSCIndices) {
      return this.cachedCSCIndices;
    }
    this.cachedCSCIndices = await this.loadIndices();
    return this.cachedCSCIndices;
  }

  /**
   * Reads a single row (feature) from the matrix
   * @param featureIndex - Index of the feature/gene
   */
  async readRow(featureIndex: number): Promise<SparseRow> {
    if (featureIndex < 0 || featureIndex >= this.numFeatures) {
      throw new CloupeError(
        `Feature index ${featureIndex} out of range [0, ${this.numFeatures})`,
        CloupeErrorCode.INVALID_DATA
      );
    }

    // If full matrix is cached, use it (fastest)
    if (this.cachedMatrix) {
      return Sparse.getRow(this.cachedMatrix, featureIndex);
    }

    // CSR format: direct row access with selective block decompression (FAST!)
    if (this.hasCSRData) {
      return this.readRowFromCSR(featureIndex);
    }

    // CSC format: need to scan all columns (slower)
    if (this.isCSC) {
      return this.readRowFromCSC(featureIndex);
    }

    // Fallback: load full matrix
    const matrix = await this.readFullMatrix();
    return Sparse.getRow(matrix, featureIndex);
  }

  /**
   * Cached CSR pointers for fast row access
   */
  private cachedCSRPointers: Uint32Array | null = null;

  /**
   * Reads CSR pointers (uncompressed, small - only ~145KB for 18K features)
   */
  private async loadCSRPointers(): Promise<Uint32Array> {
    if (this.cachedCSRPointers) {
      return this.cachedCSRPointers;
    }

    const pointersBlock = this.matrixInfo.CSRPointers;
    if (!pointersBlock) {
      throw new CloupeError("CSR pointers not available", CloupeErrorCode.NOT_FOUND);
    }

    // CSRPointers is uncompressed (CompressionType: 0)
    const rawPointers = await this.blockReader.readUint64Array(
      pointersBlock.Start,
      pointersBlock.End,
      pointersBlock.ArraySize
    );

    // Convert to Uint32Array
    this.cachedCSRPointers = new Uint32Array(rawPointers.length);
    for (let i = 0; i < rawPointers.length; i++) {
      this.cachedCSRPointers[i] = rawPointers[i];
    }

    return this.cachedCSRPointers;
  }

  /**
   * Reads a row directly from CSR format with selective block decompression
   * Only decompresses the blocks containing the target row's data
   */
  private async readRowFromCSR(featureIndex: number): Promise<SparseRow> {
    const pointers = await this.loadCSRPointers();

    const rowStart = pointers[featureIndex];
    const rowEnd = pointers[featureIndex + 1];
    const nnz = rowEnd - rowStart;

    if (nnz === 0) {
      return {
        featureIndex,
        indices: new Uint32Array(0),
        values: new Float64Array(0),
      };
    }

    const [indices, values] = await Promise.all([
      this.readCSRSlice(this.matrixInfo.CSRIndices!, rowStart, rowEnd),
      this.readCSRValuesSlice(this.matrixInfo.CSRValues!, rowStart, rowEnd),
    ]);

    return {
      featureIndex,
      indices,
      values,
    };
  }

  /**
   * Reads a slice of CSR indices using selective block decompression
   */
  private async readCSRSlice(block: MatrixBlock, start: number, end: number): Promise<Uint32Array> {
    const indexBlock = block.Index;
    if (!indexBlock || block.CompressionType !== 2) {
      // Fallback: read full and slice
      const full = await this.loadIndices();
      return full.slice(start, end);
    }

    // Read the block index
    const indexData = await this.blockReader.readAsUint8Array(indexBlock.Start, indexBlock.End);
    const indexView = new DataView(indexData.buffer, indexData.byteOffset, indexData.byteLength);
    const indexCount = indexBlock.ArraySize ?? Math.floor(indexData.length / 8);

    // Parse index: [decompressedBlockSize, offset1, offset2, ...]
    const blockOffsets: number[] = [];
    for (let i = 0; i < indexCount; i++) {
      const low = indexView.getUint32(i * 8, true);
      const high = indexView.getUint32(i * 8 + 4, true);
      blockOffsets.push(low + high * 0x100000000);
    }

    const decompressedBlockSize = blockOffsets[0]; // Typically 65280
    const compressedOffsets = blockOffsets.slice(1);

    // Calculate which blocks we need (8 bytes per uint64)
    const startByte = start * 8;
    const endByte = end * 8;
    const startBlock = Math.floor(startByte / decompressedBlockSize);
    const endBlock = Math.floor((endByte - 1) / decompressedBlockSize);

    // Read and decompress only needed blocks
    const compressedData = await this.blockReader.readAsUint8Array(block.Start, block.End);
    const decompressedChunks: Uint8Array[] = [];

    for (let b = startBlock; b <= endBlock && b < compressedOffsets.length; b++) {
      const cStart = compressedOffsets[b];
      const cEnd =
        b < compressedOffsets.length - 1 ? compressedOffsets[b + 1] : compressedData.length;
      const chunkData = compressedData.subarray(cStart, cEnd);

      try {
        const { gunzipSync } = await import("fflate");
        decompressedChunks.push(gunzipSync(chunkData));
      } catch {
        // Skip failed blocks
      }
    }

    // Concatenate and extract the slice
    let totalLen = 0;
    for (const chunk of decompressedChunks) totalLen += chunk.length;
    const fullDecompressed = new Uint8Array(totalLen);
    let offset = 0;
    for (const chunk of decompressedChunks) {
      fullDecompressed.set(chunk, offset);
      offset += chunk.length;
    }

    // Calculate offset within decompressed blocks
    const blockStartByte = startBlock * decompressedBlockSize;
    const sliceStart = startByte - blockStartByte;

    const view = new DataView(
      fullDecompressed.buffer,
      fullDecompressed.byteOffset,
      fullDecompressed.byteLength
    );
    const result = new Uint32Array(end - start);
    for (let i = 0; i < result.length; i++) {
      const bytePos = sliceStart + i * 8;
      if (bytePos + 8 <= fullDecompressed.length) {
        const low = view.getUint32(bytePos, true);
        result[i] = low; // Only need lower 32 bits for column indices
      }
    }

    return result;
  }

  /**
   * Reads a slice of CSR values using selective block decompression
   */
  private async readCSRValuesSlice(
    block: MatrixBlock,
    start: number,
    end: number
  ): Promise<Float64Array> {
    const indexBlock = block.Index;
    if (!indexBlock || block.CompressionType !== 2) {
      // Fallback: read full and slice
      const full = await this.loadValues();
      return full.slice(start, end);
    }

    // Read the block index
    const indexData = await this.blockReader.readAsUint8Array(indexBlock.Start, indexBlock.End);
    const indexView = new DataView(indexData.buffer, indexData.byteOffset, indexData.byteLength);
    const indexCount = indexBlock.ArraySize ?? Math.floor(indexData.length / 8);

    // Parse index
    const blockOffsets: number[] = [];
    for (let i = 0; i < indexCount; i++) {
      const low = indexView.getUint32(i * 8, true);
      const high = indexView.getUint32(i * 8 + 4, true);
      blockOffsets.push(low + high * 0x100000000);
    }

    const decompressedBlockSize = blockOffsets[0];
    const compressedOffsets = blockOffsets.slice(1);

    // Calculate which blocks we need (8 bytes per float64)
    const startByte = start * 8;
    const endByte = end * 8;
    const startBlock = Math.floor(startByte / decompressedBlockSize);
    const endBlock = Math.floor((endByte - 1) / decompressedBlockSize);

    // Read and decompress only needed blocks
    const compressedData = await this.blockReader.readAsUint8Array(block.Start, block.End);
    const decompressedChunks: Uint8Array[] = [];

    for (let b = startBlock; b <= endBlock && b < compressedOffsets.length; b++) {
      const cStart = compressedOffsets[b];
      const cEnd =
        b < compressedOffsets.length - 1 ? compressedOffsets[b + 1] : compressedData.length;
      const chunkData = compressedData.subarray(cStart, cEnd);

      try {
        const { gunzipSync } = await import("fflate");
        decompressedChunks.push(gunzipSync(chunkData));
      } catch {
        // Skip failed blocks
      }
    }

    // Concatenate
    let totalLen = 0;
    for (const chunk of decompressedChunks) totalLen += chunk.length;
    const fullDecompressed = new Uint8Array(totalLen);
    let offset = 0;
    for (const chunk of decompressedChunks) {
      fullDecompressed.set(chunk, offset);
      offset += chunk.length;
    }

    // Extract slice
    const blockStartByte = startBlock * decompressedBlockSize;
    const sliceStart = startByte - blockStartByte;

    const view = new DataView(
      fullDecompressed.buffer,
      fullDecompressed.byteOffset,
      fullDecompressed.byteLength
    );
    const result = new Float64Array(end - start);
    for (let i = 0; i < result.length; i++) {
      const bytePos = sliceStart + i * 8;
      if (bytePos + 8 <= fullDecompressed.length) {
        result[i] = view.getFloat64(bytePos, true);
      }
    }

    return result;
  }

  /**
   * Reads a row directly from CSC format without full CSR conversion
   * This is more efficient for single/few row queries as it avoids the expensive conversion
   */
  private async readRowFromCSC(featureIndex: number): Promise<SparseRow> {
    const [pointers, values, indices] = await Promise.all([
      this.loadPointers(),
      this.loadCSCValues(),
      this.loadCSCIndices(),
    ]);

    const numCols = this.numBarcodes;
    // Scan through columns to find entries for this row
    // Pre-allocate with estimated capacity
    const colIndices: number[] = [];
    const rowValues: number[] = [];

    for (let col = 0; col < numCols; col++) {
      const colStart = pointers[col];
      const colEnd = pointers[col + 1];

      // Binary search within column for the target row (indices are sorted within column)
      let lo = colStart;
      let hi = colEnd;

      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (indices[mid] < featureIndex) {
          lo = mid + 1;
        } else {
          hi = mid;
        }
      }

      // Check if we found the target row
      if (lo < colEnd && indices[lo] === featureIndex) {
        colIndices.push(col);
        rowValues.push(values[lo]);
      }
    }

    return {
      featureIndex,
      indices: new Uint32Array(colIndices),
      values: new Float64Array(rowValues),
    };
  }

  /**
   * Reads multiple rows efficiently
   * For many rows, this may trigger full matrix caching for better subsequent access
   */
  async readRows(featureIndices: number[]): Promise<SparseRow[]> {
    // If full matrix is cached, use it
    if (this.cachedMatrix) {
      return featureIndices.map((idx) => Sparse.getRow(this.cachedMatrix!, idx));
    }

    // For few rows on CSC format, read directly without full conversion
    // Threshold: if reading more than 10% of rows, full matrix is more efficient
    if (this.isCSC && featureIndices.length < this.numFeatures * 0.1) {
      return Promise.all(featureIndices.map((idx) => this.readRowFromCSC(idx)));
    }

    // For many rows, load full matrix (CSR is better for row access)
    const matrix = await this.readFullMatrix();
    return featureIndices.map((idx) => Sparse.getRow(matrix, idx));
  }

  /**
   * Reads a single column (barcode) from the matrix
   * Note: More efficient for CSC format
   */
  async readColumn(barcodeIndex: number): Promise<SparseColumn> {
    if (barcodeIndex < 0 || barcodeIndex >= this.numBarcodes) {
      throw new CloupeError(
        `Barcode index ${barcodeIndex} out of range [0, ${this.numBarcodes})`,
        CloupeErrorCode.INVALID_DATA
      );
    }

    // If CSC format, we can read column directly
    if (this.isCSC && !this.cachedMatrix) {
      return this.readColumnDirect(barcodeIndex);
    }

    const matrix = await this.readFullMatrix();
    return Sparse.getColumn(matrix, barcodeIndex);
  }

  /**
   * Reads a column directly from CSC format using cached data
   */
  private async readColumnDirect(barcodeIndex: number): Promise<SparseColumn> {
    // Load CSC components (cached for subsequent queries)
    const [colPtr, values, indices] = await Promise.all([
      this.loadPointers(),
      this.loadCSCValues(),
      this.loadCSCIndices(),
    ]);

    const colStart = colPtr[barcodeIndex];
    const colEnd = colPtr[barcodeIndex + 1];
    const nnz = colEnd - colStart;

    if (nnz === 0) {
      return {
        barcodeIndex,
        indices: new Uint32Array(0),
        values: new Float64Array(0),
      };
    }

    // Extract slice from cached arrays
    return {
      barcodeIndex,
      indices: indices.slice(colStart, colEnd),
      values: values.slice(colStart, colEnd),
    };
  }

  /**
   * Reads multiple columns
   */
  async readColumns(barcodeIndices: number[]): Promise<SparseColumn[]> {
    if (this.isCSC && !this.cachedMatrix) {
      return Promise.all(barcodeIndices.map((idx) => this.readColumnDirect(idx)));
    }

    const matrix = await this.readFullMatrix();
    return barcodeIndices.map((idx) => Sparse.getColumn(matrix, idx));
  }

  /**
   * Reads a single value from the matrix
   */
  async getValue(featureIndex: number, barcodeIndex: number): Promise<number> {
    const row = await this.readRow(featureIndex);

    // Binary search for the column index
    let lo = 0;
    let hi = row.indices.length;

    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (row.indices[mid] < barcodeIndex) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }

    if (lo < row.indices.length && row.indices[lo] === barcodeIndex) {
      return row.values[lo];
    }

    return 0;
  }

  /**
   * Reads a submatrix slice
   */
  async readSlice(options: SliceOptions): Promise<SparseMatrix> {
    const matrix = await this.readFullMatrix();
    return Sparse.slice(matrix, options);
  }

  /**
   * Reads specific rows and columns as a submatrix
   */
  async readSubmatrix(featureIndices: number[], barcodeIndices: number[]): Promise<SparseMatrix> {
    const matrix = await this.readFullMatrix();
    const rowSlice = Sparse.getRows(matrix, featureIndices);
    return Sparse.getColumns(rowSlice, barcodeIndices);
  }

  /**
   * Gets expression values for a specific feature across cells in a cluster
   */
  async getExpressionForCells(featureIndex: number, cellIndices: number[]): Promise<Float64Array> {
    const row = await this.readRow(featureIndex);

    // Create a lookup map from column index to value
    const valueMap = new Map<number, number>();
    for (let i = 0; i < row.indices.length; i++) {
      valueMap.set(row.indices[i], row.values[i]);
    }

    // Get values for requested cells
    const result = new Float64Array(cellIndices.length);
    for (let i = 0; i < cellIndices.length; i++) {
      result[i] = valueMap.get(cellIndices[i]) ?? 0;
    }

    return result;
  }

  /**
   * Gets statistics about the matrix
   */
  async getStats(): Promise<{
    shape: [number, number];
    nnz: number;
    sparsity: number;
    avgNnzPerRow: number;
  }> {
    const pointers = await this.loadPointers();
    const nnz = pointers[pointers.length - 1];
    const [numRows, numCols] = this.shape;
    const total = numRows * numCols;

    return {
      shape: this.shape,
      nnz,
      sparsity: total > 0 ? 1 - nnz / total : 0,
      avgNnzPerRow: numRows > 0 ? nnz / numRows : 0,
    };
  }

  /**
   * Clears all cached data
   */
  clearCache(): void {
    this.cachedColptr = null;
    this.cachedMatrix = null;
    this.cachedUmiCounts = null;
    this.cachedCSCValues = null;
    this.cachedCSCIndices = null;
    this.cachedCSRPointers = null;
  }
}
