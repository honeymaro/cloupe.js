/**
 * ProjectionReader - Reads dimensionality reduction projections from .cloupe files
 *
 * Projections (UMAP, t-SNE, PCA, etc.) store 2D or 3D coordinates for each cell.
 * Data is stored as arrays of 64-bit doubles in column-major order.
 */

import {
  CloupeError,
  CloupeErrorCode,
  CompressionType,
  Projection,
  type ProjectionInfo,
  type IndexBlock,
} from "../types/index.js";
import type { BlockReader } from "../core/BlockReader.js";
import { extractProjections, findProjection } from "../core/IndexParser.js";

/**
 * Reads projection data from a .cloupe file
 */
export class ProjectionReader {
  private blockReader: BlockReader;
  private indexBlock: IndexBlock;
  private cachedProjections: Map<string, Projection> = new Map();

  constructor(blockReader: BlockReader, indexBlock: IndexBlock) {
    this.blockReader = blockReader;
    this.indexBlock = indexBlock;
  }

  /**
   * Gets all available projection names
   */
  get availableProjections(): string[] {
    return extractProjections(this.indexBlock).map((p) => p.Name);
  }

  /**
   * Gets the number of available projections
   */
  get count(): number {
    return extractProjections(this.indexBlock).length;
  }

  /**
   * Gets projection info by name
   */
  getProjectionInfo(name: string): ProjectionInfo | undefined {
    return findProjection(this.indexBlock, name);
  }

  /**
   * Reads a projection by name
   * @param name - Projection name (e.g., "UMAP", "t-SNE")
   */
  async read(name: string): Promise<Projection> {
    // Check cache
    const cached = this.cachedProjections.get(name);
    if (cached) {
      return cached;
    }

    const projInfo = findProjection(this.indexBlock, name);
    if (!projInfo) {
      throw new CloupeError(
        `Projection "${name}" not found. Available: ${this.availableProjections.join(", ")}`,
        CloupeErrorCode.NOT_FOUND
      );
    }

    const projection = await this.readProjectionData(projInfo);

    // Cache the result
    this.cachedProjections.set(name, projection);
    return projection;
  }

  /**
   * Reads projection data from ProjectionInfo
   */
  private async readProjectionData(projInfo: ProjectionInfo): Promise<Projection> {
    const matrix = projInfo.Matrix;

    if (!matrix) {
      throw new CloupeError(
        `Projection "${projInfo.Name}" has no matrix data`,
        CloupeErrorCode.INVALID_DATA
      );
    }

    // Dims array format: [numDimensions, numPoints] e.g., [2, 8414]
    const dims = projInfo.Dims ?? [2];
    const numDimensions = dims.length > 0 ? dims[0] : 2;
    const numPoints = dims.length > 1 ? dims[1] : Math.floor(matrix.ArraySize / numDimensions);

    // Total number of coordinate values
    const totalValues = matrix.ArraySize;
    const expectedValues = numDimensions * numPoints;

    // Read all coordinate data as doubles
    // Handle CompressionType=2 (block-indexed compression)
    let allCoords: Float64Array;
    if (matrix.CompressionType === CompressionType.BLOCK && matrix.Index) {
      try {
        allCoords = await this.blockReader.readFloat64ArrayFromBlock(matrix);
      } catch (error) {
        // Fallback: try reading without block-index decompression
        console.warn(
          `Block-indexed decompression failed for projection "${projInfo.Name}", trying standard read:`,
          error
        );
        allCoords = await this.blockReader.readFloat64Array(
          matrix.Start,
          matrix.End,
          Math.min(totalValues, expectedValues)
        );
      }
    } else {
      allCoords = await this.blockReader.readFloat64Array(
        matrix.Start,
        matrix.End,
        Math.min(totalValues, expectedValues)
      );
    }

    // Debug: Log the number of coordinates read
    if (allCoords.length === 0) {
      console.warn(
        `Projection "${projInfo.Name}": No coordinates read. Expected ${expectedValues}, got ${allCoords.length}`
      );
    }

    // Use numPoints from Dims, not calculated from allCoords.length
    // (decompression might not return all data due to block issues)
    const actualNumPoints = numPoints;

    // Data is stored as 2D matrix [numDimensions x numPoints] in row-major order
    // First 157565 values = all X coordinates
    // Next 157565 values = all Y coordinates
    const coordinates: Float64Array[] = [];
    for (let d = 0; d < numDimensions; d++) {
      const dimCoords = new Float64Array(actualNumPoints);
      const offset = d * actualNumPoints;
      for (let i = 0; i < actualNumPoints && offset + i < allCoords.length; i++) {
        dimCoords[i] = allCoords[offset + i];
      }
      coordinates.push(dimCoords);
    }

    return new Projection({
      name: projInfo.Name,
      key: projInfo.Key,
      dimensions: numDimensions,
      coordinates,
    });
  }

  /**
   * Reads all available projections
   */
  async readAll(): Promise<Projection[]> {
    const projInfos = extractProjections(this.indexBlock);
    return Promise.all(projInfos.map((info) => this.read(info.Name)));
  }

  /**
   * Reads the first available projection (usually UMAP or t-SNE)
   */
  async readDefault(): Promise<Projection | null> {
    const names = this.availableProjections;
    if (names.length === 0) {
      return null;
    }

    // Prefer common projection types
    const preferred = ["UMAP", "t-SNE", "tSNE", "tsne", "PCA"];
    for (const pref of preferred) {
      const match = names.find((n) => n.toLowerCase().includes(pref.toLowerCase()));
      if (match) {
        return this.read(match);
      }
    }

    // Fall back to first available
    return this.read(names[0]);
  }

  /**
   * Gets coordinates for a specific cell/barcode index
   */
  async getCoordinatesForCell(projectionName: string, cellIndex: number): Promise<number[]> {
    const projection = await this.read(projectionName);

    if (cellIndex < 0 || cellIndex >= projection.coordinates[0].length) {
      throw new CloupeError(
        `Cell index ${cellIndex} out of range [0, ${projection.coordinates[0].length})`,
        CloupeErrorCode.INVALID_DATA
      );
    }

    return projection.coordinates.map((coords) => coords[cellIndex]);
  }

  /**
   * Gets coordinates for multiple cells
   */
  async getCoordinatesForCells(projectionName: string, cellIndices: number[]): Promise<number[][]> {
    const projection = await this.read(projectionName);
    const numPoints = projection.coordinates[0].length;

    return cellIndices.map((index) => {
      if (index < 0 || index >= numPoints) {
        throw new CloupeError(
          `Cell index ${index} out of range [0, ${numPoints})`,
          CloupeErrorCode.INVALID_DATA
        );
      }
      return projection.coordinates.map((coords) => coords[index]);
    });
  }

  /**
   * Gets bounding box of a projection
   */
  async getBounds(projectionName: string): Promise<{
    min: number[];
    max: number[];
  }> {
    const projection = await this.read(projectionName);

    const min: number[] = [];
    const max: number[] = [];

    for (const coords of projection.coordinates) {
      let dimMin = Infinity;
      let dimMax = -Infinity;

      for (let i = 0; i < coords.length; i++) {
        const val = coords[i];
        if (val < dimMin) dimMin = val;
        if (val > dimMax) dimMax = val;
      }

      min.push(dimMin);
      max.push(dimMax);
    }

    return { min, max };
  }

  /**
   * Clears the cache for all or specific projections
   */
  clearCache(projectionName?: string): void {
    if (projectionName) {
      this.cachedProjections.delete(projectionName);
    } else {
      this.cachedProjections.clear();
    }
  }
}
