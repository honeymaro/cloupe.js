/**
 * Type definitions for cloupe.js
 *
 * Based on reverse-engineering of .cloupe file format from:
 * - cellgeni/cloupe (Python parser)
 * - 10XGenomics/loupeR (R package)
 * - Actual file structure analysis
 */

// ============================================================================
// Header Types
// ============================================================================

/**
 * Block location in the file (byte offsets)
 */
export interface BlockLocation {
  Start: number;
  End: number;
  Kind?: number;
  ArraySize?: number;
  ArrayWidth?: number;
  CompressionType?: number;
  Index?: BlockLocation | null;
}

/**
 * File header structure (first 4096 bytes as JSON)
 */
export interface CloupeHeader {
  version: string;
  headerSize?: number;
  blockOffset?: number;
  indexBlock: BlockLocation;
  nextHeaderOffset?: number;
  timestamp?: string;
  p1?: number;
  p2?: number;
  mode?: number;
}

// ============================================================================
// Index Block Types
// ============================================================================

/**
 * Run metadata from the analysis pipeline
 */
export interface Run {
  Name: string;
  Description?: string;
  Uuid?: string;
  FormatVersion?: string;
  Metadata?: BlockLocation | null;
  [key: string]: unknown;
}

/**
 * Metrics/statistics for the dataset
 */
export interface Metrics {
  Name?: string;
  Uuid?: string;
  Contents?: BlockLocation;
  [key: string]: unknown;
}

/**
 * Matrix block information for sparse data
 */
export interface MatrixBlock extends BlockLocation {
  ArraySize: number;
  ArrayWidth: number;
}

/**
 * Matrix metadata including barcodes, features, and expression data
 * Note: Uses CSC (Compressed Sparse Column) format, not CSR
 */
export interface MatrixInfo {
  Name: string;
  Uuid?: string;
  FormatVersion?: string;
  ParentUuid?: string;
  Reference?: string;
  GeneCount: number;
  CellCount: number;
  Metadata?: BlockLocation | null;
  Barcodes?: MatrixBlock;
  BarcodeNames?: MatrixBlock;
  Genes?: MatrixBlock;
  GeneNames?: MatrixBlock;
  FeatureTypes?: MatrixBlock;
  // CSC format (Column-compressed)
  CSCValues?: MatrixBlock;
  CSCPointers?: MatrixBlock;
  CSCIndices?: MatrixBlock;
  // Legacy CSR format
  CSRValues?: MatrixBlock;
  CSRPointers?: MatrixBlock;
  CSRIndices?: MatrixBlock;
  UMICounts?: MatrixBlock;
  // Alternative field names (compatibility)
  Rows?: number;
  Columns?: number;
  Features?: MatrixBlock;
  FeatureNames?: MatrixBlock;
  [key: string]: unknown;
}

/**
 * Projection (dimensionality reduction) metadata
 */
export interface ProjectionInfo {
  Name: string;
  Uuid?: string;
  FormatVersion?: string;
  ParentUuid?: string;
  Key?: string;
  Metadata?: BlockLocation | null;
  Dims: number[];
  Matrix: MatrixBlock;
  /** Scale factor for spatial projections (microns per pixel) */
  MicronsPerPixel?: number;
  /** Projection type: 1=t-SNE, 2=UMAP, 3=Spatial, 4=Fiducials */
  Type?: number;
  [key: string]: unknown;
}

/**
 * Clustering result (e.g., Graph-based, K-means)
 */
export interface ClusteringInfo {
  Name: string;
  Uuid?: string;
  FormatVersion?: string;
  ParentUuid?: string;
  Metadata?: BlockLocation;
  Assignments?: MatrixBlock;
  [key: string]: unknown;
}

/**
 * Analysis results container
 */
export interface Analysis {
  Name: string;
  Uuid?: string;
  FormatVersion?: string;
  Projections?: ProjectionInfo[];
  [key: string]: unknown;
}

/**
 * Cell track (user annotations/clusters)
 */
export interface CellTrackInfo {
  Name: string;
  Uuid?: string;
  FormatVersion?: string;
  ParentUuid?: string;
  Key?: string;
  NumCategories?: number;
  Metadata?: BlockLocation;
  Categories?: MatrixBlock;
  Values?: MatrixBlock;
  [key: string]: unknown;
}

