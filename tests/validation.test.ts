import { describe, it, expect } from "vitest";
import {
  isValidBarcode,
  validateBarcodes,
  validateFeatures,
  validateCellTrack,
  validateProjection,
  validateSparseMatrix,
  isCloupeFile,
} from "../src/utils/validation.js";

describe("validation", () => {
  describe("isValidBarcode", () => {
    it("should validate standard 10x barcodes", () => {
      expect(isValidBarcode("AAACCCAAGAAATTGC")).toBe(true);
      expect(isValidBarcode("ACGTACGTACGTACGT")).toBe(true);
      expect(isValidBarcode("AAACCCAAGAAATTGC-1")).toBe(true);
    });

    it("should validate Visium HD barcodes", () => {
      expect(isValidBarcode("s_008um_00001_00001")).toBe(true);
      expect(isValidBarcode("s_008um_00001_00001-1")).toBe(true);
    });

    it("should validate Xenium barcodes", () => {
      expect(isValidBarcode("abcdefgh-1")).toBe(true);
      expect(isValidBarcode("a-1")).toBe(true);
    });

    it("should reject invalid barcodes", () => {
      expect(isValidBarcode("")).toBe(false);
      expect(isValidBarcode("short")).toBe(false);
      expect(isValidBarcode("AAACCCAAGAAATTGX")).toBe(false); // X is not ACGT
    });
  });

  describe("validateBarcodes", () => {
    it("should detect empty barcodes", () => {
      const barcodes = ["AAACCCAAGAAATTGC", "", "ACGTACGTACGTACGT"];
      const invalid = validateBarcodes(barcodes);
      expect(invalid).toContain(1);
    });

    it("should detect duplicate barcodes", () => {
      const barcodes = ["AAACCCAAGAAATTGC", "ACGTACGTACGTACGT", "AAACCCAAGAAATTGC"];
      const invalid = validateBarcodes(barcodes);
      expect(invalid).toContain(2);
    });

    it("should throw in strict mode", () => {
      const barcodes = ["AAACCCAAGAAATTGC", ""];
      expect(() => validateBarcodes(barcodes, true)).toThrow();
    });

    it("should return empty array for valid barcodes", () => {
      const barcodes = ["AAACCCAAGAAATTGC", "ACGTACGTACGTACGT"];
      const invalid = validateBarcodes(barcodes);
      expect(invalid).toEqual([]);
    });
  });

  describe("validateFeatures", () => {
    it("should detect empty features", () => {
      const features = ["GENE1", "", "GENE2"];
      const invalid = validateFeatures(features);
      expect(invalid).toContain(1);
    });

    it("should detect duplicates", () => {
      const features = ["GENE1", "GENE2", "GENE1"];
      const invalid = validateFeatures(features);
      expect(invalid).toContain(2);
    });
  });

  describe("validateCellTrack", () => {
    it("should validate valid cell track", () => {
      const values = new Int16Array([0, 1, 2, 0, 1]);
      const result = validateCellTrack(values, 3);
      expect(result.valid).toBe(true);
      expect(result.issues).toEqual([]);
    });

    it("should detect out-of-range values", () => {
      const values = new Int16Array([0, 1, 5]);
      const result = validateCellTrack(values, 3);
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it("should detect negative values", () => {
      const values = new Int16Array([0, -1, 1]);
      const result = validateCellTrack(values, 3);
      expect(result.valid).toBe(false);
    });

    it("should detect too many categories", () => {
      const values = new Int16Array([0]);
      const result = validateCellTrack(values, 50000);
      expect(result.valid).toBe(false);
    });
  });

  describe("validateProjection", () => {
    it("should validate valid projection", () => {
      const coords = [new Float64Array([1, 2, 3]), new Float64Array([4, 5, 6])];
      const result = validateProjection(coords);
      expect(result.valid).toBe(true);
    });

    it("should detect NaN values", () => {
      const coords = [new Float64Array([1, NaN, 3]), new Float64Array([4, 5, 6])];
      const result = validateProjection(coords);
      expect(result.valid).toBe(false);
    });

    it("should detect Infinity values", () => {
      const coords = [new Float64Array([1, Infinity, 3]), new Float64Array([4, 5, 6])];
      const result = validateProjection(coords);
      expect(result.valid).toBe(false);
    });

    it("should detect inconsistent lengths", () => {
      const coords = [new Float64Array([1, 2, 3]), new Float64Array([4, 5])];
      const result = validateProjection(coords);
      expect(result.valid).toBe(false);
    });

    it("should require at least 2 dimensions", () => {
      const coords = [new Float64Array([1, 2, 3])];
      const result = validateProjection(coords);
      expect(result.valid).toBe(false);
    });
  });

  describe("validateSparseMatrix", () => {
    it("should validate valid matrix", () => {
      const data = new Float64Array([1, 2, 3]);
      const indices = new Uint32Array([0, 1, 2]);
      const indptr = new Uint32Array([0, 1, 2, 3]);
      const shape: [number, number] = [3, 3];

      const result = validateSparseMatrix(data, indices, indptr, shape);
      expect(result.valid).toBe(true);
    });

    it("should detect indptr length mismatch", () => {
      const data = new Float64Array([1, 2, 3]);
      const indices = new Uint32Array([0, 1, 2]);
      const indptr = new Uint32Array([0, 1, 2]); // Should be length 4
      const shape: [number, number] = [3, 3];

      const result = validateSparseMatrix(data, indices, indptr, shape);
      expect(result.valid).toBe(false);
    });

    it("should detect data/indices length mismatch", () => {
      const data = new Float64Array([1, 2, 3]);
      const indices = new Uint32Array([0, 1]); // Mismatch
      const indptr = new Uint32Array([0, 1, 2, 3]);
      const shape: [number, number] = [3, 3];

      const result = validateSparseMatrix(data, indices, indptr, shape);
      expect(result.valid).toBe(false);
    });
  });

  describe("isCloupeFile", () => {
    it("should detect cloupe file by header", () => {
      const header = new TextEncoder().encode('{"version":"1.0","indexBlock":{}}');
      expect(isCloupeFile(header)).toBe(true);
    });

    it("should reject non-cloupe files", () => {
      const binary = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
      expect(isCloupeFile(binary)).toBe(false);
    });

    it("should reject non-JSON files", () => {
      const text = new TextEncoder().encode("plain text file");
      expect(isCloupeFile(text)).toBe(false);
    });
  });
});
