/**
 * Validation utilities for .cloupe file data
 *
 * Provides validation functions based on 10x Genomics data requirements
 * as documented in loupeR.
 */

import { CloupeError, CloupeErrorCode } from "../types/index.js";

/**
 * Barcode format patterns (from loupeR validation)
 */
const BARCODE_PATTERNS = [
  // Standard 10x barcode: 14+ ACGT characters
  /^[ACGT]{14,}$/,
  // GEM barcode: standard + -digit suffix
  /^[ACGT]{14,}-\d+$/,
  // Visium HD format
  /^s_\d{3}um_\d{5}_\d{5}$/,
  // Visium HD with GEM
  /^s_\d{3}um_\d{5}_\d{5}-\d+$/,
  // Xenium format
  /^[a-p]{1,8}-\d+$/,
];

/**
 * Validates a barcode format
 * @returns true if valid, false otherwise
 */
export function isValidBarcode(barcode: string): boolean {
  // First, test the full barcode against all patterns
  if (BARCODE_PATTERNS.some((pattern) => pattern.test(barcode))) {
    return true;
  }

  // Allow prefix/suffix with : separator only (not _ which is used in Visium HD)
  const parts = barcode.split(":");
  if (parts.length > 1) {
    const core = parts[parts.length - 1];
    return BARCODE_PATTERNS.some((pattern) => pattern.test(core));
  }

  return false;
}

/**
 * Validates an array of barcodes
 * @param barcodes - Array of barcodes to validate
 * @param strict - If true, throws on invalid barcodes
 * @returns Array of invalid barcode indices (empty if all valid)
 */
export function validateBarcodes(barcodes: string[], strict = false): number[] {
  const invalid: number[] = [];

  // Check for empty strings
  const emptyIndices = barcodes.map((b, i) => (b.trim() === "" ? i : -1)).filter((i) => i >= 0);

  if (emptyIndices.length > 0) {
    if (strict) {
      throw new CloupeError(
        `Empty barcodes found at indices: ${emptyIndices.slice(0, 5).join(", ")}${emptyIndices.length > 5 ? "..." : ""}`,
        CloupeErrorCode.INVALID_DATA
      );
    }
    invalid.push(...emptyIndices);
  }

  // Check for duplicates
  const seen = new Set<string>();
  const duplicates: number[] = [];

  for (let i = 0; i < barcodes.length; i++) {
    if (seen.has(barcodes[i])) {
      duplicates.push(i);
    }
    seen.add(barcodes[i]);
  }

  if (duplicates.length > 0) {
    if (strict) {
      throw new CloupeError(
        `Duplicate barcodes found at indices: ${duplicates.slice(0, 5).join(", ")}${duplicates.length > 5 ? "..." : ""}`,
        CloupeErrorCode.INVALID_DATA
      );
    }
    invalid.push(...duplicates);
  }

  return [...new Set(invalid)].sort((a, b) => a - b);
}

/**
 * Validates feature names
 * @param features - Array of feature names/IDs
 * @param strict - If true, throws on invalid features
 * @returns Array of invalid feature indices
 */
export function validateFeatures(features: string[], strict = false): number[] {
  const invalid: number[] = [];

  // Check for empty strings
  const emptyIndices = features.map((f, i) => (f.trim() === "" ? i : -1)).filter((i) => i >= 0);

  if (emptyIndices.length > 0) {
    if (strict) {
      throw new CloupeError(
        `Empty feature names found at indices: ${emptyIndices.slice(0, 5).join(", ")}${emptyIndices.length > 5 ? "..." : ""}`,
        CloupeErrorCode.INVALID_DATA
      );
    }
    invalid.push(...emptyIndices);
  }

  // Check for duplicates
  const seen = new Set<string>();
  const duplicates: number[] = [];

  for (let i = 0; i < features.length; i++) {
    if (seen.has(features[i])) {
      duplicates.push(i);
    }
    seen.add(features[i]);
  }

  if (duplicates.length > 0) {
    if (strict) {
      throw new CloupeError(
        `Duplicate feature names found at indices: ${duplicates.slice(0, 5).join(", ")}${duplicates.length > 5 ? "..." : ""}`,
        CloupeErrorCode.INVALID_DATA
      );
    }
    invalid.push(...duplicates);
  }

  return [...new Set(invalid)].sort((a, b) => a - b);
}

/**
 * Maximum number of cluster categories (from loupeR)
 */