/**
 * Differential expression results
 */
export interface DiffExpInfo {
  Name: string;
  Uuid?: string;
  FormatVersion?: string;
  ParentUuid?: string;
  Metadata?: BlockLocation;
  Assignments?: MatrixBlock;
  GeneIndices?: MatrixBlock;
  [key: string]: unknown;
}

/**
 * Complete index block structure
 */
export interface IndexBlock {
  Uuid?: string;
  FormatVersion?: string;
  Runs?: Run[];
  Matrices?: MatrixInfo[];
  Submatrices?: MatrixInfo[];
  Analyses?: Analysis[];
  Projections?: ProjectionInfo[];
  Clusterings?: ClusteringInfo[];
  CellTracks?: CellTrackInfo[];
  GeneTracks?: unknown[];
  Metrics?: Metrics[];
  GeneLists?: unknown[];
  DiffExps?: DiffExpInfo[];
  SpatialImages?: SpatialImageInfo[];
  SpatialImageTiles?: SpatialImageTilesInfo[];
  [key: string]: unknown;
}

// ============================================================================
// Data Types
// ============================================================================

/**
 * Feature (gene/protein) information
 */
export interface Feature {
  index: number;
  id: string;
  name: string;
  type?: string;
}

/**
 * Projection coordinates for visualization
 */
export class Projection {
  readonly name: string;
  readonly key?: string;
  readonly dimensions: number;
  readonly coordinates: Float64Array[];

  constructor(data: {
    name: string;
    key?: string;
    dimensions: number;
    coordinates: Float64Array[];
  }) {
    this.name = data.name;
    this.key = data.key;
    this.dimensions = data.dimensions;
    this.coordinates = data.coordinates;
  }

  /**
   * Gets the number of points in this projection
   */
  get numPoints(): number {
    return this.coordinates.length > 0 ? this.coordinates[0].length : 0;
  }

  /**
   * Gets coordinates for a specific cell index
   */
  getCoordinates(cellIndex: number): number[] | null {
    if (cellIndex < 0 || cellIndex >= this.numPoints) {
      return null;
    }
    return this.coordinates.map((coords) => coords[cellIndex]);
  }

  /**
   * Gets the bounding box of this projection
   */
  getBounds(): { min: number[]; max: number[] } {
    const min: number[] = [];
    const max: number[] = [];

    for (const coords of this.coordinates) {
      let dimMin = Infinity;
      let dimMax = -Infinity;

      for (let i = 0; i < coords.length; i++) {
        const val = coords[i];
        if (val < dimMin) dimMin = val;
        if (val > dimMax) dimMax = val;
      }

      min.push(dimMin === Infinity ? 0 : dimMin);
      max.push(dimMax === -Infinity ? 0 : dimMax);
    }

    return { min, max };
  }
}

/**
 * Cell track (cluster assignments or annotations)
 */
export class CellTrack {
  readonly name: string;
  readonly key?: string;
  readonly values: Int16Array | Int32Array;
  readonly categories: string[];

  constructor(data: {
    name: string;
    key?: string;
    values: Int16Array | Int32Array;
    categories?: string[];
  }) {
    this.name = data.name;
    this.key = data.key;
    this.values = data.values;
    this.categories = data.categories ?? [];
  }

  /**
   * Gets unique categories and their counts (includes unused categories with 0)
   */
  getCategoryCounts(): Record<string | number, number> {
    const counts: Record<string | number, number> = {};

    // Initialize all defined categories with 0
    for (const category of this.categories) {
      counts[category] = 0;
    }

    // Count actual values
    for (let i = 0; i < this.values.length; i++) {
      const categoryIndex = this.values[i];
      const label =
        this.categories.length > 0 && categoryIndex >= 0 && categoryIndex < this.categories.length
          ? this.categories[categoryIndex]
          : categoryIndex;

      counts[label] = (counts[label] ?? 0) + 1;
    }

    return counts;
  }

  /**
   * Gets cells belonging to a specific category
   */
  getCellsInCategory(category: string | number): number[] {
    let targetIndex: number;

    if (typeof category === "string") {
      targetIndex = this.categories.indexOf(category);
      if (targetIndex === -1) {
        return [];
      }
    } else {
      targetIndex = category;
    }

    const cells: number[] = [];
    for (let i = 0; i < this.values.length; i++) {
      if (this.values[i] === targetIndex) {
        cells.push(i);
      }
    }

    return cells;
  }

