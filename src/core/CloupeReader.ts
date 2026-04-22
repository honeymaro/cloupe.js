/**
 * CloupeReader - Main entry point for reading .cloupe files
 *
 * Provides a unified API for accessing all data in a .cloupe file including:
 * - Barcodes (cell identifiers)
 * - Features (genes/proteins)
 * - Projections (UMAP, t-SNE coordinates)
 * - Cell tracks (clusters, annotations)
 * - Clusterings (graph-based, k-means, etc.)
 * - Expression matrix (sparse CSC format)
 */

import {
  CloupeError,
  CloupeErrorCode,
  Clustering,
  SpatialImage,
  type CloupeHeader,
  type IndexBlock,
  type Feature,
  type Projection,
  type CellTrack,
  type SparseMatrix,
  type SparseMatrixCSC,
  type SparseRow,
  type SparseColumn,
  type PaginationOptions,
  type SliceOptions,
} from "../types/index.js";
import { BlockReader } from "./BlockReader.js";
import { parseHeader } from "./HeaderParser.js";
import {
  parseIndex,
  getPrimaryMatrix,
  extractProjections,
  extractCellTracks,
  extractClusterings,
  extractSpatialImages,
} from "./IndexParser.js";
import { BarcodeReader } from "../data/BarcodeReader.js";
import { FeatureReader } from "../data/FeatureReader.js";
import { ProjectionReader } from "../data/ProjectionReader.js";
import { CellTrackReader } from "../data/CellTrackReader.js";
import { ClusteringReader } from "../data/ClusteringReader.js";
import { MatrixReader } from "../data/MatrixReader.js";
import { SpatialImageReader } from "../data/SpatialImageReader.js";

/**
 * Main class for reading .cloupe files
 */
export class CloupeReader {
  private blockReader: BlockReader;
  private header: CloupeHeader;
  private indexBlock: IndexBlock;

  // Lazy-initialized readers
  private _barcodeReader: BarcodeReader | null = null;
  private _featureReader: FeatureReader | null = null;
  private _projectionReader: ProjectionReader | null = null;
  private _cellTrackReader: CellTrackReader | null = null;
  private _clusteringReader: ClusteringReader | null = null;
  private _matrixReader: MatrixReader | null = null;
  private _spatialImageReader: SpatialImageReader | null = null;

  private constructor(blockReader: BlockReader, header: CloupeHeader, indexBlock: IndexBlock) {
    this.blockReader = blockReader;
    this.header = header;
    this.indexBlock = indexBlock;
  }

  /**
   * Opens a .cloupe file and returns a CloupeReader instance
   * @param source - File, Blob, or URL string containing .cloupe data
   *
   * When a URL is provided, HTTP Range Requests are used for efficient
   * partial file reading. The server must support Range requests.
   */
  static async open(source: File | Blob | string): Promise<CloupeReader> {
    let blockReader: BlockReader;

    if (typeof source === "string") {
      // URL provided - use Range Requests
      blockReader = await BlockReader.fromUrl(source);
    } else {
      // File or Blob provided
      blockReader = new BlockReader(source);
    }

    // Parse header
    const header = await parseHeader(blockReader);

    // Parse index block
    const indexBlock = await parseIndex(blockReader, header.indexBlock);

    return new CloupeReader(blockReader, header, indexBlock);
  }

  // ============================================================================
  // Metadata Properties
  // ============================================================================

  /**
   * Gets the file format version
   */
  get version(): string {
    return this.header.version;
  }

  /**
   * Gets the total file size in bytes
   */
  get fileSize(): number {
    return this.blockReader.size;
  }

  /**
   * Gets the number of barcodes (cells)
   * Uses comprehensive fallback logic from BarcodeReader
   */
  get barcodeCount(): number {
    // Quick check for explicit counts first
    const matrix = getPrimaryMatrix(this.indexBlock);
    if (matrix?.CellCount && matrix.CellCount > 0) {
      return matrix.CellCount;
    }
    if (matrix?.Columns && matrix.Columns > 0) {
      return matrix.Columns;
    }
    // Use reader's comprehensive fallback logic
    try {
      return this.barcodes.count;
    } catch {
      return 0;
    }
  }

  /**
   * Gets the number of features (genes/proteins)
   * Uses comprehensive fallback logic from FeatureReader
   */
  get featureCount(): number {
    // Quick check for explicit counts first
    const matrix = getPrimaryMatrix(this.indexBlock);
    if (matrix?.GeneCount && matrix.GeneCount > 0) {
      return matrix.GeneCount;
    }
    if (matrix?.Rows && matrix.Rows > 0) {
      return matrix.Rows;
    }
    // Use reader's comprehensive fallback logic
    try {
      return this.features.count;
    } catch {
      return 0;
    }
  }

  /**
   * Gets available projection names
   */
  get projectionNames(): string[] {
    return extractProjections(this.indexBlock).map((p) => p.Name);
  }

  /**
   * Gets available cell track names
   */
  get cellTrackNames(): string[] {
    return extractCellTracks(this.indexBlock).map((ct) => ct.Name);
  }

