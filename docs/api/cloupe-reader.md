# CloupeReader

The main class for reading .cloupe files.

## Static Methods

### open()

Opens a .cloupe file and returns a CloupeReader instance.

```typescript
static async open(source: File | Blob | string): Promise<CloupeReader>
```

**Parameters**

| Name   | Type                     | Description                             |
| ------ | ------------------------ | --------------------------------------- |
| source | `File \| Blob \| string` | .cloupe file as File/Blob or URL string |

**Returns**

`Promise<CloupeReader>` - CloupeReader instance

**Examples**

```typescript
// From file input
const file = document.querySelector("input").files[0];
const reader = await CloupeReader.open(file);

// From URL (server must support Range Requests)
const reader = await CloupeReader.open("https://example.com/data.cloupe");

// From Blob
const blob = new Blob([arrayBuffer], { type: "application/octet-stream" });
const reader = await CloupeReader.open(blob);
```

**Errors**

- `CloupeError` (INVALID_HEADER): Invalid .cloupe file header
- `CloupeError` (INVALID_INDEX): Corrupted index block

## Properties

### version

```typescript
get version(): string
```

Returns the file format version.

### fileSize

```typescript
get fileSize(): number
```

Returns the file size in bytes.

### barcodeCount

```typescript
get barcodeCount(): number
```

Returns the number of cells (barcodes).

### featureCount

```typescript
get featureCount(): number
```

Returns the number of features (genes/proteins).

### projectionNames

```typescript
get projectionNames(): string[]
```

Returns available projection names (e.g., `['UMAP', 't-SNE']`).

### cellTrackNames

```typescript
get cellTrackNames(): string[]
```

Returns available cell track names.

### clusteringNames

```typescript
get clusteringNames(): string[]
```

Returns available clustering names.

### hasMatrixData

```typescript
get hasMatrixData(): boolean
```

Returns whether expression matrix data is available.

### rawIndex

```typescript
get rawIndex(): IndexBlock
```

Returns raw index block data. For advanced users.

### rawHeader

```typescript
get rawHeader(): CloupeHeader
```

Returns raw header data. For advanced users.

## Specialized Reader Access

### barcodes

```typescript
get barcodes(): BarcodeReader
```

Returns [BarcodeReader](/api/readers/barcode-reader) instance.

### features

```typescript
get features(): FeatureReader
```

Returns [FeatureReader](/api/readers/feature-reader) instance.

### projections

```typescript
get projections(): ProjectionReader
```

Returns [ProjectionReader](/api/readers/projection-reader) instance.

### cellTracks

```typescript
get cellTracks(): CellTrackReader
```

Returns [CellTrackReader](/api/readers/cell-track-reader) instance.

### matrix

```typescript
get matrix(): MatrixReader
```

Returns [MatrixReader](/api/readers/matrix-reader) instance.

## Data Reading Methods

### getBarcodes()

```typescript
async getBarcodes(options?: PaginationOptions): Promise<string[]>
```

Reads barcodes (cell identifiers).

**Parameters**

| Name           | Type     | Description                   |
| -------------- | -------- | ----------------------------- |
| options.offset | `number` | Start position (default: 0)   |
| options.limit  | `number` | Number to read (default: all) |

**Examples**

```typescript
// Read all
const barcodes = await reader.getBarcodes();

// With pagination
const page = await reader.getBarcodes({ offset: 0, limit: 100 });
```

### getFeatures()

```typescript
async getFeatures(options?: PaginationOptions): Promise<Feature[]>
```

Reads feature (gene/protein) information.

**Returns**

```typescript
interface Feature {
  index: number; // Feature index
  id: string; // Feature ID (e.g., ENSG00000167286)
  name: string; // Feature name (e.g., CD3D)
  type?: string; // Feature type (e.g., Gene Expression)
}
```

### getProjection()

```typescript
async getProjection(name: string): Promise<Projection>
```

Reads projection data by name.

**Parameters**

| Name | Type     | Description                             |
| ---- | -------- | --------------------------------------- |
| name | `string` | Projection name (e.g., 'UMAP', 't-SNE') |

**Errors**

