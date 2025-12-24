/**
 * SparseMatrix - Utility class for CSR (Compressed Sparse Row) matrix operations
 *
 * The .cloupe file stores expression matrices in CSR format where:
 * - data: non-zero values
 * - indices: column indices for each value
 * - indptr: row pointers (start index in data/indices for each row)
 * - shape: [numRows, numCols] (features x barcodes)
 */

import type { SparseMatrix, SparseRow, SparseColumn, SliceOptions } from "../types/index.js";

/**
 * Creates an empty sparse matrix
 */
export function createEmptySparseMatrix(shape: [number, number]): SparseMatrix {
  return {
    data: new Float64Array(0),
    indices: new Uint32Array(0),
    indptr: new Uint32Array(shape[0] + 1),
    shape,
  };
}

/**
 * Gets a specific row from a CSR matrix
 * @param matrix - CSR sparse matrix
 * @param rowIndex - Row index to extract
 * @returns Sparse row with column indices and values
 */
export function getRow(matrix: SparseMatrix, rowIndex: number): SparseRow {
  if (rowIndex < 0 || rowIndex >= matrix.shape[0]) {
    throw new RangeError(`Row index ${rowIndex} out of range [0, ${matrix.shape[0]})`);
  }

  const start = matrix.indptr[rowIndex];
  const end = matrix.indptr[rowIndex + 1];

  return {
    featureIndex: rowIndex,
    indices: matrix.indices.slice(start, end),
    values: matrix.data.slice(start, end),
  };
}

/**
 * Gets a specific column from a CSR matrix (slower than row access)
 * @param matrix - CSR sparse matrix
 * @param colIndex - Column index to extract
 * @returns Sparse column with row indices and values
 */
export function getColumn(matrix: SparseMatrix, colIndex: number): SparseColumn {
  if (colIndex < 0 || colIndex >= matrix.shape[1]) {
    throw new RangeError(`Column index ${colIndex} out of range [0, ${matrix.shape[1]})`);
  }

  const rowIndices: number[] = [];
  const values: number[] = [];

  for (let row = 0; row < matrix.shape[0]; row++) {
    const start = matrix.indptr[row];
    const end = matrix.indptr[row + 1];

    // Binary search for the column index in this row
    for (let i = start; i < end; i++) {
      if (matrix.indices[i] === colIndex) {
        rowIndices.push(row);
        values.push(matrix.data[i]);
        break;
      }
      // Since indices are sorted, we can break early
      if (matrix.indices[i] > colIndex) {
        break;
      }
    }
  }

  return {
    barcodeIndex: colIndex,
    indices: new Uint32Array(rowIndices),
    values: new Float64Array(values),
  };
}

/**
 * Gets a single value from the matrix
 */
export function getValue(matrix: SparseMatrix, rowIndex: number, colIndex: number): number {
  if (rowIndex < 0 || rowIndex >= matrix.shape[0]) {
    throw new RangeError(`Row index ${rowIndex} out of range [0, ${matrix.shape[0]})`);
  }
  if (colIndex < 0 || colIndex >= matrix.shape[1]) {
    throw new RangeError(`Column index ${colIndex} out of range [0, ${matrix.shape[1]})`);
  }

  const start = matrix.indptr[rowIndex];
  const end = matrix.indptr[rowIndex + 1];

  // Binary search for the column index
  let lo = start;
  let hi = end;

  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (matrix.indices[mid] < colIndex) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  if (lo < end && matrix.indices[lo] === colIndex) {
    return matrix.data[lo];
  }

  return 0; // Sparse value
}

/**
 * Extracts a submatrix (slice) from a CSR matrix
 */
export function slice(matrix: SparseMatrix, options: SliceOptions): SparseMatrix {
  const {
    rowStart = 0,
    rowEnd = matrix.shape[0],
    colStart = 0,
    colEnd = matrix.shape[1],
  } = options;

  // Validate bounds
  if (rowStart < 0 || rowEnd > matrix.shape[0] || rowStart >= rowEnd) {
    throw new RangeError(`Invalid row range [${rowStart}, ${rowEnd})`);
  }
  if (colStart < 0 || colEnd > matrix.shape[1] || colStart >= colEnd) {
    throw new RangeError(`Invalid column range [${colStart}, ${colEnd})`);
  }

  const newRows = rowEnd - rowStart;
  const newCols = colEnd - colStart;

  // First pass: count non-zero elements in the slice
  const newIndptr = new Uint32Array(newRows + 1);
  let nnz = 0;

  for (let row = rowStart; row < rowEnd; row++) {
    const start = matrix.indptr[row];
    const end = matrix.indptr[row + 1];

    for (let i = start; i < end; i++) {
      const col = matrix.indices[i];
      if (col >= colStart && col < colEnd) {
        nnz++;
      }
    }
    newIndptr[row - rowStart + 1] = nnz;
  }

  // Second pass: copy data
  const newData = new Float64Array(nnz);
  const newIndices = new Uint32Array(nnz);
  let pos = 0;

  for (let row = rowStart; row < rowEnd; row++) {
    const start = matrix.indptr[row];
    const end = matrix.indptr[row + 1];

    for (let i = start; i < end; i++) {
      const col = matrix.indices[i];
      if (col >= colStart && col < colEnd) {
        newData[pos] = matrix.data[i];
        newIndices[pos] = col - colStart;
        pos++;
      }
    }
  }

  return {
    data: newData,
    indices: newIndices,
    indptr: newIndptr,
    shape: [newRows, newCols],
  };
}