  /**
   * Gets available clustering names
   */
  get clusteringNames(): string[] {
    return extractClusterings(this.indexBlock).map((c) => c.Name);
  }

  /**
   * Gets available spatial image names
   */
  get spatialImageNames(): string[] {
    return extractSpatialImages(this.indexBlock).map((s) => s.Name);
  }

  /**
   * Checks if the file contains spatial images (H&E)
   */
  get hasSpatialImages(): boolean {
    return this.spatialImageNames.length > 0;
  }

  /**
   * Gets the raw index block for advanced use
   */
  get rawIndex(): IndexBlock {
    return this.indexBlock;
  }

  /**
   * Gets the raw header for advanced use
   */
  get rawHeader(): CloupeHeader {
    return this.header;
  }

  // ============================================================================
  // Reader Accessors (Lazy Initialization)
  // ============================================================================

  /**
   * Gets the barcode reader
   */
  get barcodes(): BarcodeReader {
    if (!this._barcodeReader) {
      const matrix = getPrimaryMatrix(this.indexBlock);
      if (!matrix) {
        throw new CloupeError("No matrix data available in file", CloupeErrorCode.NOT_FOUND);
      }
      this._barcodeReader = new BarcodeReader(this.blockReader, matrix);
    }
    return this._barcodeReader;
  }

  /**
   * Gets the feature reader
   */
  get features(): FeatureReader {
    if (!this._featureReader) {
      const matrix = getPrimaryMatrix(this.indexBlock);
      if (!matrix) {
        throw new CloupeError("No matrix data available in file", CloupeErrorCode.NOT_FOUND);
      }
      this._featureReader = new FeatureReader(this.blockReader, matrix);
    }
    return this._featureReader;
  }

  /**
   * Gets the projection reader
   */
  get projections(): ProjectionReader {
    if (!this._projectionReader) {
      this._projectionReader = new ProjectionReader(this.blockReader, this.indexBlock);
    }
    return this._projectionReader;
  }

  /**
   * Gets the cell track reader
   */
  get cellTracks(): CellTrackReader {
    if (!this._cellTrackReader) {
      this._cellTrackReader = new CellTrackReader(this.blockReader, this.indexBlock);
    }
    return this._cellTrackReader;
  }

  /**
   * Gets the clustering reader
   */
  get clusterings(): ClusteringReader {
    if (!this._clusteringReader) {
      this._clusteringReader = new ClusteringReader(this.blockReader, this.indexBlock);
    }
    return this._clusteringReader;
  }

  /**
   * Gets the spatial image reader
   */
  get spatialImages(): SpatialImageReader {
    if (!this._spatialImageReader) {
      this._spatialImageReader = new SpatialImageReader(this.blockReader, this.indexBlock);
    }
    return this._spatialImageReader;
  }

  /**
   * Checks if matrix data is available in the file
   */
  get hasMatrixData(): boolean {
    const matrix = getPrimaryMatrix(this.indexBlock);
    if (!matrix) return false;
    // Check if matrix has actual data (CSC or CSR format)
    const hasCSC = !!(matrix.CSCValues && matrix.CSCPointers && matrix.CSCIndices);
    const hasCSR = !!(matrix.CSRValues && matrix.CSRPointers && matrix.CSRIndices);
    return hasCSC || hasCSR;
  }

  /**
   * Gets the matrix reader
   */
  get matrix(): MatrixReader {
    if (!this._matrixReader) {
      const matrix = getPrimaryMatrix(this.indexBlock);
      if (!matrix) {
        throw new CloupeError("No matrix data available in file", CloupeErrorCode.NOT_FOUND);
      }
      this._matrixReader = new MatrixReader(this.blockReader, matrix);
    }
    return this._matrixReader;
  }

  // ============================================================================
  // Convenience Methods (delegate to sub-readers)
  // ============================================================================

  /**
   * Gets barcodes with optional pagination
   */
  async getBarcodes(options?: PaginationOptions): Promise<string[]> {
    return this.barcodes.read(options);
  }

  /**
   * Gets features with optional pagination
   */
  async getFeatures(options?: PaginationOptions): Promise<Feature[]> {
    return this.features.read(options);
  }

  /**
   * Gets a projection by name
   */
  async getProjection(name: string): Promise<Projection> {
    return this.projections.read(name);
  }

  /**
   * Gets the default projection (usually UMAP or t-SNE)
   */
  async getDefaultProjection(): Promise<Projection | null> {
    return this.projections.readDefault();
  }

  /**
   * Gets a cell track by name
   */
  async getCellTrack(name: string): Promise<CellTrack> {
    return this.cellTracks.read(name);
  }

  /**
   * Gets a clustering by name
   */
  async getClustering(name: string): Promise<Clustering> {
    return this.clusterings.read(name);
  }

  /**
   * Gets a spatial image by name
   */
  async getSpatialImage(name: string): Promise<SpatialImage> {
    return this.spatialImages.read(name);
  }

