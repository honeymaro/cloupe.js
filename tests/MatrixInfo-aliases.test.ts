import { describe, it, expect } from "vitest";
import { FeatureReader } from "../src/data/FeatureReader.js";
import { MatrixReader } from "../src/data/MatrixReader.js";
import { getIndexSummary } from "../src/core/IndexParser.js";
import type { MatrixInfo, MatrixBlock } from "../src/types/index.js";
import type { BlockReader } from "../src/core/BlockReader.js";

const noopReader = {} as unknown as BlockReader;

const block = (size: number): MatrixBlock => ({
  Start: 0,
  End: size * 16,
  ArraySize: size,
  ArrayWidth: 16,
});

describe("MatrixInfo upstream-canonical field aliases", () => {
  it("FeatureReader.count prefers FeatureCount over GeneCount", () => {
    const info: MatrixInfo = {
      Name: "x",
      GeneCount: 11111,
      CellCount: 0,
      FeatureCount: 32738,
      BarcodeCount: 8414,
    };
    const reader = new FeatureReader(noopReader, info);
    expect(reader.count).toBe(32738);
  });

  it("FeatureReader resolves FeatureIds block when Genes is absent", () => {
    const info: MatrixInfo = {
      Name: "x",
      FeatureCount: 5,
      BarcodeCount: 3,
      FeatureIds: block(5),
      FeatureNames: block(5),
    };
    const reader = new FeatureReader(noopReader, info);
    expect(reader.count).toBe(5);
    expect(reader.isAvailable).toBe(true);
  });

  it("MatrixReader.shape prefers FeatureCount/BarcodeCount over GeneCount/CellCount", () => {
    const info: MatrixInfo = {
      Name: "x",
      GeneCount: 1,
      CellCount: 2,
      FeatureCount: 32738,
      BarcodeCount: 8414,
    };
    const reader = new MatrixReader(noopReader, info);
    expect(reader.shape).toEqual([32738, 8414]);
  });

  it("MatrixReader.shape falls back to GeneCount/CellCount when canonical keys absent", () => {
    const info: MatrixInfo = {
      Name: "x",
      GeneCount: 100,
      CellCount: 50,
    };
    const reader = new MatrixReader(noopReader, info);
    expect(reader.shape).toEqual([100, 50]);
  });
});

describe("getIndexSummary canonical key preference", () => {
  it("prefers FeatureCount and BarcodeCount over legacy keys", () => {
    const summary = getIndexSummary({
      Matrices: [
        {
          Name: "x",
          FeatureCount: 32738,
          BarcodeCount: 8414,
          GeneCount: 1,
          CellCount: 2,
        },
      ],
    });
    expect(summary.geneCount).toBe(32738);
    expect(summary.cellCount).toBe(8414);
  });

  it("falls back to legacy GeneCount/CellCount when canonical absent", () => {
    const summary = getIndexSummary({
      Matrices: [{ Name: "x", GeneCount: 100, CellCount: 50 }],
    });
    expect(summary.geneCount).toBe(100);
    expect(summary.cellCount).toBe(50);
  });

  it("falls back to Rows/Columns when neither canonical nor legacy present", () => {
    const summary = getIndexSummary({
      Matrices: [{ Name: "x", Rows: 7, Columns: 9 }],
    });
    expect(summary.geneCount).toBe(7);
    expect(summary.cellCount).toBe(9);
  });
});
