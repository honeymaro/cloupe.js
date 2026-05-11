import { describe, it, expect } from "vitest";
import { mergeIndexBlocks } from "../src/core/IndexParser.js";
import type { IndexBlock } from "../src/types/index.js";

describe("mergeIndexBlocks", () => {
  it("concatenates CellTracks from secondary into primary", () => {
    const primary: IndexBlock = {
      CellTracks: [{ Name: "Cluster" }],
    };
    const secondary: IndexBlock = {
      CellTracks: [{ Name: "User T cells" }, { Name: "User B cells" }],
    };
    const merged = mergeIndexBlocks(primary, secondary);
    expect(merged.CellTracks?.map((t) => t.Name)).toEqual([
      "Cluster",
      "User T cells",
      "User B cells",
    ]);
  });

  it("deduplicates by Uuid when present", () => {
    const primary: IndexBlock = {
      CellTracks: [{ Name: "Cluster", Uuid: "abc" }],
    };
    const secondary: IndexBlock = {
      CellTracks: [
        { Name: "Cluster", Uuid: "abc" },
        { Name: "User", Uuid: "xyz" },
      ],
    };
    const merged = mergeIndexBlocks(primary, secondary);
    expect(merged.CellTracks?.length).toBe(2);
    expect(merged.CellTracks?.map((t) => t.Uuid)).toEqual(["abc", "xyz"]);
  });

  it("returns primary unchanged when secondary is undefined", () => {
    const primary: IndexBlock = { CellTracks: [{ Name: "A" }] };
    const merged = mergeIndexBlocks(primary, undefined);
    expect(merged).toEqual(primary);
  });

  it("merges Projections, Clusterings, DiffExps, SpatialImages, SpatialImageTiles", () => {
    const primary: IndexBlock = {};
    const secondary: IndexBlock = {
      Projections: [{ Name: "UMAP", Dims: [2], Matrix: { Start: 0, End: 1 } as never }],
      Clusterings: [{ Name: "kmeans" }],
      DiffExps: [{ Name: "de1" }],
      SpatialImages: [{ Name: "img", Dims: [10, 10] as [number, number], Format: "png" }],
      SpatialImageTiles: [
        {
          Name: "img-tiles",
          Format: "png",
          Dims: [10, 10] as [number, number],
          TileSize: 256,
          Tiles: {},
        },
      ],
    };
    const merged = mergeIndexBlocks(primary, secondary);
    expect(merged.Projections?.length).toBe(1);
    expect(merged.Clusterings?.length).toBe(1);
    expect(merged.DiffExps?.length).toBe(1);
    expect(merged.SpatialImages?.length).toBe(1);
    expect(merged.SpatialImageTiles?.length).toBe(1);
  });

  it("merges Analyses array", () => {
    const primary: IndexBlock = {};
    const secondary: IndexBlock = {
      Analyses: [{ Name: "graph-clustering" }],
    };
    const merged = mergeIndexBlocks(primary, secondary);
    expect(merged.Analyses?.length).toBe(1);
    expect(merged.Analyses?.[0].Name).toBe("graph-clustering");
  });

  it("always appends items without Uuid (no deduplication possible)", () => {
    const primary: IndexBlock = {
      CellTracks: [{ Name: "Cluster" }], // no Uuid
    };
    const secondary: IndexBlock = {
      CellTracks: [{ Name: "Cluster" }], // same name, no Uuid — should still append
    };
    const merged = mergeIndexBlocks(primary, secondary);
    expect(merged.CellTracks?.length).toBe(2);
  });
});