/**
 * Gets multiple rows as a submatrix
 */
export function getRows(matrix: SparseMatrix, rowIndices: number[]): SparseMatrix {
  // First pass: count non-zero elements
  let nnz = 0;
  for (const row of rowIndices) {
    if (row < 0 || row >= matrix.shape[0]) {
      throw new RangeError(`Row index ${row} out of range [0, ${matrix.shape[0]})`);
    }
    nnz += matrix.indptr[row + 1] - matrix.indptr[row];
  }

  // Allocate arrays
  const newIndptr = new Uint32Array(rowIndices.length + 1);
  const newData = new Float64Array(nnz);
  const newIndices = new Uint32Array(nnz);

  // Copy data
  let pos = 0;
  for (let i = 0; i < rowIndices.length; i++) {
    const row = rowIndices[i];
    const start = matrix.indptr[row];
    const end = matrix.indptr[row + 1];

    for (let j = start; j < end; j++) {
      newData[pos] = matrix.data[j];
      newIndices[pos] = matrix.indices[j];
      pos++;
    }
    newIndptr[i + 1] = pos;
  }

  return {
    data: newData,
    indices: newIndices,
    indptr: newIndptr,
    shape: [rowIndices.length, matrix.shape[1]],
  };
}

/**
 * Gets multiple columns as a submatrix
 */
export function getColumns(matrix: SparseMatrix, colIndices: number[]): SparseMatrix {
  const colSet = new Set(colIndices);
  const colMap = new Map(colIndices.map((col, idx) => [col, idx]));

  // First pass: count non-zero elements
  let nnz = 0;
  for (let row = 0; row < matrix.shape[0]; row++) {
    const start = matrix.indptr[row];
    const end = matrix.indptr[row + 1];

    for (let i = start; i < end; i++) {
      if (colSet.has(matrix.indices[i])) {
        nnz++;
      }
    }
  }

  // Allocate arrays
  const newIndptr = new Uint32Array(matrix.shape[0] + 1);
  const newData = new Float64Array(nnz);
  const newIndices = new Uint32Array(nnz);

  // Copy data
  let pos = 0;
  for (let row = 0; row < matrix.shape[0]; row++) {
    const start = matrix.indptr[row];
    const end = matrix.indptr[row + 1];

    for (let i = start; i < end; i++) {
      const col = matrix.indices[i];
      if (colSet.has(col)) {
        newData[pos] = matrix.data[i];
        newIndices[pos] = colMap.get(col)!;
        pos++;
      }
    }
    newIndptr[row + 1] = pos;
  }

  return {
    data: newData,
    indices: newIndices,
    indptr: newIndptr,
    shape: [matrix.shape[0], colIndices.length],
  };
}

/**
 * Converts a sparse row to dense array
 */
export function rowToDense(row: SparseRow, numCols: number): Float64Array {
  const dense = new Float64Array(numCols);
  for (let i = 0; i < row.indices.length; i++) {
    dense[row.indices[i]] = row.values[i];
  }
  return dense;
}

/**
 * Converts a sparse column to dense array
 */
export function columnToDense(col: SparseColumn, numRows: number): Float64Array {
  const dense = new Float64Array(numRows);
  for (let i = 0; i < col.indices.length; i++) {
    dense[col.indices[i]] = col.values[i];
  }
  return dense;
}

/**
 * Gets statistics about the sparse matrix
 */
export function getMatrixStats(matrix: SparseMatrix): {
  nnz: number;
  sparsity: number;
  avgNnzPerRow: number;
  minNnzPerRow: number;
  maxNnzPerRow: number;
} {
  const nnz = matrix.data.length;
  const total = matrix.shape[0] * matrix.shape[1];
  const sparsity = 1 - nnz / total;

  let minNnz = Infinity;
  let maxNnz = 0;

  for (let row = 0; row < matrix.shape[0]; row++) {
    const rowNnz = matrix.indptr[row + 1] - matrix.indptr[row];
    minNnz = Math.min(minNnz, rowNnz);
    maxNnz = Math.max(maxNnz, rowNnz);
  }

  return {
    nnz,
    sparsity,
    avgNnzPerRow: nnz / matrix.shape[0],
    minNnzPerRow: minNnz === Infinity ? 0 : minNnz,
    maxNnzPerRow: maxNnz,
  };
}