- `CloupeError` (NOT_FOUND): Projection with given name not found

### getDefaultProjection()

```typescript
async getDefaultProjection(): Promise<Projection | null>
```

Returns the default projection. Usually the first projection.

### getCellTrack()

```typescript
async getCellTrack(name: string): Promise<CellTrack>
```

Reads cell track by name.

## Expression Data Methods

### getFeatureExpression()

```typescript
async getFeatureExpression(featureIndex: number): Promise<SparseRow>
```

Reads expression data for a specific feature (gene).

**Returns**

```typescript
interface SparseRow {
  featureIndex: number; // Feature index
  indices: Uint32Array; // Cell indices with non-zero values
  values: Float64Array; // Expression values
}
```

### getCellExpression()

```typescript
async getCellExpression(barcodeIndex: number): Promise<SparseColumn>
```

Reads expression profile for a specific cell.

**Returns**

```typescript
interface SparseColumn {
  barcodeIndex: number; // Cell index
  indices: Uint32Array; // Gene indices with expression
  values: Float64Array; // Expression values
}
```

### getExpressionValue()

```typescript
async getExpressionValue(featureIndex: number, barcodeIndex: number): Promise<number>
```

Returns expression value for a specific gene-cell combination.

### getExpressionMatrix()

```typescript
async getExpressionMatrix(): Promise<SparseMatrix>
```

Reads the full expression matrix in CSR (Compressed Sparse Row) format, optimized for gene-wise access.

::: warning Caution
May cause memory issues for large files. Use `getExpressionSlice()` instead.
:::

### getExpressionMatrixCSC()

```typescript
async getExpressionMatrixCSC(): Promise<SparseMatrixCSC>
```

Reads the full expression matrix in the native CSC (Compressed Sparse Column) format of the `.cloupe` file, without CSC→CSR conversion. Use this when you need CSC directly (e.g. handing off to `scipy.sparse.csc_matrix`, WASM kernels, or cell-wise batch processing).

::: warning Caution
May cause memory issues for large files. Returned typed arrays share storage with internal caches; treat them as read-only.
:::

### getExpressionSlice()

```typescript
async getExpressionSlice(options: SliceOptions): Promise<SparseMatrix>
```

Reads a portion of the expression matrix.

**Parameters**

```typescript
interface SliceOptions {
  rowStart?: number; // Start row (gene)
  rowEnd?: number; // End row (exclusive)
  colStart?: number; // Start column (cell)
  colEnd?: number; // End column (exclusive)
}
```

## Advanced Analysis Methods

### getExpressionByFeatureName()

```typescript
async getExpressionByFeatureName(featureName: string): Promise<SparseRow | null>
```

Gets expression data by gene name.

**Examples**

```typescript
const expression = await reader.getExpressionByFeatureName("CD3D");
if (expression) {
  console.log(`${expression.indices.length} cells express CD3D`);
}
```

### getCellsInCluster()

```typescript
async getCellsInCluster(trackName: string, category: string | number): Promise<number[]>
```

Returns cell indices belonging to a specific cluster/category.

### getClusterExpression()

```typescript
async getClusterExpression(
  featureName: string,
  trackName: string,
  category: string | number
): Promise<{ cellIndices: number[]; values: Float64Array } | null>
```

Gets expression data for a gene within a specific cluster.

### getSummary()

```typescript
async getSummary(): Promise<FileSummary>
```

Returns file summary information.

**Returns**

```typescript
interface FileSummary {
  version: string;
  fileSize: number;
  barcodeCount: number;
  featureCount: number;
  projections: string[];
  cellTracks: string[];
  clusterings: string[];
  matrixStats: {
    shape: [number, number];
    nnz: number; // Number of non-zero values
    sparsity: number; // Sparsity (0-1)
  } | null;
}
```

## Resource Management

### clearCache()

```typescript
clearCache(): void
```

Clears all cached data.

### close()

```typescript
close(): void
```

Closes the reader and cleans up resources. Always call when done.

**Examples**

```typescript
const reader = await CloupeReader.open(file);
try {
  const summary = await reader.getSummary();
  // ... work
} finally {
  reader.close();
}
```