  /**
   * Gets a spatial image tile
   */
  async getSpatialImageTile(
    name: string,
    level: number,
    x: number,
    y: number
  ): Promise<Uint8Array> {
    return this.spatialImages.getTile(name, level, x, y);
  }

  /**
   * Gets the thumbnail for the default spatial image
   */
  async getSpatialImageThumbnail(name?: string): Promise<Uint8Array | null> {
    if (!this.hasSpatialImages) return null;
    return this.spatialImages.getThumbnail(name);
  }

  /**
   * Gets expression data for a specific feature (gene)
   */
  async getFeatureExpression(featureIndex: number): Promise<SparseRow> {
    return this.matrix.readRow(featureIndex);
  }

  /**
   * Gets expression data for a specific barcode (cell)
   */
  async getCellExpression(barcodeIndex: number): Promise<SparseColumn> {
    return this.matrix.readColumn(barcodeIndex);
  }

  /**
   * Gets a single expression value
   */
  async getExpressionValue(featureIndex: number, barcodeIndex: number): Promise<number> {
    return this.matrix.getValue(featureIndex, barcodeIndex);
  }

  /**
   * Gets the full expression matrix (use with caution for large files)
   * Returns CSR (row-compressed) format, optimized for gene-wise access
   */
  async getExpressionMatrix(): Promise<SparseMatrix> {
    return this.matrix.readFullMatrix();
  }

  /**
   * Gets the full expression matrix in native CSC format (use with caution for large files)
   * Returns CSC (column-compressed) format, optimized for cell-wise access
   * More efficient than getExpressionMatrix() when you need CSC format directly
   *
   * @remarks Returned typed arrays share storage with internal caches; treat as read-only.
   */
  async getExpressionMatrixCSC(): Promise<SparseMatrixCSC> {
    return this.matrix.readFullMatrixCSC();
  }

  /**
   * Gets a slice of the expression matrix
   */
  async getExpressionSlice(options: SliceOptions): Promise<SparseMatrix> {
    return this.matrix.readSlice(options);
  }

  // ============================================================================
  // High-Level Analysis Methods
  // ============================================================================

  /**
   * Gets expression for a feature by name (gene symbol)
   */
  async getExpressionByFeatureName(featureName: string): Promise<SparseRow | null> {
    const result = await this.features.findByName(featureName);
    if (!result) {
      return null;
    }
    return this.matrix.readRow(result.index);
  }

  /**
   * Gets cells belonging to a specific cluster/category
   */
  async getCellsInCluster(trackName: string, category: string | number): Promise<number[]> {
    return this.cellTracks.getCellsInCategory(trackName, category);
  }

  /**
   * Gets expression for a gene in a specific cluster
   */
  async getClusterExpression(
    featureName: string,
    trackName: string,
    category: string | number
  ): Promise<{ cellIndices: number[]; values: Float64Array } | null> {
    const feature = await this.features.findByName(featureName);
    if (!feature) {
      return null;
    }

    const cellIndices = await this.getCellsInCluster(trackName, category);
    const values = await this.matrix.getExpressionForCells(feature.index, cellIndices);

    return { cellIndices, values };
  }

  /**
   * Gets summary statistics
   */
  async getSummary(): Promise<{
    version: string;
    fileSize: number;
    barcodeCount: number;
    featureCount: number;
    projections: string[];
    cellTracks: string[];
    clusterings: string[];
    spatialImages: string[];
    matrixStats: {
      shape: [number, number];
      nnz: number;
      sparsity: number;
    } | null;
  }> {
    let matrixStats = null;
    try {
      const stats = await this.matrix.getStats();
      matrixStats = {
        shape: stats.shape,
        nnz: stats.nnz,
        sparsity: stats.sparsity,
      };
    } catch {
      // Matrix stats not available
    }

    // Use reader counts which are more accurate (read from actual data blocks)
    let barcodeCount = this.barcodeCount;
    let featureCount = this.featureCount;

    // Fallback to reader counts if matrix counts are 0
    if (barcodeCount === 0) {
      try {
        barcodeCount = this.barcodes.count;
      } catch {
        // Barcode reader not available
      }
    }
    if (featureCount === 0) {
      try {
        featureCount = this.features.count;
      } catch {
        // Feature reader not available
      }
    }

    return {
      version: this.version,
      fileSize: this.fileSize,
      barcodeCount,
      featureCount,
      projections: this.projectionNames,
      cellTracks: this.cellTrackNames,
      clusterings: this.clusteringNames,
      spatialImages: this.spatialImageNames,
      matrixStats,
    };
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Clears all cached data to free memory
   */
  clearCache(): void {
    this._barcodeReader?.clearCache();
    this._featureReader?.clearCache();
    this._projectionReader?.clearCache();
    this._cellTrackReader?.clearCache();
    this._matrixReader?.clearCache();
    this._spatialImageReader?.clearCache();
    this._spatialImageReader?.clearTileCache();
  }

  /**
   * Closes the reader (for future cleanup if needed)
   */
  close(): void {
    this.clearCache();
  }
}
