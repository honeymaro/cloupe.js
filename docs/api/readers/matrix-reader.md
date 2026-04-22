# MatrixReader

Class for reading expression matrices. Efficiently handles sparse matrices in CSC (Compressed Sparse Column) format.

## Access

```typescript
const reader = await CloupeReader.open(file);
const matrixReader = reader.matrix;
```

## Methods

### readRow()

```typescript
async readRow(featureIndex: number): Promise<SparseRow>
```

Reads expression data for a specific gene.

**Returns**

```typescript
interface SparseRow {
  featureIndex: number; // Gene index
  indices: Uint32Array; // Cell indices with expression
  values: Float64Array; // Expression values
}
```

**Examples**

```typescript
const row = await reader.matrix.readRow(0);

console.log(`Gene ${row.featureIndex}`);
console.log(`Expressed in ${row.indices.length} cells`);
console.log(`Max value: ${Math.max(...row.values)}`);

// Iterate over expression data
for (let i = 0; i < row.indices.length; i++) {
  console.log(`Cell ${row.indices[i]}: ${row.values[i]}`);
}
```

### readColumn()

```typescript
async readColumn(barcodeIndex: number): Promise<SparseColumn>
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

**Examples**

```typescript
const col = await reader.matrix.readColumn(0);

console.log(`Cell ${col.barcodeIndex}`);
console.log(`${col.indices.length} genes expressed`);
```

### getValue()

```typescript
async getValue(featureIndex: number, barcodeIndex: number): Promise<number>
```

Returns expression value for a specific gene-cell combination.

**Examples**

```typescript
const value = await reader.matrix.getValue(100, 0);
console.log(`Expression: ${value}`);
```

### readFullMatrix()

```typescript
async readFullMatrix(): Promise<SparseMatrix>
```

Reads the full matrix in CSR (Compressed Sparse Row) format. Since `.cloupe` files store data in CSC, this method performs a CSC→CSR conversion for efficient gene-wise access.

::: warning Caution
May cause memory issues for large files. Use `readSlice()` instead.
:::

**Returns**

```typescript
interface SparseMatrix {
  data: Float64Array; // Non-zero values
  indices: Uint32Array; // Column indices (CSR)
  indptr: Uint32Array; // Row pointers
  shape: [number, number]; // [genes, cells]
}
```

### readFullMatrixCSC()

```typescript
async readFullMatrixCSC(): Promise<SparseMatrixCSC>
```

Reads the full matrix in the native CSC (Compressed Sparse Column) format without conversion. Prefer this over `readFullMatrix()` when the downstream consumer expects CSC, or when you iterate many cells and want to avoid the one-time conversion cost.

::: warning Caution
Returned typed arrays share storage with internal caches; treat them as read-only. Throws `CloupeError(NOT_FOUND)` if the file has no CSC data.
:::

**Returns**

```typescript
interface SparseMatrixCSC {
  data: Float64Array; // Non-zero values
  indices: Uint32Array; // Row (gene) indices
  indptr: Uint32Array; // Column (cell) pointers, length = numCells + 1
  shape: [number, number]; // [genes, cells]
}
```

### readSlice()

```typescript
async readSlice(options: SliceOptions): Promise<SparseMatrix>
```

Reads a portion of the matrix.

**Parameters**

```typescript
interface SliceOptions {
  rowStart?: number; // Start row (gene, default: 0)
  rowEnd?: number; // End row (exclusive)
  colStart?: number; // Start column (cell, default: 0)
  colEnd?: number; // End column (exclusive)
}
```

**Examples**

```typescript
// First 100 genes x first 1000 cells
const slice = await reader.matrix.readSlice({
  rowStart: 0,
  rowEnd: 100,
  colStart: 0,
  colEnd: 1000,
});

console.log(`Shape: ${slice.shape}`);
console.log(`Non-zero values: ${slice.data.length}`);
```

### getExpressionForCells()

```typescript
async getExpressionForCells(
  featureIndex: number,
  cellIndices: number[]
): Promise<Float64Array>
```

Returns expression values for a specific gene across specified cells.

**Examples**

```typescript
// CD3D expression in T cells cluster
const tCellIndices = await reader.getCellsInCluster("Cluster", "T cells");
const values = await reader.matrix.getExpressionForCells(geneIndex, tCellIndices);

const mean = values.reduce((a, b) => a + b, 0) / values.length;
console.log(`Mean CD3D expression in T cells: ${mean}`);
```

### getStats()

```typescript
async getStats(): Promise<{
  shape: [number, number];
  nnz: number;
  sparsity: number;
}>
```

Returns matrix statistics.

**Examples**

```typescript
const stats = await reader.matrix.getStats();

console.log(`Shape: ${stats.shape[0]} genes x ${stats.shape[1]} cells`);
console.log(`Non-zero values: ${stats.nnz}`);
console.log(`Sparsity: ${(stats.sparsity * 100).toFixed(1)}%`);
// Sparsity: 97.8%
```

### clearCache()

```typescript
clearCache(): void
```

Clears cached data.

## CSC vs CSR Format

.cloupe files store data in **CSC (Compressed Sparse Column)** format:

- Column (cell) based compression
- Fast column access (expression profile for a specific cell)
- Slow row access (expression distribution for a specific gene)

cloupe.js exposes both formats:

- `readFullMatrix()` / `getExpressionMatrix()` → CSR, converted on the fly for gene-wise access
- `readFullMatrixCSC()` / `getExpressionMatrixCSC()` → native CSC, no conversion, for cell-wise access or interop with CSC-expecting consumers

## Performance Tips

### Single Gene Expression Analysis

```typescript
// Good: Read single row
const row = await reader.matrix.readRow(geneIndex);

// Bad: Read full matrix
const matrix = await reader.matrix.readFullMatrix(); // High memory usage
```

### Multiple Gene Analysis

```typescript
// Good: Read required genes sequentially
const genes = ["CD3D", "CD4", "CD8A"];
for (const gene of genes) {
  const row = await reader.getExpressionByFeatureName(gene);
  // Analyze...
}

// Good: Use slice for contiguous range
const slice = await reader.matrix.readSlice({
  rowStart: 0,
  rowEnd: 100, // First 100 genes
});
```

### Cluster-wise Analysis

```typescript
// Good: Get cell indices first and filter
const cellIndices = await reader.getCellsInCluster("Cluster", "T cells");
const values = await reader.matrix.getExpressionForCells(geneIndex, cellIndices);

// Bad: Read full data and filter in JavaScript
const fullRow = await reader.matrix.readRow(geneIndex);
// Filter in memory...
```
