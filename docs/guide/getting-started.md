# Getting Started

This guide covers the basics of reading .cloupe files with cloupe.js.

## Basic Usage

### Opening a File

Use `CloupeReader.open()` to open a .cloupe file. It accepts File, Blob, or URL string as input.

```typescript
import { CloupeReader } from "cloupe";

// Get file from file input
const fileInput = document.querySelector('input[type="file"]');
fileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  const reader = await CloupeReader.open(file);

  // Use the file
  console.log(`Version: ${reader.version}`);

  // Clean up when done
  reader.close();
});
```

### Accessing Metadata

Metadata is immediately available after opening a file:

```typescript
const reader = await CloupeReader.open(file);

// Immediately available properties
console.log(`File version: ${reader.version}`);
console.log(`Number of cells: ${reader.barcodeCount}`);
console.log(`Number of features: ${reader.featureCount}`);
console.log(`Available projections: ${reader.projectionNames.join(", ")}`);
console.log(`Available cell tracks: ${reader.cellTrackNames.join(", ")}`);
console.log(`Available clusterings: ${reader.clusteringNames.join(", ")}`);
console.log(`Has matrix data: ${reader.hasMatrixData}`);
```

### Summary Information

Get a complete file summary with `getSummary()`:

```typescript
const summary = await reader.getSummary();

console.log(summary);
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

## Reading Data

### Barcodes (Cell Identifiers)

```typescript
// Read all barcodes
const barcodes = await reader.getBarcodes();
console.log(`First barcode: ${barcodes[0]}`);

// Read with pagination (recommended for large files)
const page = await reader.getBarcodes({ offset: 0, limit: 100 });
console.log(`First 100 barcodes:`, page);

// Read a single barcode
const barcode = await reader.barcodes.readOne(0);
```

### Features (Genes/Proteins)

```typescript
// Read all features
const features = await reader.getFeatures();

// Search for features
const searchResults = await reader.features.search("CD3");
for (const { index, feature } of searchResults) {
  console.log(`${feature.name} (${feature.id}) at index ${index}`);
}

// Find by name
const cd3d = await reader.features.findByName("CD3D");
if (cd3d) {
  console.log(`Found: ${cd3d.feature.name} at index ${cd3d.index}`);
}
```

### Projections (UMAP, t-SNE, PCA)

```typescript
// Get default projection (usually the first one)
const projection = await reader.getDefaultProjection();
if (projection) {
  console.log(`${projection.name}: ${projection.dimensions}D`);
  console.log(`Points: ${projection.coordinates[0].length}`);

  // First point coordinates
  const x = projection.coordinates[0][0];
  const y = projection.coordinates[1][0];
  console.log(`First point: (${x}, ${y})`);
}

// Get specific projection
const umap = await reader.getProjection("UMAP");

// Get bounds
const bounds = await reader.projections.getBounds("UMAP");
console.log(`X range: ${bounds.min[0]} to ${bounds.max[0]}`);
```

### Cell Tracks (Clusters, Annotations)

```typescript
// Get cell track
const track = await reader.getCellTrack("Cluster");

console.log(`Track: ${track.name}`);
console.log(`Categories: ${track.categories.join(", ")}`);

// Get cell counts by category
const counts = track.getCategoryCounts();
for (const [category, count] of Object.entries(counts)) {
  console.log(`${category}: ${count} cells`);
}

// Get cell indices for a specific category
const tCellIndices = track.getCellsInCategory("T cells");
```

## Expression Data Access

### Expression for a Specific Gene

```typescript
// Get expression data by gene name
const expression = await reader.getExpressionByFeatureName("CD3D");

if (expression) {
  console.log(`Feature index: ${expression.featureIndex}`);
  console.log(`Non-zero cells: ${expression.indices.length}`);
  console.log(`Max expression: ${Math.max(...expression.values)}`);

  // Iterate over cells with expression
  for (let i = 0; i < expression.indices.length; i++) {
    const cellIndex = expression.indices[i];
    const value = expression.values[i];
    console.log(`Cell ${cellIndex}: ${value}`);
  }
}
```

### Expression for a Specific Cell

```typescript
// Get expression profile by cell index
const cellExpression = await reader.getCellExpression(0);

console.log(`Genes expressed: ${cellExpression.indices.length}`);

// Iterate over expressed genes
for (let i = 0; i < cellExpression.indices.length; i++) {
  const geneIndex = cellExpression.indices[i];
  const value = cellExpression.values[i];
  console.log(`Gene ${geneIndex}: ${value}`);
}
```

### Single Value Query

```typescript
// Get expression value for a specific gene-cell combination
const value = await reader.getExpressionValue(geneIndex, cellIndex);
```

### Matrix Slice

```typescript
// Get a subset of genes and cells
const slice = await reader.getExpressionSlice({
  rowStart: 0,
  rowEnd: 100, // First 100 genes
  colStart: 0,
  colEnd: 1000, // First 1000 cells
});

console.log(`Shape: ${slice.shape}`);
console.log(`Non-zero values: ${slice.data.length}`);
```

## Error Handling

```typescript
import { CloupeReader, CloupeError, CloupeErrorCode } from "cloupe";

try {
  const reader = await CloupeReader.open(file);
} catch (error) {
  if (error instanceof CloupeError) {
    switch (error.code) {
      case CloupeErrorCode.INVALID_HEADER:
        console.error("Invalid .cloupe file header");
        break;
      case CloupeErrorCode.INVALID_INDEX:
        console.error("Corrupted index block");
        break;
      case CloupeErrorCode.DECOMPRESSION_FAILED:
        console.error("Failed to decompress data");
        break;
      default:
        console.error(`Error: ${error.message}`);
    }
  }
}
```

## Resource Cleanup

Always call `close()` when done to clean up resources:

```typescript
const reader = await CloupeReader.open(file);

try {
  // Use the file
  const summary = await reader.getSummary();
} finally {
  reader.close();
}
```

To explicitly clear the cache:

```typescript
reader.clearCache();
```

## Next Steps

- [Web Worker Usage](/examples/web-worker) - Handle large files
- [Visualization Examples](/examples/visualization) - Visualize projection data
- [API Reference](/api/) - Detailed API documentation
