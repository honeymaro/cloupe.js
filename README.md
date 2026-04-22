# cloupe.js

A JavaScript library for reading .cloupe files (10x Genomics Loupe Browser format) in the browser.

## Features

- **Browser-first**: Uses File API for random access without loading entire file into memory
- **Lazy loading**: Reads only the data you need
- **Full format support**: Barcodes, features, projections, cell tracks, clusterings, and expression matrices
- **TypeScript**: Full type definitions included
- **Web Worker support**: Offload heavy operations to background threads

## Installation

```bash
npm install cloupe.js
# or
pnpm add cloupe.js
# or
yarn add cloupe.js
```

## Quick Start

```typescript
import { CloupeReader } from "cloupe.js";

// Open a .cloupe file (from file input or drag-and-drop)
const reader = await CloupeReader.open(file);

// Get file summary
const summary = await reader.getSummary();
console.log(`Cells: ${summary.barcodeCount}, Genes: ${summary.featureCount}`);

// Read projection data (UMAP/t-SNE)
const projection = await reader.getDefaultProjection();
console.log(`${projection.name}: ${projection.coordinates[0].length} points`);

// Search for genes
const results = await reader.features.search("CD3");
console.log(`Found ${results.length} genes matching 'CD3'`);

// Get expression data for a specific gene
const expression = await reader.getExpressionByFeatureName("CD3D");
if (expression) {
  console.log(`CD3D has ${expression.values.length} non-zero values`);
}

// Clean up
reader.close();
```

## API Reference

### CloupeReader

Main class for reading .cloupe files.

```typescript
// Open a file
const reader = await CloupeReader.open(file: File | Blob);

// Metadata (immediately available after open)
reader.version          // File format version
reader.barcodeCount     // Number of cells
reader.featureCount     // Number of genes/features
reader.projectionNames  // Available projections (e.g., ['UMAP', 't-SNE'])
reader.cellTrackNames   // Available cell tracks
reader.clusteringNames  // Available clusterings
```

### Reading Data

```typescript
// Barcodes (cell identifiers)
const barcodes = await reader.getBarcodes();
const page = await reader.getBarcodes({ offset: 0, limit: 100 });

// Features (genes/proteins)
const features = await reader.getFeatures();
const feature = await reader.features.findByName("CD3D");

// Projections (UMAP, t-SNE, PCA)
const projection = await reader.getProjection("UMAP");
const defaultProj = await reader.getDefaultProjection();
const bounds = await reader.projections.getBounds("UMAP");

// Cell tracks (cluster assignments, annotations)
const track = await reader.getCellTrack("Cluster");
const cellIndices = await reader.getCellsInCluster("Cluster", "T cells");
```

### Expression Matrix

```typescript
// Get expression for a single gene (by index)
const row = await reader.getFeatureExpression(geneIndex);
// row.indices: cell indices with non-zero values
// row.values: expression values

// Get expression for a single gene (by name)
const row = await reader.getExpressionByFeatureName("CD3D");

// Get expression for a single cell
const col = await reader.getCellExpression(cellIndex);

// Get single value
const value = await reader.getExpressionValue(geneIndex, cellIndex);

// Get full matrix (use with caution for large files)
const matrix = await reader.getExpressionMatrix();

// Get matrix slice
const slice = await reader.getExpressionSlice({
  rowStart: 0,
  rowEnd: 100,
  colStart: 0,
  colEnd: 1000,
});
```

### Sub-readers

Access specialized readers for more control:

```typescript
reader.barcodes; // BarcodeReader
reader.features; // FeatureReader
reader.projections; // ProjectionReader
reader.cellTracks; // CellTrackReader
reader.matrix; // MatrixReader
```

### Summary

```typescript
const summary = await reader.getSummary();
// {
//   version: '0.7.0',
//   fileSize: 41297256,
//   barcodeCount: 8414,
//   featureCount: 32738,
//   projections: ['tsne'],
//   cellTracks: ['LibraryID', 'Cluster'],
//   clusterings: ['Graph-based', 'K-means (K=5)'],
//   matrixStats: {
//     shape: [32738, 8414],
//     nnz: 5445283,
//     sparsity: 0.98
//   }
// }
```

## Web Worker Usage

For large files, use the Web Worker client to avoid blocking the main thread:

```typescript
import { CloupeWorkerClient } from "cloupe.js";

// Create worker (you need to set up the worker URL with your bundler)
const worker = new Worker(new URL("cloupe/worker", import.meta.url));
const client = new CloupeWorkerClient(worker);

// Use the same API as CloupeReader
await client.open(file);
const summary = await client.getSummary();
const projection = await client.getProjection("UMAP");

// Clean up
await client.close();
client.terminate();
```

## Data Types

```typescript
interface Feature {
  id: string; // e.g., 'ENSG00000167286'
  name: string; // e.g., 'CD3D'
  type?: string; // e.g., 'Gene Expression'
}

interface Projection {
  name: string; // e.g., 'UMAP'
  dimensions: number; // Usually 2 or 3
  coordinates: Float64Array[]; // [x coords, y coords, ...]
}

interface CellTrack {
  name: string;
  values: Int16Array; // Category index for each cell
  categories?: string[]; // Category names
}

interface SparseRow {
  featureIndex: number;
  indices: Uint32Array; // Cell indices with non-zero values
  values: Float64Array; // Expression values
}

interface SparseMatrix {
  data: Float64Array; // Non-zero values
  indices: Uint32Array; // Column indices
  indptr: Uint32Array; // Row pointers
  shape: [number, number]; // [numFeatures, numBarcodes]
}
```

## Browser Support

- Chrome 76+
- Firefox 69+
- Safari 14+
- Edge 79+

Requires support for:

- File API with `slice()`
- `BigInt` (for uint64 values)
- `TextDecoder`

## File Format

This library reads .cloupe files created by 10x Genomics Cell Ranger pipeline and Loupe Browser. The format is reverse-engineered based on:

- [cellgeni/cloupe](https://github.com/cellgeni/cloupe) - Python parser
- [10XGenomics/loupeR](https://github.com/10XGenomics/loupeR) - R package for creating .cloupe files

### Supported Features

| Feature                   | Status    |
| ------------------------- | --------- |
| Header parsing            | Supported |
| Barcodes                  | Supported |
| Features (genes)          | Supported |
| Projections (UMAP, t-SNE) | Supported |
| Cell tracks               | Supported |
| Clusterings               | Supported |
| Expression matrix (CSC)   | Supported |
| Block-indexed compression | Supported |

## Performance Tips

1. **Use pagination** for large lists:

   ```typescript
   const barcodes = await reader.getBarcodes({ offset: 0, limit: 1000 });
   ```

2. **Access specific genes by name** instead of loading all:

   ```typescript
   const expression = await reader.getExpressionByFeatureName("CD3D");
   ```

3. **Use Web Workers** for heavy operations on large files

4. **Clear cache** when done with large data:
   ```typescript
   reader.clearCache();
   ```

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Build
pnpm build

# Type check
pnpm typecheck
```

## License

MIT

## Acknowledgments

- [cellgeni/cloupe](https://github.com/cellgeni/cloupe) for reverse-engineering the file format
- [fflate](https://github.com/101arrowz/fflate) for fast gzip decompression
