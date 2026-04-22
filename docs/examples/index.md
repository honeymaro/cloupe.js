# Examples

Collection of cloupe.js usage examples.

## Interactive Gene Expression Demo

Search and analyze gene expression data from your .cloupe file:

<ExpressionViewer />

## Basic Examples

- [Basic Usage](/examples/basic-usage) - Opening files, reading data, searching
- [Web Worker](/examples/web-worker) - Handling large files
- [Visualization](/examples/visualization) - Projection visualization with Canvas/SVG

## Code Snippets

### Opening a File

```typescript
import { CloupeReader } from "cloupe.js";

// From file input
const reader = await CloupeReader.open(file);

// From URL
const reader = await CloupeReader.open("https://example.com/data.cloupe");
```

### Print Summary Information

```typescript
const summary = await reader.getSummary();

console.log(`Version: ${summary.version}`);
console.log(`Cells: ${summary.barcodeCount.toLocaleString()}`);
console.log(`Genes: ${summary.featureCount.toLocaleString()}`);
console.log(`Projections: ${summary.projections.join(", ")}`);

if (summary.matrixStats) {
  const { nnz, sparsity } = summary.matrixStats;
  console.log(`Non-zero values: ${nnz.toLocaleString()}`);
  console.log(`Sparsity: ${(sparsity * 100).toFixed(1)}%`);
}
```

### Gene Expression Analysis

```typescript
// Search for specific genes
const results = await reader.features.search("CD3");

// Get expression data
for (const { index, feature } of results) {
  const expression = await reader.getFeatureExpression(index);

  const expressedCells = expression.indices.length;
  const maxValue = Math.max(...expression.values);
  const mean = expression.values.reduce((a, b) => a + b, 0) / expressedCells;

  console.log(`${feature.name}:`);
  console.log(`  Expressed in ${expressedCells} cells`);
  console.log(`  Max: ${maxValue.toFixed(2)}, Mean: ${mean.toFixed(2)}`);
}
```

### Compare Expression Across Clusters

```typescript
const track = await reader.getCellTrack("Cluster");
const categories = Object.keys(track.getCategoryCounts());

const geneExpression = await reader.getExpressionByFeatureName("CD3D");
if (!geneExpression) {
  throw new Error("Gene not found");
}

// Calculate mean expression per cluster
for (const category of categories) {
  const cellIndices = track.getCellsInCategory(category);

  // Extract expression values for cells in this cluster
  let sum = 0;
  let count = 0;

  for (let i = 0; i < geneExpression.indices.length; i++) {
    if (cellIndices.includes(geneExpression.indices[i])) {
      sum += geneExpression.values[i];
      count++;
    }
  }

  const mean = count > 0 ? sum / count : 0;
  console.log(`${category}: ${mean.toFixed(2)} (${count}/${cellIndices.length} cells)`);
}
```

### Pagination Implementation

```typescript
const PAGE_SIZE = 1000;
let offset = 0;
let hasMore = true;

while (hasMore) {
  const barcodes = await reader.getBarcodes({ offset, limit: PAGE_SIZE });

  console.log(`Loaded ${barcodes.length} barcodes (offset: ${offset})`);

  // Process data...

  offset += PAGE_SIZE;
  hasMore = barcodes.length === PAGE_SIZE;
}
```

### Using with React

```tsx
import { useState, useEffect } from "react";
import { CloupeReader } from "cloupe.js";

function CloupeViewer({ file }: { file: File }) {
  const [reader, setReader] = useState<CloupeReader | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadFile() {
      try {
        const r = await CloupeReader.open(file);
        if (mounted) {
          setReader(r);
          setSummary(await r.getSummary());
        }
      } catch (e) {
        if (mounted) {
          setError(e instanceof Error ? e.message : "Failed to load file");
        }
      }
    }

    loadFile();

    return () => {
      mounted = false;
      reader?.close();
    };
  }, [file]);

  if (error) return <div>Error: {error}</div>;
  if (!summary) return <div>Loading...</div>;

  return (
    <div>
      <h2>File Summary</h2>
      <p>Cells: {summary.barcodeCount}</p>
      <p>Genes: {summary.featureCount}</p>
      <p>Projections: {summary.projections.join(", ")}</p>
    </div>
  );
}
```

### Error Handling

```typescript
import { CloupeReader, CloupeError, CloupeErrorCode } from "cloupe.js";

async function loadFile(file: File) {
  try {
    const reader = await CloupeReader.open(file);
    return reader;
  } catch (error) {
    if (error instanceof CloupeError) {
      switch (error.code) {
        case CloupeErrorCode.INVALID_HEADER:
          throw new Error("The selected file is not a valid .cloupe file.");
        case CloupeErrorCode.DECOMPRESSION_FAILED:
          throw new Error("The file is corrupted.");
        case CloupeErrorCode.FILE_READ_ERROR:
          throw new Error("Unable to read the file.");
        default:
          throw new Error(`Unknown error: ${error.message}`);
      }
    }
    throw error;
  }
}
```
