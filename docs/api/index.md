# API Reference

Documentation for all public APIs in cloupe.js.

## Main Class

### CloupeReader

The main class for reading .cloupe files.

```typescript
import { CloupeReader } from "cloupe";

const reader = await CloupeReader.open(file);
```

See [CloupeReader](/api/cloupe-reader) for details.

## Specialized Readers

CloupeReader internally uses the following specialized readers. You can access them directly for more fine-grained control.

| Reader                                                  | Description                 | Access                 |
| ------------------------------------------------------- | --------------------------- | ---------------------- |
| [BarcodeReader](/api/readers/barcode-reader)            | Read cell barcodes          | `reader.barcodes`      |
| [FeatureReader](/api/readers/feature-reader)            | Read gene/protein info      | `reader.features`      |
| [ProjectionReader](/api/readers/projection-reader)      | Read UMAP/t-SNE coordinates | `reader.projections`   |
| [CellTrackReader](/api/readers/cell-track-reader)       | Read clusters/annotations   | `reader.cellTracks`    |
| [MatrixReader](/api/readers/matrix-reader)              | Read expression matrix      | `reader.matrix`        |
| [SpatialImageReader](/api/readers/spatial-image-reader) | Read spatial H&E images     | `reader.spatialImages` |

## Data Classes

### Projection

Class containing projection coordinates.

```typescript
class Projection {
  readonly name: string;
  readonly dimensions: number;
  readonly coordinates: Float64Array[];

  get numPoints(): number;
  getCoordinates(cellIndex: number): number[] | null;
  getBounds(): { min: number[]; max: number[] };
}
```

### CellTrack

Class containing cell track (cluster/annotation) data.

```typescript
class CellTrack {
  readonly name: string;
  readonly values: Int16Array | Int32Array;
  readonly categories: string[];

  getCategoryCounts(): Record<string | number, number>;
  getCellsInCategory(category: string | number): number[];
  getCategoryForCell(cellIndex: number): string | number | null;
}
```

### SpatialImage

Class containing spatial H&E image metadata.

```typescript
class SpatialImage {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly format: string;
  readonly type: string; // "brightfield" or "fluorescence"
  readonly tileSize: number;
  readonly tileOverlap: number;
  readonly zoomLevels: ZoomLevelInfo[];
  readonly minZoom: number;
  readonly maxZoom: number;

  getZoomLevel(level: number): ZoomLevelInfo | null;
  getTileKey(level: number, x: number, y: number): string;
  coordsToTile(level: number, pixelX: number, pixelY: number): { x: number; y: number };
}
```

## Interfaces

See [Types](/api/types) for detailed type definitions.

### Data Types

```typescript
interface Feature {
  index: number;
  id: string;
  name: string;
  type?: string;
}

interface SparseMatrix {
  data: Float64Array;
  indices: Uint32Array;
  indptr: Uint32Array;
  shape: [number, number];
}

interface SparseRow {
  featureIndex: number;
  indices: Uint32Array;
  values: Float64Array;
}

interface SparseColumn {
  barcodeIndex: number;
  indices: Uint32Array;
  values: Float64Array;
}
```

### Option Types

```typescript
interface PaginationOptions {
  offset?: number;
  limit?: number;
}

interface SliceOptions {
  rowStart?: number;
  rowEnd?: number;
  colStart?: number;
  colEnd?: number;
}
```

## Error Handling

```typescript
class CloupeError extends Error {
  readonly code: CloupeErrorCode;
  readonly cause?: unknown;
}

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

## Web Worker

```typescript
import { CloupeWorkerClient } from "cloupe";

const worker = new Worker(new URL("cloupe/worker", import.meta.url), { type: "module" });
const client = new CloupeWorkerClient(worker);
```

See [Web Worker Examples](/examples/web-worker) for details.