export const MAX_CLUSTER_CATEGORIES = 32768;

/**
 * Validates cluster/cell track data
 */
export function validateCellTrack(
  values: Int16Array,
  numCategories: number,
  strict = false
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check category count
  if (numCategories > MAX_CLUSTER_CATEGORIES) {
    issues.push(`Too many categories: ${numCategories} (max ${MAX_CLUSTER_CATEGORIES})`);
  }

  // Check for out-of-range values
  let minVal = Infinity;
  let maxVal = -Infinity;

  for (let i = 0; i < values.length; i++) {
    const val = values[i];
    if (val < minVal) minVal = val;
    if (val > maxVal) maxVal = val;
  }

  if (minVal < 0) {
    issues.push(`Negative category index found: ${minVal}`);
  }

  if (maxVal >= numCategories) {
    issues.push(`Category index ${maxVal} exceeds number of categories ${numCategories}`);
  }

  if (strict && issues.length > 0) {
    throw new CloupeError(
      `Cell track validation failed: ${issues.join("; ")}`,
      CloupeErrorCode.INVALID_DATA
    );
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Validates projection coordinates
 */
export function validateProjection(
  coordinates: Float64Array[],
  strict = false
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (coordinates.length < 2) {
    issues.push(`Projection must have at least 2 dimensions, got ${coordinates.length}`);
  }

  // Check for NaN/Infinity values
  for (let dim = 0; dim < coordinates.length; dim++) {
    const coords = coordinates[dim];
    for (let i = 0; i < coords.length; i++) {
      if (!Number.isFinite(coords[i])) {
        issues.push(`Non-finite value at dimension ${dim}, index ${i}`);
        break; // Only report first issue per dimension
      }
    }
  }

  // Check that all dimensions have same length
  const lengths = coordinates.map((c) => c.length);
  const uniqueLengths = [...new Set(lengths)];
  if (uniqueLengths.length > 1) {
    issues.push(`Inconsistent coordinate lengths: ${lengths.join(", ")}`);
  }

  if (strict && issues.length > 0) {
    throw new CloupeError(
      `Projection validation failed: ${issues.join("; ")}`,
      CloupeErrorCode.INVALID_DATA
    );
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Validates sparse matrix data
 */
export function validateSparseMatrix(
  data: Float64Array,
  indices: Uint32Array,
  indptr: Uint32Array,
  shape: [number, number],
  strict = false
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  const [numRows, numCols] = shape;

  // Check indptr length
  if (indptr.length !== numRows + 1) {
    issues.push(`indptr length ${indptr.length} should be ${numRows + 1}`);
  }

  // Check indptr is monotonically increasing
  for (let i = 1; i < indptr.length; i++) {
    if (indptr[i] < indptr[i - 1]) {
      issues.push(`indptr not monotonic at index ${i}`);
      break;
    }
  }

  // Check data and indices length match
  if (data.length !== indices.length) {
    issues.push(`data length ${data.length} != indices length ${indices.length}`);
  }

  // Check last indptr equals nnz
  if (indptr.length > 0 && indptr[indptr.length - 1] !== data.length) {
    issues.push(`Last indptr ${indptr[indptr.length - 1]} != nnz ${data.length}`);
  }

  // Check indices are within bounds (sample check for large matrices)
  const checkLimit = Math.min(indices.length, 10000);
  for (let i = 0; i < checkLimit; i++) {
    if (indices[i] >= numCols) {
      issues.push(`Column index ${indices[i]} >= numCols ${numCols}`);
      break;
    }
  }

  // Check for NaN/Infinity in data (sample check)
  for (let i = 0; i < checkLimit; i++) {
    if (!Number.isFinite(data[i])) {
      issues.push(`Non-finite value at index ${i}`);
      break;
    }
  }

  if (strict && issues.length > 0) {
    throw new CloupeError(
      `Sparse matrix validation failed: ${issues.join("; ")}`,
      CloupeErrorCode.INVALID_DATA
    );
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Checks if a file appears to be a valid .cloupe file based on header
 */
export function isCloupeFile(headerBytes: Uint8Array): boolean {
  // Check for JSON opening brace (cloupe files have JSON header)
  if (headerBytes.length < 1 || headerBytes[0] !== 0x7b) {
    return false;
  }

  // Try to find "version" in the header
  const headerStr = new TextDecoder("utf-8").decode(headerBytes.subarray(0, 256));
  return headerStr.includes('"version"') || headerStr.includes("'version'");
}
