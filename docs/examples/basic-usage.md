# Basic Usage

Examples demonstrating the basic usage of cloupe.js.

## Try It Yourself

Upload a .cloupe file to see the library in action:

<BasicExample />

## Opening Files

### HTML File Input

```html
<input type="file" id="fileInput" accept=".cloupe" />
<div id="result"></div>

<script type="module">
  import { CloupeReader } from "cloupe";

  document.getElementById("fileInput").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = await CloupeReader.open(file);
    const summary = await reader.getSummary();

    document.getElementById("result").innerHTML = `
    <p>Cells: ${summary.barcodeCount}</p>
    <p>Genes: ${summary.featureCount}</p>
  `;

    reader.close();
  });
</script>
```

### Drag and Drop

```html
<div id="dropzone" style="border: 2px dashed #ccc; padding: 40px;">Drop .cloupe file here</div>

<script type="module">
  import { CloupeReader } from "cloupe";

  const dropzone = document.getElementById("dropzone");

  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.style.borderColor = "#007bff";
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.style.borderColor = "#ccc";
  });

  dropzone.addEventListener("drop", async (e) => {
    e.preventDefault();
    dropzone.style.borderColor = "#ccc";

    const file = e.dataTransfer.files[0];
    if (!file || !file.name.endsWith(".cloupe")) {
      alert("Please drop a .cloupe file");
      return;
    }

    const reader = await CloupeReader.open(file);
    // ...
  });
</script>
```

### Loading from URL

Server must support HTTP Range Requests.

```typescript
import { CloupeReader } from "cloupe";

const url = "https://your-server.com/data.cloupe";
const reader = await CloupeReader.open(url);

const summary = await reader.getSummary();
console.log(summary);

reader.close();
```

## Reading Metadata

```typescript
const reader = await CloupeReader.open(file);

// Basic info (available immediately after opening)
console.log(`Version: ${reader.version}`);
console.log(`File size: ${(reader.fileSize / 1024 / 1024).toFixed(1)} MB`);
console.log(`Cells: ${reader.barcodeCount}`);
console.log(`Genes: ${reader.featureCount}`);

// Available data
console.log(`Projections: ${reader.projectionNames.join(", ")}`);
console.log(`Cell tracks: ${reader.cellTrackNames.join(", ")}`);
console.log(`Clusterings: ${reader.clusteringNames.join(", ")}`);
console.log(`Has matrix: ${reader.hasMatrixData}`);

// Detailed summary
const summary = await reader.getSummary();
if (summary.matrixStats) {
  console.log(`Matrix shape: ${summary.matrixStats.shape}`);
  console.log(`Non-zero: ${summary.matrixStats.nnz}`);
  console.log(`Sparsity: ${(summary.matrixStats.sparsity * 100).toFixed(1)}%`);
}
```

## Reading Barcodes

```typescript
// Read all
const allBarcodes = await reader.getBarcodes();
console.log(`First barcode: ${allBarcodes[0]}`);

// With pagination (recommended for large files)
const pageSize = 1000;
for (let offset = 0; offset < reader.barcodeCount; offset += pageSize) {
  const page = await reader.getBarcodes({ offset, limit: pageSize });
  console.log(`Loaded ${offset} - ${offset + page.length}`);
  // Process...
}

// Read single barcode
const singleBarcode = await reader.barcodes.readOne(0);
```

## Reading Gene Information

```typescript
// Read all
const features = await reader.getFeatures();

// Search genes
const searchResults = await reader.features.search("CD");
for (const { index, feature } of searchResults.slice(0, 10)) {
  console.log(`${index}: ${feature.name} (${feature.id})`);
}

// Find by exact name
const cd3d = await reader.features.findByName("CD3D");
if (cd3d) {
  console.log(`CD3D found at index ${cd3d.index}`);
  console.log(`ID: ${cd3d.feature.id}`);
  console.log(`Type: ${cd3d.feature.type}`);
}
```

## Reading Projection Data

```typescript
// Get default projection (usually the first)
const defaultProj = await reader.getDefaultProjection();
if (defaultProj) {
  console.log(`Default: ${defaultProj.name}`);
}

// Get specific projection
const umap = await reader.getProjection("UMAP");
console.log(`${umap.name}: ${umap.dimensions}D, ${umap.numPoints} points`);

// Access coordinates
const x = umap.coordinates[0]; // Float64Array
const y = umap.coordinates[1]; // Float64Array

// Print first 10 points
for (let i = 0; i < 10; i++) {
  console.log(`Point ${i}: (${x[i].toFixed(2)}, ${y[i].toFixed(2)})`);
}

// Get bounds
const bounds = umap.getBounds();
console.log(`X: ${bounds.min[0].toFixed(2)} ~ ${bounds.max[0].toFixed(2)}`);
console.log(`Y: ${bounds.min[1].toFixed(2)} ~ ${bounds.max[1].toFixed(2)}`);

// Get coordinates for a specific cell
const coords = umap.getCoordinates(100);
if (coords) {
  console.log(`Cell 100: (${coords[0]}, ${coords[1]})`);
}
```

## Reading Cell Tracks

```typescript
// Read track
const track = await reader.getCellTrack("Cluster");

console.log(`Track: ${track.name}`);
console.log(`Categories: ${track.categories.join(", ")}`);

// Cell count by category
const counts = track.getCategoryCounts();
for (const [category, count] of Object.entries(counts)) {
  console.log(`${category}: ${count} cells`);
}

// Get cell indices for a specific category
const tCellIndices = track.getCellsInCategory("T cells");
console.log(`T cells: ${tCellIndices.length} cells`);

// Get category for a specific cell
const cellCategory = track.getCategoryForCell(0);
console.log(`Cell 0 belongs to: ${cellCategory}`);
```

## Reading Expression Data

```typescript
// Get expression data by gene name
const expression = await reader.getExpressionByFeatureName("CD3D");
if (expression) {
  console.log(`CD3D expressed in ${expression.indices.length} cells`);

  // Statistics
  const values = Array.from(expression.values);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;

  console.log(`Min: ${min}, Max: ${max}, Mean: ${mean.toFixed(2)}`);
}

// Get by gene index
const row = await reader.getFeatureExpression(0);

// Get cell expression profile
const cellExpr = await reader.getCellExpression(0);
console.log(`Cell 0 expresses ${cellExpr.indices.length} genes`);

// Get single value
const value = await reader.getExpressionValue(100, 0);
console.log(`Gene 100 in Cell 0: ${value}`);
```

## Cluster-wise Analysis

```typescript
// Get cells in a specific cluster
const cellIndices = await reader.getCellsInCluster("Cluster", "T cells");
console.log(`${cellIndices.length} T cells`);

// Get gene expression in a cluster
const clusterExpr = await reader.getClusterExpression("CD3D", "Cluster", "T cells");
if (clusterExpr) {
  const mean = clusterExpr.values.reduce((a, b) => a + b, 0) / clusterExpr.values.length;
  console.log(`CD3D mean in T cells: ${mean.toFixed(2)}`);
}
```

## Cleanup

```typescript
// Always call when done
reader.close();

// Or use try-finally pattern
const reader = await CloupeReader.open(file);
try {
  // Work...
} finally {
  reader.close();
}
```