  /**
   * Gets the category label for a specific cell index
   */
  getCategoryForCell(cellIndex: number): string | number | null {
    if (cellIndex < 0 || cellIndex >= this.values.length) {
      return null;
    }

    const categoryIndex = this.values[cellIndex];

    if (
      this.categories.length > 0 &&
      categoryIndex >= 0 &&
      categoryIndex < this.categories.length
    ) {
      return this.categories[categoryIndex];
    }

    return categoryIndex;
  }
}

/**
 * Clustering result with assignments
 */
export class Clustering {
  readonly name: string;
  readonly assignments: Int16Array | Int32Array;
  readonly numClusters: number;
  readonly metadata?: Record<string, unknown>;

  constructor(data: {
    name: string;
    assignments: Int16Array | Int32Array;
    numClusters?: number;
    metadata?: Record<string, unknown>;
  }) {
    this.name = data.name;
    this.assignments = data.assignments;
    this.metadata = data.metadata;

    // Calculate numClusters if not provided
    if (data.numClusters !== undefined) {
      this.numClusters = data.numClusters;
    } else {
      let max = 0;
      for (let i = 0; i < data.assignments.length; i++) {
        if (data.assignments[i] > max) {
          max = data.assignments[i];
        }
      }
      this.numClusters = max + 1;
    }
  }

  /**
   * Gets the number of cells
   */
  get numCells(): number {
    return this.assignments.length;
  }

  /**
   * Gets the cluster ID for a specific cell
   */
  getClusterForCell(cellIndex: number): number | null {
    if (cellIndex < 0 || cellIndex >= this.assignments.length) {
      return null;
    }
    return this.assignments[cellIndex];
  }

  /**
   * Gets all cell indices belonging to a specific cluster
   */
  getCellsInCluster(clusterId: number): number[] {
    const cells: number[] = [];
    for (let i = 0; i < this.assignments.length; i++) {
      if (this.assignments[i] === clusterId) {
        cells.push(i);
      }
    }
    return cells;
  }

  /**
   * Gets the count of cells in each cluster
   */
  getClusterCounts(): Map<number, number> {
    const counts = new Map<number, number>();
    for (let i = 0; i < this.assignments.length; i++) {
      const clusterId = this.assignments[i];
      counts.set(clusterId, (counts.get(clusterId) ?? 0) + 1);
    }
    return counts;
  }

  /**
   * Gets unique cluster IDs sorted
   */
  getUniqueClusterIds(): number[] {
    const unique = new Set<number>();
    for (let i = 0; i < this.assignments.length; i++) {
      unique.add(this.assignments[i]);
    }
    return Array.from(unique).sort((a, b) => a - b);
  }
}

/**
 * CSR (Compressed Sparse Row) matrix format
 * - indptr: row pointers (length = numRows + 1)
 * - indices: column indices for each non-zero value
 * - data: non-zero values
 */
export interface SparseMatrix {
  data: Float64Array;
  indices: Uint32Array;
  indptr: Uint32Array;
  shape: [number, number];
}

/**
 * CSC (Compressed Sparse Column) matrix format
 * This is the native storage format of .cloupe files
 * - indptr: column pointers (length = numCols + 1)
 * - indices: row indices for each non-zero value
 * - data: non-zero values
 */
export interface SparseMatrixCSC {
  data: Float64Array;
  indices: Uint32Array;
  indptr: Uint32Array;
  shape: [number, number];
}

/**
 * Single row of sparse matrix
 */
export interface SparseRow {
  featureIndex: number;
  indices: Uint32Array;
  values: Float64Array;
}

/**
 * Single column of sparse matrix
 */
export interface SparseColumn {
  barcodeIndex: number;
  indices: Uint32Array;
  values: Float64Array;
}

// ============================================================================
// API Options
// ============================================================================

/**
 * Options for paginated data retrieval
 */
export interface PaginationOptions {
  offset?: number;
  limit?: number;
}

/**
 * Options for matrix slice retrieval
 */
export interface SliceOptions {
  rowStart?: number;
  rowEnd?: number;
  colStart?: number;
  colEnd?: number;
}

// ============================================================================
// Spatial Image Types
// ============================================================================

/**
 * Spatial Image metadata from index block
 */
