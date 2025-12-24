import { describe, it, expect } from "vitest";
import {
  getRow,
  getColumn,
  getValue,
  slice,
  getRows,
  getColumns,
  rowToDense,
  columnToDense,
  getMatrixStats,
  createEmptySparseMatrix,
} from "../src/data/SparseMatrix.js";
import type { SparseMatrix } from "../src/types/index.js";

describe("SparseMatrix", () => {
  // Example CSR matrix:
  // [[1, 0, 2],
  //  [0, 0, 3],
  //  [4, 5, 6]]
  const createTestMatrix = (): SparseMatrix => ({
    data: new Float64Array([1, 2, 3, 4, 5, 6]),
    indices: new Uint32Array([0, 2, 2, 0, 1, 2]),
    indptr: new Uint32Array([0, 2, 3, 6]),
    shape: [3, 3] as [number, number],
  });

  describe("getRow", () => {
    it("should extract a row", () => {
      const matrix = createTestMatrix();

      const row0 = getRow(matrix, 0);
      expect(row0.featureIndex).toBe(0);
      expect(Array.from(row0.indices)).toEqual([0, 2]);
      expect(Array.from(row0.values)).toEqual([1, 2]);

      const row1 = getRow(matrix, 1);
      expect(Array.from(row1.indices)).toEqual([2]);
      expect(Array.from(row1.values)).toEqual([3]);

      const row2 = getRow(matrix, 2);
      expect(Array.from(row2.indices)).toEqual([0, 1, 2]);
      expect(Array.from(row2.values)).toEqual([4, 5, 6]);
    });

    it("should throw on out-of-range row", () => {
      const matrix = createTestMatrix();
      expect(() => getRow(matrix, -1)).toThrow(RangeError);
      expect(() => getRow(matrix, 3)).toThrow(RangeError);
    });
  });

  describe("getColumn", () => {
    it("should extract a column", () => {
      const matrix = createTestMatrix();

      const col0 = getColumn(matrix, 0);
      expect(col0.barcodeIndex).toBe(0);
      expect(Array.from(col0.indices)).toEqual([0, 2]);
      expect(Array.from(col0.values)).toEqual([1, 4]);

      const col1 = getColumn(matrix, 1);
      expect(Array.from(col1.indices)).toEqual([2]);
      expect(Array.from(col1.values)).toEqual([5]);

      const col2 = getColumn(matrix, 2);
      expect(Array.from(col2.indices)).toEqual([0, 1, 2]);
      expect(Array.from(col2.values)).toEqual([2, 3, 6]);
    });

    it("should throw on out-of-range column", () => {
      const matrix = createTestMatrix();
      expect(() => getColumn(matrix, -1)).toThrow(RangeError);
      expect(() => getColumn(matrix, 3)).toThrow(RangeError);
    });
  });

  describe("getValue", () => {
    it("should get individual values", () => {
      const matrix = createTestMatrix();

      expect(getValue(matrix, 0, 0)).toBe(1);
      expect(getValue(matrix, 0, 1)).toBe(0); // sparse
      expect(getValue(matrix, 0, 2)).toBe(2);
      expect(getValue(matrix, 1, 2)).toBe(3);
      expect(getValue(matrix, 2, 0)).toBe(4);
      expect(getValue(matrix, 2, 1)).toBe(5);
      expect(getValue(matrix, 2, 2)).toBe(6);
    });

    it("should return 0 for sparse positions", () => {
      const matrix = createTestMatrix();
      expect(getValue(matrix, 0, 1)).toBe(0);
      expect(getValue(matrix, 1, 0)).toBe(0);
      expect(getValue(matrix, 1, 1)).toBe(0);
    });
  });

  describe("slice", () => {
    it("should extract a submatrix", () => {
      const matrix = createTestMatrix();

      // Extract bottom-right 2x2
      const sub = slice(matrix, {
        rowStart: 1,
        rowEnd: 3,
        colStart: 1,
        colEnd: 3,
      });

      expect(sub.shape).toEqual([2, 2]);
      expect(getValue(sub, 0, 0)).toBe(0);
      expect(getValue(sub, 0, 1)).toBe(3);
      expect(getValue(sub, 1, 0)).toBe(5);
      expect(getValue(sub, 1, 1)).toBe(6);
    });

    it("should handle full slice", () => {
      const matrix = createTestMatrix();
      const full = slice(matrix, {});

      expect(full.shape).toEqual(matrix.shape);
      expect(full.data.length).toBe(matrix.data.length);
    });
  });

  describe("getRows", () => {
    it("should extract multiple rows", () => {
      const matrix = createTestMatrix();
      const sub = getRows(matrix, [0, 2]);

      expect(sub.shape).toEqual([2, 3]);

      // First row of sub is row 0 of original
      const row0 = getRow(sub, 0);
      expect(Array.from(row0.values)).toEqual([1, 2]);

      // Second row of sub is row 2 of original
      const row1 = getRow(sub, 1);
      expect(Array.from(row1.values)).toEqual([4, 5, 6]);
    });
  });

  describe("getColumns", () => {
    it("should extract multiple columns", () => {
      const matrix = createTestMatrix();
      const sub = getColumns(matrix, [0, 2]);

      expect(sub.shape).toEqual([3, 2]);

      expect(getValue(sub, 0, 0)).toBe(1); // original (0, 0)
      expect(getValue(sub, 0, 1)).toBe(2); // original (0, 2)
      expect(getValue(sub, 2, 0)).toBe(4); // original (2, 0)
      expect(getValue(sub, 2, 1)).toBe(6); // original (2, 2)
    });
  });

  describe("rowToDense", () => {
    it("should convert sparse row to dense", () => {
      const matrix = createTestMatrix();
      const row = getRow(matrix, 0);
      const dense = rowToDense(row, 3);

      expect(Array.from(dense)).toEqual([1, 0, 2]);
    });
  });

  describe("columnToDense", () => {
    it("should convert sparse column to dense", () => {
      const matrix = createTestMatrix();
      const col = getColumn(matrix, 2);
      const dense = columnToDense(col, 3);

      expect(Array.from(dense)).toEqual([2, 3, 6]);
    });
  });

  describe("getMatrixStats", () => {
    it("should compute statistics", () => {
      const matrix = createTestMatrix();
      const stats = getMatrixStats(matrix);

      expect(stats.nnz).toBe(6);
      expect(stats.sparsity).toBeCloseTo(1 - 6 / 9);
      expect(stats.avgNnzPerRow).toBe(2);
      expect(stats.minNnzPerRow).toBe(1);
      expect(stats.maxNnzPerRow).toBe(3);
    });
  });

  describe("createEmptySparseMatrix", () => {
    it("should create empty matrix", () => {
      const empty = createEmptySparseMatrix([10, 20]);

      expect(empty.shape).toEqual([10, 20]);
      expect(empty.data.length).toBe(0);
      expect(empty.indices.length).toBe(0);
      expect(empty.indptr.length).toBe(11); // numRows + 1
    });
  });
});
