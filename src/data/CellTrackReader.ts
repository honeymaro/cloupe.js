/**
 * CellTrackReader - Reads cell track (cluster/annotation) data from .cloupe files
 *
 * Cell tracks represent categorical annotations for each cell, such as
 * cluster assignments, cell types, or other metadata. Values are stored
 * as 16-bit signed integers indexing into a category list.
 */

import {
  CloupeError,
  CloupeErrorCode,
  CellTrack,
  type CellTrackInfo,
  type IndexBlock,
} from "../types/index.js";
import type { BlockReader } from "../core/BlockReader.js";
import { extractCellTracks, findCellTrack } from "../core/IndexParser.js";

/**
 * Reads cell track data from a .cloupe file
 */
export class CellTrackReader {
  private blockReader: BlockReader;
  private indexBlock: IndexBlock;
  private cachedTracks: Map<string, CellTrack> = new Map();

  constructor(blockReader: BlockReader, indexBlock: IndexBlock) {
    this.blockReader = blockReader;
    this.indexBlock = indexBlock;
  }

  /**
   * Gets all available cell track names
   */
  get availableTracks(): string[] {
    return extractCellTracks(this.indexBlock).map((ct) => ct.Name);
  }

  /**
   * Gets the number of available cell tracks
   */
  get count(): number {
    return extractCellTracks(this.indexBlock).length;
  }

  /**
   * Gets cell track info by name
   */
  getTrackInfo(name: string): CellTrackInfo | undefined {
    return findCellTrack(this.indexBlock, name);
  }

  /**
   * Reads a cell track by name
   * @param name - Track name (e.g., "Cluster", "Cell Type")
   */
  async read(name: string): Promise<CellTrack> {
    // Check cache
    const cached = this.cachedTracks.get(name);
    if (cached) {
      return cached;
    }

    const trackInfo = findCellTrack(this.indexBlock, name);
    if (!trackInfo) {
      throw new CloupeError(
        `Cell track "${name}" not found. Available: ${this.availableTracks.join(", ")}`,
        CloupeErrorCode.NOT_FOUND
      );
    }

    const track = await this.readTrackData(trackInfo);

    // Cache the result
    this.cachedTracks.set(name, track);
    return track;
  }

  /**
   * Reads cell track data from CellTrackInfo
   */
  private async readTrackData(trackInfo: CellTrackInfo): Promise<CellTrack> {
    // Read category names if available
    let categories: string[] | undefined;

    // Method 1: Read from Categories block (newer format)
    if (trackInfo.Categories) {
      // Always use readFixedStringsFromBlock - it handles all compression types
      categories = await this.blockReader.readFixedStringsFromBlock(trackInfo.Categories);
    }

    // Method 2: Read from Metadata.groups (older format like v0.7.0)
    if (!categories && trackInfo.Metadata) {
      try {
        const metadata = await this.blockReader.readBlockAsJson<{
          groups?: string[];
          colors?: number[][];
        }>(trackInfo.Metadata);
        if (metadata.groups && Array.isArray(metadata.groups)) {
          categories = metadata.groups;
        }
      } catch {
        // Metadata parsing failed, continue without categories
      }
    }

    // Read values (category indices for each cell, auto-detect Int16 or Int32)
    let values: Int16Array | Int32Array;
    if (trackInfo.Values) {
      // Use readSignedIntArrayFromBlock - auto-detects element size and handles all compression types
      values = await this.blockReader.readSignedIntArrayFromBlock(trackInfo.Values);
    } else {
      throw new CloupeError(
        `Cell track "${trackInfo.Name}" has no values data`,
        CloupeErrorCode.INVALID_DATA
      );
    }

    return new CellTrack({
      name: trackInfo.Name,
      key: trackInfo.Key,
      values,
      categories,
    });
  }

  /**
   * Reads all available cell tracks
   */
  async readAll(): Promise<CellTrack[]> {
    const trackInfos = extractCellTracks(this.indexBlock);
    return Promise.all(trackInfos.map((info) => this.read(info.Name)));
  }

  /**
   * Gets the category label for a cell by track name and cell index
   */
  async getCategoryForCell(trackName: string, cellIndex: number): Promise<string | number> {
    const track = await this.read(trackName);

    if (cellIndex < 0 || cellIndex >= track.values.length) {
      throw new CloupeError(
        `Cell index ${cellIndex} out of range [0, ${track.values.length})`,
        CloupeErrorCode.INVALID_DATA
      );
    }

    const categoryIndex = track.values[cellIndex];

    if (track.categories && categoryIndex >= 0 && categoryIndex < track.categories.length) {
      return track.categories[categoryIndex];
    }

    return categoryIndex;
  }

  /**
   * Gets category labels for multiple cells
   */
  async getCategoriesForCells(
    trackName: string,
    cellIndices: number[]
  ): Promise<(string | number)[]> {
    const track = await this.read(trackName);

    return cellIndices.map((index) => {
      if (index < 0 || index >= track.values.length) {
        throw new CloupeError(
          `Cell index ${index} out of range [0, ${track.values.length})`,
          CloupeErrorCode.INVALID_DATA
        );
      }

      const categoryIndex = track.values[index];

      if (track.categories && categoryIndex >= 0 && categoryIndex < track.categories.length) {
        return track.categories[categoryIndex];
      }

      return categoryIndex;
    });
  }

  /**
   * Gets cells belonging to a specific category
   * @param trackName - Name of the track
   * @param category - Category name or index
   * @returns Array of cell indices
   */
  async getCellsInCategory(trackName: string, category: string | number): Promise<number[]> {
    const track = await this.read(trackName);

    // Convert category name to index if needed
    let targetIndex: number;
    if (typeof category === "string") {
      if (!track.categories) {
        throw new CloupeError(
          `Track "${trackName}" has no category labels`,
          CloupeErrorCode.INVALID_DATA
        );
      }
      targetIndex = track.categories.indexOf(category);
      if (targetIndex === -1) {
        throw new CloupeError(
          `Category "${category}" not found in track "${trackName}"`,
          CloupeErrorCode.NOT_FOUND
        );
      }
    } else {
      targetIndex = category;
    }

    // Find all cells with this category
    const cells: number[] = [];
    for (let i = 0; i < track.values.length; i++) {
      if (track.values[i] === targetIndex) {
        cells.push(i);
      }
    }

    return cells;
  }

  /**
   * Gets unique categories and their counts
   */
  async getCategoryCounts(trackName: string): Promise<Map<string | number, number>> {
    const track = await this.read(trackName);
    const counts = new Map<string | number, number>();

    for (let i = 0; i < track.values.length; i++) {
      const categoryIndex = track.values[i];
      const label =
        track.categories && categoryIndex >= 0 && categoryIndex < track.categories.length
          ? track.categories[categoryIndex]
          : categoryIndex;

      counts.set(label, (counts.get(label) ?? 0) + 1);
    }

    return counts;
  }

  /**
   * Gets the list of unique category labels
   */
  async getUniqueCategories(trackName: string): Promise<(string | number)[]> {
    const track = await this.read(trackName);

    if (track.categories) {
      return [...track.categories];
    }

    // Extract unique values from the values array
    const unique = new Set<number>();
    for (const val of track.values) {
      unique.add(val);
    }

    return Array.from(unique).sort((a, b) => a - b);
  }

  /**
   * Clears the cache for all or specific tracks
   */
  clearCache(trackName?: string): void {
    if (trackName) {
      this.cachedTracks.delete(trackName);
    } else {
      this.cachedTracks.clear();
    }
  }
}