export interface SpatialImageInfo {
  Name: string;
  Uuid?: string;
  FormatVersion?: string;
  ParentUuid?: string;
  Metadata?: BlockLocation | null;
  Dims: [number, number]; // [width, height]
  Format: string; // "png"
  ImageData?: BlockLocation | null;
  ImagePath?: string;
  Checksum?: string;
  Channel?: number;
  Type?: string; // "brightfield", "fluorescence"
  [key: string]: unknown;
}

/**
 * Spatial Image Tiles metadata from index block
 */
export interface SpatialImageTilesInfo {
  Name: string;
  Uuid?: string;
  FormatVersion?: string;
  ParentUuid?: string;
  Metadata?: BlockLocation | null;
  Format: string; // "png"
  Dims: [number, number]; // [width, height]
  TileSize: number;
  TileOverlap?: number;
  Tiles: Record<string, BlockLocation>; // "level/x_y.png" -> BlockLocation
  TilesPath?: string;
  [key: string]: unknown;
}

/**
 * Zoom level information for spatial image tiles
 */
export interface ZoomLevelInfo {
  level: number;
  gridWidth: number; // number of tiles horizontally
  gridHeight: number; // number of tiles vertically
  tileCount: number;
}

/**
 * Spatial Image data class with tile pyramid support
 */
export class SpatialImage {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly format: string;
  readonly type: string;
  readonly tileSize: number;
  readonly tileOverlap: number;
  readonly zoomLevels: ZoomLevelInfo[];
  readonly minZoom: number;
  readonly maxZoom: number;

  constructor(data: {
    name: string;
    width: number;
    height: number;
    format: string;
    type: string;
    tileSize: number;
    tileOverlap: number;
    zoomLevels: ZoomLevelInfo[];
  }) {
    this.name = data.name;
    this.width = data.width;
    this.height = data.height;
    this.format = data.format;
    this.type = data.type;
    this.tileSize = data.tileSize;
    this.tileOverlap = data.tileOverlap;
    this.zoomLevels = data.zoomLevels;

    // Calculate min/max zoom from zoom levels
    if (data.zoomLevels.length > 0) {
      this.minZoom = Math.min(...data.zoomLevels.map((z) => z.level));
      this.maxZoom = Math.max(...data.zoomLevels.map((z) => z.level));
    } else {
      this.minZoom = 0;
      this.maxZoom = 0;
    }
  }

  /**
   * Gets zoom level info by level number
   */
  getZoomLevel(level: number): ZoomLevelInfo | null {
    return this.zoomLevels.find((z) => z.level === level) ?? null;
  }

  /**
   * Generates a tile key for the given coordinates
   */
  getTileKey(level: number, x: number, y: number): string {
    return `${level}/${x}_${y}.png`;
  }

  /**
   * Converts pixel coordinates to tile coordinates at a given zoom level
   */
  coordsToTile(level: number, pixelX: number, pixelY: number): { x: number; y: number } | null {
    const zoomInfo = this.getZoomLevel(level);
    if (!zoomInfo) return null;

    const x = Math.floor(pixelX / this.tileSize);
    const y = Math.floor(pixelY / this.tileSize);

    return { x, y };
  }

  /**
   * Gets the total number of tiles across all zoom levels
   */
  get totalTileCount(): number {
    return this.zoomLevels.reduce((sum, z) => sum + z.tileCount, 0);
  }
}

// ============================================================================
// Compression Types
// ============================================================================

/**
 * Compression types used in .cloupe files
 */
export enum CompressionType {
  NONE = 0,
  GZIP = 1,
  BLOCK = 2,
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Custom error for cloupe file parsing
 */
export class CloupeError extends Error {
  constructor(
    message: string,
    public readonly code: CloupeErrorCode,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "CloupeError";
  }
}

export enum CloupeErrorCode {
  INVALID_HEADER = "INVALID_HEADER",
  INVALID_INDEX = "INVALID_INDEX",
  DECOMPRESSION_FAILED = "DECOMPRESSION_FAILED",
  INVALID_DATA = "INVALID_DATA",
  FILE_READ_ERROR = "FILE_READ_ERROR",
  NOT_FOUND = "NOT_FOUND",
  UNSUPPORTED_COMPRESSION = "UNSUPPORTED_COMPRESSION",
}
