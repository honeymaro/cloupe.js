/**
 * IndexParser - Parses the .cloupe file index block
 *
 * The index block is a JSON structure (potentially gzip-compressed) that
 * contains references to all data sections in the file including matrices,
 * projections, cell tracks, clusterings, and metadata.
 */

import {
  CloupeError,
  CloupeErrorCode,
  type BlockLocation,
  type IndexBlock,
  type MatrixInfo,
  type ProjectionInfo,
  type CellTrackInfo,
  type ClusteringInfo,
  type SpatialImageInfo,
  type SpatialImageTilesInfo,
} from "../types/index.js";
import type { BlockReader } from "./BlockReader.js";

/**
 * Parses the index block from a .cloupe file
 */
export class IndexParser {
  private reader: BlockReader;

  constructor(reader: BlockReader) {
    this.reader = reader;
  }

  /**
   * Reads and parses the index block
   * @param location - The byte location of the index block
   * @returns Parsed IndexBlock object
   */
  async parse(location: BlockLocation): Promise<IndexBlock> {
    try {
      const indexBlock = await this.reader.readAsJson<IndexBlock>(location.Start, location.End);

      this.validateIndexBlock(indexBlock);
      return indexBlock;
    } catch (error) {
      if (error instanceof CloupeError) {
        throw error;
      }
      throw new CloupeError("Failed to parse index block", CloupeErrorCode.INVALID_INDEX, error);
    }
  }

  /**
   * Validates the index block structure
   */
  private validateIndexBlock(index: IndexBlock): void {
    if (!index || typeof index !== "object") {
      throw new CloupeError("Index block is not a valid object", CloupeErrorCode.INVALID_INDEX);
    }
  }
}

/**
 * Extracts projection information from index block
 * Note: Projections can be at top level OR inside Analyses
 */
export function extractProjections(index: IndexBlock): ProjectionInfo[] {
  const projections: ProjectionInfo[] = [];

  // Check top-level Projections array (new format)
  if (index.Projections && Array.isArray(index.Projections)) {
    projections.push(...index.Projections);
  }

  // Also check Analyses for backward compatibility
  if (index.Analyses) {
    for (const analysis of index.Analyses) {
      if (analysis.Projections) {
        projections.push(...analysis.Projections);
      }
    }
  }

  return projections;
}

/**
 * Finds a specific projection by name
 */
export function findProjection(index: IndexBlock, name: string): ProjectionInfo | undefined {
  const projections = extractProjections(index);
  return projections.find(
    (p) => p.Name === name || p.Key === name || p.Name.toLowerCase() === name.toLowerCase()
  );
}

/**
 * Gets the primary matrix (usually the first one)
 */
export function getPrimaryMatrix(index: IndexBlock): MatrixInfo | undefined {
  return index.Matrices?.[0];
}

/**
 * Finds a specific matrix by name
 */
export function findMatrix(index: IndexBlock, name: string): MatrixInfo | undefined {
  return index.Matrices?.find((m) => m.Name === name);
}

/**
 * Extracts cell track information
 */
export function extractCellTracks(index: IndexBlock): CellTrackInfo[] {
  return index.CellTracks ?? [];
}

/**
 * Finds a specific cell track by name
 */
export function findCellTrack(index: IndexBlock, name: string): CellTrackInfo | undefined {
  return index.CellTracks?.find((ct) => ct.Name === name || ct.Key === name);
}

/**
 * Extracts clustering information
 */
export function extractClusterings(index: IndexBlock): ClusteringInfo[] {
  return index.Clusterings ?? [];
}

/**
 * Finds a specific clustering by name
 */
export function findClustering(index: IndexBlock, name: string): ClusteringInfo | undefined {
  return index.Clusterings?.find(
    (c) => c.Name === name || c.Name.toLowerCase() === name.toLowerCase()
  );
}

/**
 * Gets summary statistics from the index
 */
export function getIndexSummary(index: IndexBlock): {
  matrixCount: number;
  projectionCount: number;
  cellTrackCount: number;
  clusteringCount: number;
  hasMetrics: boolean;
  analysisCount: number;
  geneCount: number;
  cellCount: number;
} {
  const matrix = getPrimaryMatrix(index);

  return {
    matrixCount: index.Matrices?.length ?? 0,
    projectionCount: extractProjections(index).length,
    cellTrackCount: index.CellTracks?.length ?? 0,
    clusteringCount: index.Clusterings?.length ?? 0,
    hasMetrics: (index.Metrics?.length ?? 0) > 0,
    analysisCount: index.Analyses?.length ?? 0,
    geneCount: matrix?.GeneCount ?? matrix?.Rows ?? 0,
    cellCount: matrix?.CellCount ?? matrix?.Columns ?? 0,
  };
}

/**
 * Convenience function to parse index from BlockReader
 */
export async function parseIndex(
  reader: BlockReader,
  location: BlockLocation
): Promise<IndexBlock> {
  const parser = new IndexParser(reader);
  return parser.parse(location);
}

/**
 * Extracts spatial image information
 */
export function extractSpatialImages(index: IndexBlock): SpatialImageInfo[] {
  return index.SpatialImages ?? [];
}

/**
 * Extracts spatial image tiles information
 */
export function extractSpatialImageTiles(index: IndexBlock): SpatialImageTilesInfo[] {
  return index.SpatialImageTiles ?? [];
}

/**
 * Finds a specific spatial image by name
 */
export function findSpatialImage(index: IndexBlock, name: string): SpatialImageInfo | undefined {
  return index.SpatialImages?.find(
    (s) => s.Name === name || s.Name.toLowerCase() === name.toLowerCase()
  );
}

/**
 * Finds spatial image tiles by name (matches SpatialImage name via ParentUuid)
 */
export function findSpatialImageTiles(
  index: IndexBlock,
  name: string
): SpatialImageTilesInfo | undefined {
  // First try direct name match
  const direct = index.SpatialImageTiles?.find(
    (t) => t.Name === name || t.Name.toLowerCase() === name.toLowerCase()
  );
  if (direct) return direct;

  // Try to find by matching ParentUuid with SpatialImage's Uuid
  const spatialImage = findSpatialImage(index, name);
  if (spatialImage?.Uuid) {
    return index.SpatialImageTiles?.find((t) => t.ParentUuid === spatialImage.Uuid);
  }

  return undefined;
}
