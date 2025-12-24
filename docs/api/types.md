# Types

TypeScript type definitions used in cloupe.js.

## Data Types

### Feature

Represents gene/protein information.

```typescript
interface Feature {
  index: number; // Index in matrix
  id: string; // Unique ID (e.g., ENSG00000167286)
  name: string; // Display name (e.g., CD3D)
  type?: string; // Type (e.g., Gene Expression, Antibody Capture)
}
```

### Projection

Class containing dimensionality reduction results.

```typescript
class Projection {
  readonly name: string; // Projection name (UMAP, t-SNE, etc.)
  readonly key?: string; // Internal key
  readonly dimensions: number; // Number of dimensions (usually 2 or 3)
  readonly coordinates: Float64Array[]; // Coordinate arrays [x[], y[], z?[]]

  // Properties
  get numPoints(): number; // Number of points

  // Methods
  getCoordinates(cellIndex: number): number[] | null;
  getBounds(): { min: number[]; max: number[] };
}
```

**Examples**

```typescript
const projection = await reader.getDefaultProjection();

// Access coordinates
const x = projection.coordinates[0]; // Float64Array
const y = projection.coordinates[1]; // Float64Array

// Get coordinates for a specific cell
const coords = projection.getCoordinates(0); // [x, y] or [x, y, z]

// Get bounds
const bounds = projection.getBounds();
// { min: [xMin, yMin], max: [xMax, yMax] }
```

### CellTrack

Class containing cell track (cluster, annotation, etc.) data.

```typescript
class CellTrack {
  readonly name: string; // Track name
  readonly key?: string; // Internal key
  readonly values: Int16Array | Int32Array; // Category index for each cell
  readonly categories: string[]; // Category name list

  // Methods
  getCategoryCounts(): Record<string | number, number>;
  getCellsInCategory(category: string | number): number[];
  getCategoryForCell(cellIndex: number): string | number | null;
}
```

**Examples**

```typescript
const track = await reader.getCellTrack("Cluster");

// Cell count by category
const counts = track.getCategoryCounts();
// { 'T cells': 1234, 'B cells': 567, ... }

// Cell indices for a specific category
const tCells = track.getCellsInCategory("T cells");
// [0, 5, 12, 45, ...]

// Category for a specific cell
const category = track.getCategoryForCell(0);
// 'T cells'
```

### SpatialImage

Class containing spatial H&E image metadata.

```typescript
class SpatialImage {
  readonly name: string; // Image name
  readonly width: number; // Original image width in pixels
  readonly height: number; // Original image height in pixels
  readonly format: string; // Image format (usually "png")
  readonly type: string; // "brightfield" or "fluorescence"
  readonly tileSize: number; // Tile size in pixels (usually 512)
  readonly tileOverlap: number; // Tile overlap in pixels
  readonly zoomLevels: ZoomLevelInfo[];
  readonly minZoom: number; // Minimum zoom level (thumbnail)
  readonly maxZoom: number; // Maximum zoom level (full resolution)

  // Methods
  getZoomLevel(level: number): ZoomLevelInfo | null;
  getTileKey(level: number, x: number, y: number): string;
  coordsToTile(level: number, pixelX: number, pixelY: number): { x: number; y: number };
}
```

**Examples**

```typescript
const image = await reader.spatialImages.read("Visium_HD_microscope.btf");

console.log(`Image size: ${image.width} x ${image.height}`);
console.log(`Tile size: ${image.tileSize}px`);
console.log(`Zoom range: ${image.minZoom} - ${image.maxZoom}`);

// Get zoom level info
const level = image.getZoomLevel(15);
console.log(`Level 15: ${level.gridWidth} x ${level.gridHeight} tiles`);

// Convert pixel coords to tile
const tile = image.coordsToTile(15, 5000, 3000);
console.log(`Tile: (${tile.x}, ${tile.y})`);
```

### ZoomLevelInfo

Information about a zoom level in a spatial image.

```typescript
interface ZoomLevelInfo {
  level: number; // Zoom level number
  gridWidth: number; // Number of tiles horizontally
  gridHeight: number; // Number of tiles vertically
  tileCount: number; // Total number of tiles at this level
}
```

### SpatialImageInfo

Spatial image metadata from the index block.

```typescript
interface SpatialImageInfo {
  Name: string;
  Uuid?: string;
  Dims: [number, number]; // [width, height]
  Format: string; // "png"
  Type?: string; // "brightfield" or "fluorescence"
  [key: string]: unknown;
}
```

### SpatialImageTilesInfo

Spatial image tiles metadata from the index block.

```typescript
interface SpatialImageTilesInfo {
  Name: string;
  TileSize: number; // Tile size in pixels
  TileOverlap?: number; // Tile overlap in pixels
  Tiles: Record<string, BlockLocation>; // "level/x_y.png" -> BlockLocation
  [key: string]: unknown;
}
```

### SparseMatrix

Sparse matrix in CSR/CSC format.

