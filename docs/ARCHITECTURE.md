# cloupe.js Architecture Document

## 1. Overview

cloupe.js is a JavaScript library for reading .cloupe files (used by 10x Genomics Loupe Browser) in browser environments.

### Reference Libraries

- [cellgeni/cloupe](https://github.com/cellgeni/cloupe) - Python-based .cloupe file parser
- [LinearParadox/loupepy](https://github.com/LinearParadox/loupepy) - AnnData → .cloupe conversion
- [10XGenomics/loupeR](https://github.com/10XGenomics/loupeR) - Seurat → .cloupe conversion (R)

### Core Design Principles

1. **Lazy Loading**: Read only the data that is needed
2. **Streaming**: Don't load the entire file into memory
3. **Browser-first**: Random access based on File API

---

## 2. .cloupe File Structure

### File Layout

```
┌─────────────────────────────────┐
│ Header (4096 bytes, JSON)       │  ← Version, index block location
├─────────────────────────────────┤
│ Index Block (JSON, gzip)        │  ← Offsets for all data sections
├─────────────────────────────────┤
│ Data Blocks                     │
│  ├─ Runs (metadata)             │
│  ├─ Metrics (quality metrics)   │
│  ├─ Projections (UMAP, t-SNE)   │
│  ├─ Matrices (CSC sparse)       │
│  │   ├─ Barcodes                │
│  │   ├─ Features (Genes)        │
│  │   └─ Expression data         │
│  ├─ Clusterings                 │
│  └─ CellTracks (annotations)    │
└─────────────────────────────────┘
```

### Header Structure (4096 bytes)

```json
{
  "version": "string",
  "indexBlock": {
    "Start": number,
    "End": number
  },
  "nextHeaderOffset": number
}
```

### Data Types

| Data                        | Byte Format        | Description     |
| --------------------------- | ------------------ | --------------- |
| Strings (barcodes/features) | UTF-8, NULL padded | Fixed width     |
| Projection coordinates      | double (8B)        | Float64         |
| UMI counts                  | uint64 (8B)        | Unsigned 64-bit |
| CellTrack values            | int16 (2B)         | Signed 16-bit   |
| CSC indices/pointers        | uint64 (8B)        | Unsigned 64-bit |

### Compression

- **CompressionType=0**: No compression
- **CompressionType=1**: Standard gzip (magic bytes: `0x1F 0x8B`)
- **CompressionType=2**: Block-indexed compression (multiple gzip blocks with index)
- Each block is compressed independently

---

## 3. Module Structure

```
src/
├── core/
│   ├── CloupeReader.ts       # Main entry point
│   ├── HeaderParser.ts       # Header parsing
│   ├── IndexParser.ts        # Index block parsing
│   └── BlockReader.ts        # Block reading + decompression
├── data/
│   ├── MatrixReader.ts       # CSC/CSR sparse matrix
│   ├── ProjectionReader.ts   # UMAP/t-SNE coordinates
│   ├── BarcodeReader.ts      # Barcode data
│   ├── FeatureReader.ts      # Gene/feature data
│   ├── CellTrackReader.ts    # Cluster/annotation data
│   └── SparseMatrix.ts       # Sparse matrix utilities
├── utils/
│   ├── BinaryReader.ts       # DataView wrapper
│   ├── Decompressor.ts       # gzip decompression
│   └── validation.ts         # Data validation
├── worker/
│   ├── cloupe.worker.ts      # Web Worker implementation
│   └── WorkerClient.ts       # Worker client interface
├── types/
│   └── index.ts              # TypeScript type definitions
└── index.ts                  # Public exports
```

---

## 4. API Design

### Main Class

```typescript
class CloupeReader {
  static async open(file: File | Blob): Promise<CloupeReader>;

  // Metadata (immediately available)
  get version(): string;
  get barcodeCount(): number;
  get featureCount(): number;
  get projectionNames(): string[];
  get cellTrackNames(): string[];
  get clusteringNames(): string[];

  // Lazy loading methods
  getBarcodes(options?: PaginationOptions): Promise<string[]>;
  getFeatures(options?: PaginationOptions): Promise<Feature[]>;
  getProjection(name: string): Promise<Projection>;
  getDefaultProjection(): Promise<Projection | null>;
  getCellTrack(name: string): Promise<CellTrack>;

  // Sparse matrix access
  getFeatureExpression(featureIndex: number): Promise<SparseRow>;
  getCellExpression(barcodeIndex: number): Promise<SparseColumn>;
  getExpressionValue(featureIndex: number, barcodeIndex: number): Promise<number>;
  getExpressionMatrix(): Promise<SparseMatrix>;
  getExpressionMatrixCSC(): Promise<SparseMatrixCSC>;
  getExpressionSlice(options: SliceOptions): Promise<SparseMatrix>;

  // High-level analysis
  getExpressionByFeatureName(featureName: string): Promise<SparseRow | null>;
  getCellsInCluster(trackName: string, category: string | number): Promise<number[]>;
  getClusterExpression(featureName: string, trackName: string, category: string | number): Promise<{...} | null>;

  // Summary
  getSummary(): Promise<FileSummary>;

  // Cleanup
  clearCache(): void;
  close(): void;
}
```

### Type Definitions

```typescript
interface Feature {
  id: string;
  name: string;
  type?: string;
}

interface Projection {
  name: string;
  key?: string;
  dimensions: number;
  coordinates: Float64Array[];
}

interface CellTrack {
  name: string;
  key?: string;
  values: Int16Array | Int32Array;
  categories?: string[];
}

interface SparseMatrix {
  data: Float64Array;
  indices: Uint32Array;
  indptr: Uint32Array;
  shape: [number, number];
}

interface SparseMatrixCSC {
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

---

## 5. Technology Stack

| Category        | Choice         | Reason                           |
| --------------- | -------------- | -------------------------------- |
| Language        | TypeScript 5.x | Type safety                      |
| Bundler         | Vite           | Native ESM, fast builds          |
| Compression     | fflate         | Lightweight and fast (29KB)      |
| Testing         | Vitest         | Vite integration, fast execution |
| Package Manager | pnpm           | Fast and efficient               |

---

## 6. Development Phases

### Phase 1: Core Infrastructure

- Project setup (TypeScript, Vite, test environment)
- BinaryReader utility implementation
- Decompressor implementation (gzip, block-indexed)
- BlockReader implementation (File API + decompression)
- HeaderParser implementation (4096-byte header)
- IndexParser implementation (index block parsing)

### Phase 2: Data Readers

- BarcodeReader implementation
- FeatureReader implementation (with search)
- ProjectionReader implementation (UMAP/t-SNE)
- CellTrackReader implementation

### Phase 3: Matrix Reader

- CSC Sparse Matrix parser implementation
- CSC to CSR conversion
- Row/column partial queries
- Range slicing

### Phase 4: Optimization and Finalization

- Web Worker support
- Caching layer
- Error handling and validation
- Documentation and examples

---

## 7. Key Implementation Details

### Matrix Format

The .cloupe file stores expression matrices in **CSC (Compressed Sparse Column)** format:

- `CSCValues`: Non-zero values (Float64)
- `CSCIndices`: Row indices for each value (Uint64)
- `CSCPointers`: Column pointers (Uint64)
- `Shape`: [numFeatures, numBarcodes]

The library converts CSC to CSR internally for efficient row-based access.

### Block-Indexed Compression (CompressionType=2)

Large data blocks use block-indexed compression:

- Data is split into multiple gzip-compressed blocks (~65KB decompressed each)
- An `Index` block contains byte offsets for each compressed block
- Index format: `[blockSize, offset0, offset1, ..., offsetN]`
- Enables random access without decompressing entire block

### Projection Dimensions

The `Dims` array in ProjectionInfo follows the format `[numDimensions, numPoints]`:

- Example: `[2, 8414]` means 2D projection with 8414 points
- Data is stored in column-major order

---

## 8. Considerations

### Licensing

- This project is based on reverse engineering (no official 10x documentation)
- Reference: cellgeni/cloupe uses AGPL-3.0

### Technical Constraints

- Version compatibility not guaranteed across .cloupe versions
- Memory management required for large file processing
- Full matrix loading can be slow for large datasets

### Browser Limitations

- File API slice() performance varies by browser
- SharedArrayBuffer requires CORS headers (Cross-Origin-Opener-Policy, Cross-Origin-Embedder-Policy)
- Web Worker usage recommended for large operations

---

## 9. Usage Example

```typescript
import { CloupeReader } from "cloupe.js";

// Open file
const reader = await CloupeReader.open(file);

// Get summary
const summary = await reader.getSummary();
console.log(`Cells: ${summary.barcodeCount}, Genes: ${summary.featureCount}`);

// Read projections
const projection = await reader.getDefaultProjection();
if (projection) {
  console.log(`${projection.name}: ${projection.coordinates[0].length} points`);
}

// Search for a gene
const results = await reader.features.search("CD3");
for (const { index, feature } of results) {
  console.log(`${feature.name} at index ${index}`);
}

// Get expression for a specific gene
const expression = await reader.getExpressionByFeatureName("CD3D");
if (expression) {
  console.log(`Non-zero values: ${expression.values.length}`);
}

// Clean up
reader.close();
```
