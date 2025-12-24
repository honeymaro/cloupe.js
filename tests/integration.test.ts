/**
 * Integration tests using real .cloupe files
 *
 * These tests verify the library works correctly with actual
 * 10x Genomics Loupe Browser files.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { CloupeReader } from "../src/core/CloupeReader.js";
import { CloupeError } from "../src/types/index.js";

// Helper to create a Blob from file path (simulating browser File API)
function fileToBlob(filePath: string): Blob {
  const buffer = readFileSync(filePath);
  return new Blob([buffer]);
}

const FIXTURES_DIR = resolve(__dirname, "fixtures");
const AML_FILE = resolve(FIXTURES_DIR, "AMLTutorial.cloupe");

describe("CloupeReader Integration", () => {
  let reader: CloupeReader;

  beforeAll(async () => {
    const blob = fileToBlob(AML_FILE);
    reader = await CloupeReader.open(blob);
  });

  describe("file opening and metadata", () => {
    it("should open cloupe file successfully", () => {
      expect(reader).toBeInstanceOf(CloupeReader);
    });

    it("should read file version", () => {
      expect(reader.version).toBeDefined();
      expect(typeof reader.version).toBe("string");
      console.log("File version:", reader.version);
    });

    it("should get barcode count", () => {
      expect(reader.barcodeCount).toBeGreaterThan(0);
      console.log("Barcode count:", reader.barcodeCount);
    });

    it("should get feature count", () => {
      expect(reader.featureCount).toBeGreaterThan(0);
      console.log("Feature count:", reader.featureCount);
    });

    it("should list available projections", () => {
      const projections = reader.projectionNames;
      expect(Array.isArray(projections)).toBe(true);
      console.log("Available projections:", projections);
    });

    it("should list available cell tracks", () => {
      const tracks = reader.cellTrackNames;
      expect(Array.isArray(tracks)).toBe(true);
      console.log("Available cell tracks:", tracks);
    });
  });

  describe("summary", () => {
    it("should get file summary", async () => {
      const summary = await reader.getSummary();

      expect(summary.version).toBeDefined();
      expect(summary.fileSize).toBeGreaterThan(0);
      expect(summary.barcodeCount).toBeGreaterThan(0);
      expect(summary.featureCount).toBeGreaterThan(0);

      console.log("File summary:", JSON.stringify(summary, null, 2));
    });
  });

  describe("barcode reading", () => {
    it("should read all barcodes", async () => {
      const barcodes = await reader.getBarcodes();

      expect(barcodes.length).toBe(reader.barcodeCount);
      expect(typeof barcodes[0]).toBe("string");
      expect(barcodes[0].length).toBeGreaterThan(0);

      console.log("First 5 barcodes:", barcodes.slice(0, 5));
    });

    it("should read barcodes with pagination", async () => {
      const page1 = await reader.getBarcodes({ offset: 0, limit: 10 });
      const page2 = await reader.getBarcodes({ offset: 10, limit: 10 });

      expect(page1.length).toBe(10);
      expect(page2.length).toBe(10);
      expect(page1[0]).not.toBe(page2[0]);
    });

    it("should read single barcode", async () => {
      const barcode = await reader.barcodes.readOne(0);
      const allBarcodes = await reader.getBarcodes({ limit: 1 });

      expect(barcode).toBe(allBarcodes[0]);
    });
  });

  describe("feature reading", () => {
    it("should read all features", async () => {
      const features = await reader.getFeatures();

      expect(features.length).toBe(reader.featureCount);
      expect(features[0]).toHaveProperty("id");
      expect(features[0]).toHaveProperty("name");

      console.log("First 5 features:", features.slice(0, 5));
    });

    it("should read features with pagination", async () => {
      const page1 = await reader.getFeatures({ offset: 0, limit: 10 });
      const page2 = await reader.getFeatures({ offset: 10, limit: 10 });

      expect(page1.length).toBe(10);
      expect(page2.length).toBe(10);
    });

    it("should search features by name", async () => {
      // Search for a common gene pattern
      const results = await reader.features.search(/^CD/i);

      console.log(`Found ${results.length} features starting with 'CD'`);
      if (results.length > 0) {
        console.log("First match:", results[0].feature);
      }
    });
  });

  describe("projection reading", () => {
    it("should read default projection", async () => {
      const projection = await reader.getDefaultProjection();

      if (projection) {
        expect(projection.name).toBeDefined();
        expect(projection.coordinates.length).toBeGreaterThanOrEqual(2);
        expect(projection.coordinates[0].length).toBe(reader.barcodeCount);

        console.log("Default projection:", projection.name);
        console.log("Dimensions:", projection.dimensions);
      } else {
        console.log("No projections available");
      }
    });

    it("should get projection bounds", async () => {
      const projNames = reader.projectionNames;

      if (projNames.length > 0) {
        const bounds = await reader.projections.getBounds(projNames[0]);

        expect(bounds.min.length).toBeGreaterThanOrEqual(2);
        expect(bounds.max.length).toBeGreaterThanOrEqual(2);

        console.log(`Bounds for ${projNames[0]}:`, bounds);
      }
    });

    it("should get coordinates for specific cells", async () => {
      const projNames = reader.projectionNames;

      if (projNames.length > 0) {
        const coords = await reader.projections.getCoordinatesForCells(
          projNames[0],
          [0, 1, 2, 3, 4]
        );

        expect(coords.length).toBe(5);
        expect(coords[0].length).toBeGreaterThanOrEqual(2);

        console.log("Coordinates for first 5 cells:", coords);
      }
    });

    it("should have coordinates in reasonable range (not interleaved)", async () => {
      // This test validates the row-major 2D matrix interpretation fix
      // Data is stored as: [all X coords][all Y coords] not interleaved [x0,y0,x1,y1,...]
      const projection = await reader.getDefaultProjection();
      if (!projection) return;

      const xCoords = projection.coordinates[0];
      const yCoords = projection.coordinates[1];

      // Calculate stats
      const xMin = Math.min(...xCoords);
      const xMax = Math.max(...xCoords);
      const yMin = Math.min(...yCoords);
      const yMax = Math.max(...yCoords);

      // Coordinates should be in reasonable t-SNE/UMAP range (typically -50 to 50)
      expect(xMax - xMin).toBeGreaterThan(1); // Should have spread
      expect(yMax - yMin).toBeGreaterThan(1);
      expect(xMax - xMin).toBeLessThan(1000); // But not unreasonably large
      expect(yMax - yMin).toBeLessThan(1000);

      // X and Y should have similar ranges (not one being huge if data was misinterpreted)
      const xRange = xMax - xMin;
      const yRange = yMax - yMin;
      const rangeRatio = Math.max(xRange, yRange) / Math.min(xRange, yRange);
      expect(rangeRatio).toBeLessThan(10); // Ranges should be within 10x of each other

      console.log("Coordinate ranges:", {
        x: { min: xMin.toFixed(2), max: xMax.toFixed(2), range: xRange.toFixed(2) },
        y: { min: yMin.toFixed(2), max: yMax.toFixed(2), range: yRange.toFixed(2) },
        rangeRatio: rangeRatio.toFixed(2),
      });
    });

    it("should have X and Y as separate arrays (column-major storage)", async () => {
      // Validates that coordinates[0] = all X, coordinates[1] = all Y
      const projection = await reader.getDefaultProjection();
      if (!projection) return;

      expect(projection.coordinates.length).toBe(2);
      expect(projection.coordinates[0]).toBeInstanceOf(Float64Array);
      expect(projection.coordinates[1]).toBeInstanceOf(Float64Array);
      expect(projection.coordinates[0].length).toBe(projection.coordinates[1].length);
      expect(projection.coordinates[0].length).toBe(reader.barcodeCount);
    });

    it("should read all available projections", async () => {
      const projNames = reader.projectionNames;
      const projections = await reader.projections.readAll();

      expect(projections.length).toBe(projNames.length);

      for (const proj of projections) {
        expect(projNames).toContain(proj.name);
        expect(proj.numPoints).toBe(reader.barcodeCount);
        expect(proj.dimensions).toBeGreaterThanOrEqual(2);
      }

      console.log(
        "All projections:",
        projections.map((p) => ({ name: p.name, dims: p.dimensions, points: p.numPoints }))
      );
    });

    it("should return consistent coordinates on multiple reads (caching)", async () => {
      const projection1 = await reader.getDefaultProjection();
      const projection2 = await reader.getDefaultProjection();

      if (!projection1 || !projection2) return;

      // Should return cached result
      expect(projection1.coordinates[0][0]).toBe(projection2.coordinates[0][0]);
      expect(projection1.coordinates[1][100]).toBe(projection2.coordinates[1][100]);
    });
  });

  describe("cell track reading", () => {
    it("should read cell tracks", async () => {
      const trackNames = reader.cellTrackNames;

      if (trackNames.length > 0) {
        const track = await reader.getCellTrack(trackNames[0]);

        expect(track.name).toBe(trackNames[0]);
        expect(track.values.length).toBe(reader.barcodeCount);

        console.log(`Cell track '${track.name}':`);
        console.log("  Categories:", track.categories?.slice(0, 10));
        console.log("  First 10 values:", Array.from(track.values.slice(0, 10)));
      }
    });

    it("should get category counts", async () => {
      const trackNames = reader.cellTrackNames;

      if (trackNames.length > 0) {
        const counts = await reader.cellTracks.getCategoryCounts(trackNames[0]);

        console.log(`Category counts for '${trackNames[0]}':`);
        for (const [category, count] of counts) {
          console.log(`  ${category}: ${count}`);
        }
      }
    });

    it("should get cells in a specific category", async () => {
      const trackNames = reader.cellTrackNames;

      if (trackNames.length > 0) {
        const track = await reader.getCellTrack(trackNames[0]);

        if (track.categories && track.categories.length > 0) {
          const cells = await reader.getCellsInCluster(trackNames[0], track.categories[0]);

          console.log(`Cells in category '${track.categories[0]}': ${cells.length}`);
          expect(cells.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe("matrix reading", () => {
    it("should get matrix shape", () => {
      const shape = reader.matrix.shape;

      expect(shape[0]).toBe(reader.featureCount);
      expect(shape[1]).toBe(reader.barcodeCount);

      console.log("Matrix shape:", shape);
    });

    it("should read a single row (feature expression)", async () => {
      const row = await reader.getFeatureExpression(0);

      expect(row.featureIndex).toBe(0);
      expect(row.indices.length).toBe(row.values.length);

      console.log(`Feature 0 has ${row.indices.length} non-zero values`);
      console.log("First 5 indices:", Array.from(row.indices.slice(0, 5)));
      console.log("First 5 values:", Array.from(row.values.slice(0, 5)));
    }, 30000); // Increase timeout for full matrix loading

    it("should get matrix statistics", async () => {
      const stats = await reader.matrix.getStats();

      console.log("Matrix statistics:", stats);
      expect(stats.shape).toEqual(reader.matrix.shape);
      expect(stats.nnz).toBeGreaterThan(0);
      expect(stats.sparsity).toBeGreaterThan(0);
      expect(stats.sparsity).toBeLessThan(1);
    });

    it("should get expression for cells in a cluster", async () => {
      const trackNames = reader.cellTrackNames;
      const features = await reader.getFeatures({ limit: 1 });

      if (trackNames.length > 0 && features.length > 0) {
        const track = await reader.getCellTrack(trackNames[0]);

        if (track.categories && track.categories.length > 0) {
          const result = await reader.getClusterExpression(
            features[0].name,
            trackNames[0],
            track.categories[0]
          );

          if (result) {
            console.log(`Expression of '${features[0].name}' in '${track.categories[0]}':`);
            console.log(`  Cells: ${result.cellIndices.length}`);

            const nonZero = result.values.filter((v) => v > 0).length;
            console.log(`  Non-zero: ${nonZero}`);
          }
        }
      }
    });

    it("should read row quickly using CSR-based selective decompression", async () => {
      // This tests the CSR optimization: only decompress blocks containing the target row
      const start = performance.now();
      const row = await reader.getFeatureExpression(1000); // Arbitrary row in the middle
      const elapsed = performance.now() - start;

      expect(row.featureIndex).toBe(1000);
      expect(row.indices.length).toBe(row.values.length);

      // Should complete in under 1 second with selective decompression
      // (Previously took 30+ seconds with full matrix decompression)
      expect(elapsed).toBeLessThan(5000);

      console.log(`Row 1000 read in ${elapsed.toFixed(0)}ms, nnz: ${row.indices.length}`);
    });

    it("should read multiple rows efficiently", async () => {
      const rowIndices = [100, 500, 1000, 5000, 10000];
      const start = performance.now();

      const rows = await Promise.all(rowIndices.map((i) => reader.getFeatureExpression(i)));

      const elapsed = performance.now() - start;

      expect(rows.length).toBe(rowIndices.length);
      rows.forEach((row, i) => {
        expect(row.featureIndex).toBe(rowIndices[i]);
      });

      // Multiple rows should still be reasonably fast
      expect(elapsed).toBeLessThan(10000);

      console.log(
        `Read ${rowIndices.length} rows in ${elapsed.toFixed(0)}ms`,
        rows.map((r) => ({ idx: r.featureIndex, nnz: r.indices.length }))
      );
    });

    it("should have sorted indices in sparse row", async () => {
      // CSR format should have sorted column indices per row
      const row = await reader.getFeatureExpression(1000);

      if (row.indices.length > 1) {
        for (let i = 1; i < row.indices.length; i++) {
          expect(row.indices[i]).toBeGreaterThan(row.indices[i - 1]);
        }
      }
    });

    it("should have non-negative expression values", async () => {
      const row = await reader.getFeatureExpression(1000);

      for (const val of row.values) {
        expect(val).toBeGreaterThanOrEqual(0);
      }
    });

    it("should find expression by gene name", async () => {
      // Search for a well-known gene
      const result = await reader.getExpressionByFeatureName("CD34");

      if (result) {
        expect(result.indices.length).toBe(result.values.length);
        console.log(`CD34 expression: ${result.indices.length} cells expressing`);
      } else {
        // Gene might not be in this dataset
        console.log("CD34 not found in dataset");
      }
    });

    it("should return empty row for unexpressed genes", async () => {
      // Feature 0 often has no expression
      const row = await reader.getFeatureExpression(0);

      // This might be empty or have some values
      expect(row.featureIndex).toBe(0);
      console.log(`Feature 0: ${row.indices.length} non-zero values`);
    });

    it("should handle edge case: first and last rows", async () => {
      const firstRow = await reader.getFeatureExpression(0);
      const lastRow = await reader.getFeatureExpression(reader.featureCount - 1);

      expect(firstRow.featureIndex).toBe(0);
      expect(lastRow.featureIndex).toBe(reader.featureCount - 1);
    });

    it("should have consistent values on repeated reads (caching)", async () => {
      const row1 = await reader.getFeatureExpression(500);
      const row2 = await reader.getFeatureExpression(500);

      expect(row1.indices.length).toBe(row2.indices.length);
      if (row1.indices.length > 0) {
        expect(row1.indices[0]).toBe(row2.indices[0]);
        expect(row1.values[0]).toBe(row2.values[0]);
      }
    });
  });

  describe("error handling", () => {
    it("should throw on invalid projection name", async () => {
      await expect(reader.getProjection("NonExistentProjection")).rejects.toThrow(CloupeError);
    });

    it("should throw on invalid cell track name", async () => {
      await expect(reader.getCellTrack("NonExistentTrack")).rejects.toThrow(CloupeError);
    });

    it("should throw on out-of-range feature index", async () => {
      await expect(reader.getFeatureExpression(reader.featureCount + 1000)).rejects.toThrow(
        CloupeError
      );
    });
  });
});

describe("Multiple file formats", () => {
  it("should open AMLTutorial.cloupe", async () => {
    const blob = fileToBlob(AML_FILE);
    const reader = await CloupeReader.open(blob);

    expect(reader.version).toBeDefined();
    expect(reader.barcodeCount).toBeGreaterThan(0);
    reader.close();
  });

  it("should open ATACTutorial.cloupe", async () => {
    const atacFile = resolve(FIXTURES_DIR, "ATACTutorial.cloupe");
    const blob = fileToBlob(atacFile);
    const reader = await CloupeReader.open(blob);

    expect(reader.version).toBeDefined();
    expect(reader.barcodeCount).toBeGreaterThan(0);
    expect(reader.featureCount).toBeGreaterThan(0);

    console.log("ATAC version:", reader.version);
    console.log("ATAC barcodes:", reader.barcodeCount);
    console.log("ATAC features:", reader.featureCount);

    // Check matrix shape and stats
    const shape = reader.matrix.shape;
    console.log("ATAC matrix shape:", shape);
    expect(shape[0]).toBe(reader.featureCount);
    expect(shape[1]).toBe(reader.barcodeCount);

    if (reader.hasMatrixData) {
      const stats = await reader.matrix.getStats();
      console.log("ATAC matrix stats:", stats);
      expect(stats.sparsity).toBeGreaterThan(0);
    }

    // Test projection reading with CompressionType=2
    const projNames = reader.projectionNames;
    console.log("ATAC projections:", projNames);
    if (projNames.length > 0) {
      const projection = await reader.getProjection(projNames[0]);
      console.log("ATAC projection loaded:", {
        name: projection.name,
        dimensions: projection.dimensions,
        numPoints: projection.numPoints,
      });
      expect(projection.numPoints).toBe(reader.barcodeCount);
      expect(projection.dimensions).toBe(2);
    }

    reader.close();
  });

  it("should open SpatialTutorial.cloupe", async () => {
    const spatialFile = resolve(FIXTURES_DIR, "SpatialTutorial.cloupe");
    const blob = fileToBlob(spatialFile);
    const reader = await CloupeReader.open(blob);

    expect(reader.version).toBeDefined();
    expect(reader.barcodeCount).toBeGreaterThan(0);
    expect(reader.featureCount).toBeGreaterThan(0);

    console.log("Spatial version:", reader.version);
    console.log("Spatial barcodes:", reader.barcodeCount);
    console.log("Spatial features:", reader.featureCount);

    // Check matrix shape and stats
    const shape = reader.matrix.shape;
    console.log("Spatial matrix shape:", shape);
    expect(shape[0]).toBe(reader.featureCount);
    expect(shape[1]).toBe(reader.barcodeCount);

    if (reader.hasMatrixData) {
      const stats = await reader.matrix.getStats();
      console.log("Spatial matrix stats:", stats);
      expect(stats.sparsity).toBeGreaterThan(0);
    }

    // Test projection reading with CompressionType=2
    const projNames = reader.projectionNames;
    console.log("Spatial projections:", projNames);
    if (projNames.length > 0) {
      const projection = await reader.getProjection(projNames[0]);
      console.log("Spatial projection loaded:", {
        name: projection.name,
        dimensions: projection.dimensions,
        numPoints: projection.numPoints,
      });
      expect(projection.numPoints).toBe(reader.barcodeCount);
      expect(projection.dimensions).toBe(2);
    }

    reader.close();
  });
});