```typescript
interface SparseMatrix {
  data: Float64Array; // Non-zero values
  indices: Uint32Array; // Column (CSR) or row (CSC) indices
  indptr: Uint32Array; // Row (CSR) or column (CSC) pointers
  shape: [number, number]; // [rows, columns]
}
```

**CSR (Compressed Sparse Row) Format**

```
     col0 col1 col2 col3
row0 [ 1    0    2    0  ]
row1 [ 0    0    3    0  ]
row2 [ 4    5    0    6  ]

data:    [1, 2, 3, 4, 5, 6]
indices: [0, 2, 2, 0, 1, 3]  (column indices)
indptr:  [0, 2, 3, 6]        (start position of each row)
shape:   [3, 4]
```

### SparseRow

Expression data for a single gene.

```typescript
interface SparseRow {
  featureIndex: number; // Gene index
  indices: Uint32Array; // Cell indices with expression
  values: Float64Array; // Expression values
}
```

**Examples**

```typescript
const row = await reader.getExpressionByFeatureName("CD3D");

for (let i = 0; i < row.indices.length; i++) {
  const cellIndex = row.indices[i];
  const value = row.values[i];
  console.log(`Cell ${cellIndex}: ${value}`);
}
```

### SparseColumn

Expression profile for a single cell.

```typescript
interface SparseColumn {
  barcodeIndex: number; // Cell index
  indices: Uint32Array; // Gene indices with expression
  values: Float64Array; // Expression values
}
```

## Option Types

### PaginationOptions

Pagination options.

```typescript
interface PaginationOptions {
  offset?: number; // Start position (default: 0)
  limit?: number; // Number to read (default: all)
}
```

### SliceOptions

Matrix slice options.

```typescript
interface SliceOptions {
  rowStart?: number; // Start row (default: 0)
  rowEnd?: number; // End row (default: all)
  colStart?: number; // Start column (default: 0)
  colEnd?: number; // End column (default: all)
}
```

## File Structure Types

### CloupeHeader

File header structure.

```typescript
interface CloupeHeader {
  version: string;
  headerSize?: number;
  blockOffset?: number;
  indexBlock: BlockLocation;
  nextHeaderOffset?: number;
  timestamp?: string;
}
```

### BlockLocation

Block location information in the file.

```typescript
interface BlockLocation {
  Start: number;
  End: number;
  Kind?: number;
  ArraySize?: number;
  ArrayWidth?: number;
  CompressionType?: number;
  Index?: BlockLocation | null;
}
```

### IndexBlock

Index block structure.

```typescript
interface IndexBlock {
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
}
```

### MatrixInfo

Matrix metadata.

```typescript
interface MatrixInfo {
  Name: string;
  Uuid?: string;
  GeneCount: number;
  CellCount: number;
  Barcodes?: MatrixBlock;
  BarcodeNames?: MatrixBlock;
  Genes?: MatrixBlock;
  GeneNames?: MatrixBlock;
  CSCValues?: MatrixBlock;
  CSCPointers?: MatrixBlock;
  CSCIndices?: MatrixBlock;
  // ...
}
```

### ProjectionInfo

Projection metadata.

```typescript
interface ProjectionInfo {
  Name: string;
  Uuid?: string;
  Key?: string;
  Dims: number[]; // [dimensions, points]
  Matrix: MatrixBlock;
}
```

### CellTrackInfo

Cell track metadata.

```typescript
interface CellTrackInfo {
  Name: string;
  Uuid?: string;
  Key?: string;
  NumCategories?: number;
  Categories?: MatrixBlock;
  Values?: MatrixBlock;
}
```

## Error Types

### CloupeError

Custom error class for cloupe.js.

```typescript
class CloupeError extends Error {
  constructor(
    message: string,
    public readonly code: CloupeErrorCode,
    public readonly cause?: unknown
  );
}
```

### CloupeErrorCode

Error code enumeration.

```typescript
enum CloupeErrorCode {
  INVALID_HEADER = "INVALID_HEADER",
  INVALID_INDEX = "INVALID_INDEX",
  DECOMPRESSION_FAILED = "DECOMPRESSION_FAILED",
  INVALID_DATA = "INVALID_DATA",
  FILE_READ_ERROR = "FILE_READ_ERROR",
  NOT_FOUND = "NOT_FOUND",
  UNSUPPORTED_COMPRESSION = "UNSUPPORTED_COMPRESSION",
}
```

**Error Handling Examples**

```typescript
import { CloupeError, CloupeErrorCode } from "cloupe";

try {
  const reader = await CloupeReader.open(file);
} catch (error) {
  if (error instanceof CloupeError) {
    switch (error.code) {
      case CloupeErrorCode.INVALID_HEADER:
        console.error("Invalid .cloupe file");
        break;
      case CloupeErrorCode.DECOMPRESSION_FAILED:
        console.error("Failed to decompress data");
        break;
      default:
        console.error(error.message);
    }
  }
}
```

## Compression Types

```typescript
enum CompressionType {
  NONE = 0, // No compression
  GZIP = 1, // Standard gzip
  BLOCK = 2, // Block-indexed compression
}
```
