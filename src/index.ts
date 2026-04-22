/**
 * cloupe.js - TypeScript library for reading .cloupe files
 *
 * This library provides browser-compatible tools for reading 10x Genomics
 * Loupe Browser files (.cloupe) with support for lazy loading and partial
 * data access.
 *
 * @packageDocumentation
 */

// ============================================================================
// Main API
// ============================================================================

export { CloupeReader } from "./core/CloupeReader.js";

// ============================================================================
// Types
// ============================================================================

export {
  // Header and index types
  type BlockLocation,
  type CloupeHeader,
  type IndexBlock,
  type MatrixInfo,
  type MatrixBlock,
  type ProjectionInfo,
  type CellTrackInfo,
  type ClusteringInfo,
  type Analysis,
  type Run,
  type Metrics,

  // Data types
  type Feature,
  type Projection,
  type CellTrack,
  Clustering,
  type SparseMatrix,
  type SparseMatrixCSC,
  type SparseRow,
  type SparseColumn,

  // Spatial image types
  type SpatialImageInfo,
  type SpatialImageTilesInfo,
  type ZoomLevelInfo,
  SpatialImage,

  // Options
  type PaginationOptions,
  type SliceOptions,

  // Errors
  CloupeError,
  CloupeErrorCode,
} from "./types/index.js";

// ============================================================================
// Sub-readers (for advanced use)
// ============================================================================

export { BarcodeReader } from "./data/BarcodeReader.js";
export { FeatureReader } from "./data/FeatureReader.js";
export { ProjectionReader } from "./data/ProjectionReader.js";
export { CellTrackReader } from "./data/CellTrackReader.js";
export { ClusteringReader } from "./data/ClusteringReader.js";
export { MatrixReader } from "./data/MatrixReader.js";
export { SpatialImageReader } from "./data/SpatialImageReader.js";

// ============================================================================
// Sparse Matrix Utilities
// ============================================================================

export {
  getRow,
  getColumn,
  getValue,
  slice,
  getRows,
  getColumns,
  rowToDense,
  columnToDense,
  getMatrixStats,
  createEmptySparseMatrix,
} from "./data/SparseMatrix.js";

// ============================================================================
// Core Components (for advanced use)
// ============================================================================

export { BlockReader, type BlockReaderSource } from "./core/BlockReader.js";
export { HeaderParser, parseHeader, HEADER_SIZE } from "./core/HeaderParser.js";
export {
  IndexParser,
  parseIndex,
  extractProjections,
  extractCellTracks,
  extractSpatialImages,
  extractSpatialImageTiles,
  findProjection,
  findCellTrack,
  findSpatialImage,
  findSpatialImageTiles,
  findMatrix,
  getPrimaryMatrix,
  getIndexSummary,
} from "./core/IndexParser.js";

// ============================================================================
// Utilities
// ============================================================================

export { BinaryReader } from "./utils/BinaryReader.js";
export {
  decompress,
  decompressToArrayBuffer,
  decompressToString,
  decompressToJson,
  isGzipCompressed,
} from "./utils/Decompressor.js";

export {
  isValidBarcode,
  validateBarcodes,
  validateFeatures,
  validateCellTrack,
  validateProjection,
  validateSparseMatrix,
  isCloupeFile,
  MAX_CLUSTER_CATEGORIES,
} from "./utils/validation.js";

// ============================================================================
// Web Worker
// ============================================================================

export { CloupeWorkerClient } from "./worker/WorkerClient.js";
export type { WorkerFactory } from "./worker/WorkerClient.js";
export type { WorkerRequest, WorkerResponse } from "./worker/cloupe.worker.js";
