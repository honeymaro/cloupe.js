/**
 * SpatialImageReader - Reads spatial H&E images from .cloupe files
 *
 * Spatial images are stored as tile pyramids (like web map tiles) enabling
 * efficient viewing at different zoom levels without loading the entire
 * image into memory.
 */

import {
  CloupeError,
  CloupeErrorCode,
  SpatialImage,
  type SpatialImageInfo,
  type SpatialImageTilesInfo,
  type IndexBlock,
  type ZoomLevelInfo,
} from "../types/index.js";
import type { BlockReader } from "../core/BlockReader.js";
import {
  extractSpatialImages,
  findSpatialImage,
  findSpatialImageTiles,
} from "../core/IndexParser.js";

/**
 * Reads spatial image data from a .cloupe file
 */
export class SpatialImageReader {
  private blockReader: BlockReader;
  private indexBlock: IndexBlock;
  private cachedMetadata: Map<string, SpatialImage> = new Map();
  private tileCache: Map<string, Uint8Array> = new Map();
  private tileCacheOrder: string[] = []; // For LRU eviction
  private maxTileCacheSize: number = 100;

  constructor(blockReader: BlockReader, indexBlock: IndexBlock) {
    this.blockReader = blockReader;
    this.indexBlock = indexBlock;
  }

  /**
   * Gets all available spatial image names
   */
  get availableImages(): string[] {
    return extractSpatialImages(this.indexBlock).map((s) => s.Name);
  }

  /**
   * Gets the number of available spatial images
   */
  get count(): number {
    return extractSpatialImages(this.indexBlock).length;
  }

  /**
   * Gets spatial image info by name
   */
  getImageInfo(name: string): SpatialImageInfo | undefined {
    return findSpatialImage(this.indexBlock, name);
  }

  /**
   * Gets spatial image tiles info by name
   */
  getTilesInfo(name: string): SpatialImageTilesInfo | undefined {
    return findSpatialImageTiles(this.indexBlock, name);
  }

  /**
   * Reads spatial image metadata by name
   */
  async read(name: string): Promise<SpatialImage> {
    // Check cache
    const cached = this.cachedMetadata.get(name);
    if (cached) {
      return cached;
    }

    const imageInfo = findSpatialImage(this.indexBlock, name);
    if (!imageInfo) {
      throw new CloupeError(
        `Spatial image "${name}" not found. Available: ${this.availableImages.join(", ")}`,
        CloupeErrorCode.NOT_FOUND
      );
    }

    const tilesInfo = findSpatialImageTiles(this.indexBlock, name);
    if (!tilesInfo) {
      throw new CloupeError(
        `Spatial image tiles for "${name}" not found`,
        CloupeErrorCode.NOT_FOUND
      );
    }

    const spatialImage = this.buildSpatialImage(imageInfo, tilesInfo);

    // Cache the result
    this.cachedMetadata.set(name, spatialImage);
    return spatialImage;
  }

  /**
   * Reads the default (first) spatial image
   */
  async readDefault(): Promise<SpatialImage | null> {
    const names = this.availableImages;
    if (names.length === 0) return null;
    return this.read(names[0]);
  }

  /**
   * Builds a SpatialImage from info objects
   */
  private buildSpatialImage(
    imageInfo: SpatialImageInfo,
    tilesInfo: SpatialImageTilesInfo
  ): SpatialImage {
    // Parse zoom levels from tile keys
    const zoomLevels = this.parseZoomLevels(tilesInfo.Tiles);

    return new SpatialImage({
      name: imageInfo.Name,
      width: imageInfo.Dims[0],
      height: imageInfo.Dims[1],
      format: imageInfo.Format,
      type: imageInfo.Type ?? "unknown",
      tileSize: tilesInfo.TileSize,
      tileOverlap: tilesInfo.TileOverlap ?? 0,
      zoomLevels,
    });
  }

  /**
   * Parses zoom level information from tile keys
   */
  private parseZoomLevels(tiles: Record<string, unknown>): ZoomLevelInfo[] {
    const levelData = new Map<number, { maxX: number; maxY: number; count: number }>();

    for (const key of Object.keys(tiles)) {
      // Parse key like "15/10_5.png"
      const match = key.match(/^(\d+)\/(\d+)_(\d+)\.png$/);
      if (!match) continue;

      const level = parseInt(match[1], 10);
      const x = parseInt(match[2], 10);
      const y = parseInt(match[3], 10);

      const existing = levelData.get(level);
      if (existing) {
        existing.maxX = Math.max(existing.maxX, x);
        existing.maxY = Math.max(existing.maxY, y);
        existing.count++;
      } else {
        levelData.set(level, { maxX: x, maxY: y, count: 1 });
      }
    }

    // Convert to ZoomLevelInfo array
    const zoomLevels: ZoomLevelInfo[] = [];
    for (const [level, data] of levelData.entries()) {
      zoomLevels.push({
        level,
        gridWidth: data.maxX + 1,
        gridHeight: data.maxY + 1,
        tileCount: data.count,
      });
    }

    // Sort by level
    return zoomLevels.sort((a, b) => a.level - b.level);
  }

  /**
   * Gets a specific tile as PNG binary data
   * @param imageName - Name of the spatial image
   * @param level - Zoom level
   * @param x - Tile X coordinate
   * @param y - Tile Y coordinate
   * @returns PNG data as Uint8Array
   */
  async getTile(imageName: string, level: number, x: number, y: number): Promise<Uint8Array> {
    const tilesInfo = findSpatialImageTiles(this.indexBlock, imageName);
    if (!tilesInfo) {
      throw new CloupeError(
        `Spatial image tiles for "${imageName}" not found`,
        CloupeErrorCode.NOT_FOUND
      );
    }

    const tileKey = `${level}/${x}_${y}.png`;

    // Check tile cache
    const cacheKey = `${imageName}:${tileKey}`;
    const cached = this.tileCache.get(cacheKey);
    if (cached) {
      // Move to end of LRU order
      const idx = this.tileCacheOrder.indexOf(cacheKey);
      if (idx > -1) {
        this.tileCacheOrder.splice(idx, 1);
        this.tileCacheOrder.push(cacheKey);
      }
      return cached;
    }

    const tileBlock = tilesInfo.Tiles[tileKey];
    if (!tileBlock) {
      throw new CloupeError(
        `Tile "${tileKey}" not found in spatial image "${imageName}"`,
        CloupeErrorCode.NOT_FOUND
      );
    }

    // Read tile data (PNG is stored uncompressed)
    const tileData = await this.blockReader.readAsUint8Array(tileBlock.Start, tileBlock.End);

    // Add to cache with LRU eviction
    this.addToTileCache(cacheKey, tileData);

    return tileData;
  }

  /**
   * Gets the thumbnail (smallest zoom level) for a spatial image
   */
  async getThumbnail(imageName?: string): Promise<Uint8Array> {
    const name = imageName ?? this.availableImages[0];
    if (!name) {
      throw new CloupeError("No spatial images available", CloupeErrorCode.NOT_FOUND);
    }

    const image = await this.read(name);

    // Get the minimum zoom level (thumbnail)
    return this.getTile(name, image.minZoom, 0, 0);
  }

  /**
   * Gets all tiles in a specific region
   */
  async getTilesInRegion(
    imageName: string,
    level: number,
    bounds: { minX: number; minY: number; maxX: number; maxY: number }
  ): Promise<Map<string, Uint8Array>> {
    const tiles = new Map<string, Uint8Array>();

    for (let y = bounds.minY; y <= bounds.maxY; y++) {
      for (let x = bounds.minX; x <= bounds.maxX; x++) {
        try {
          const tile = await this.getTile(imageName, level, x, y);
          const key = `${level}/${x}_${y}.png`;
          tiles.set(key, tile);
        } catch {
          // Skip missing tiles
        }
      }
    }

    return tiles;
  }

  /**
   * Gets a tile as a Blob URL (browser only)
   */
  async getTileAsObjectURL(
    imageName: string,
    level: number,
    x: number,
    y: number
  ): Promise<string> {
    const tileData = await this.getTile(imageName, level, x, y);
    // Create a new Uint8Array to ensure compatibility with Blob
    const copy = new Uint8Array(tileData);
    const blob = new Blob([copy.buffer], { type: "image/png" });
    return URL.createObjectURL(blob);
  }

  /**
   * Gets a tile as a Base64 data URL
   */
  async getTileAsDataURL(imageName: string, level: number, x: number, y: number): Promise<string> {
    const tileData = await this.getTile(imageName, level, x, y);

    // Convert to base64
    let binary = "";
    for (let i = 0; i < tileData.length; i++) {
      binary += String.fromCharCode(tileData[i]);
    }
    const base64 = btoa(binary);

    return `data:image/png;base64,${base64}`;
  }

  /**
   * Adds a tile to the cache with LRU eviction
   */
  private addToTileCache(key: string, data: Uint8Array): void {
    // Evict oldest if cache is full
    while (this.tileCacheOrder.length >= this.maxTileCacheSize) {
      const oldest = this.tileCacheOrder.shift();
      if (oldest) {
        this.tileCache.delete(oldest);
      }
    }

    this.tileCache.set(key, data);
    this.tileCacheOrder.push(key);
  }

  /**
   * Sets the maximum tile cache size
   */
  setTileCacheSize(size: number): void {
    this.maxTileCacheSize = size;

    // Evict excess tiles
    while (this.tileCacheOrder.length > this.maxTileCacheSize) {
      const oldest = this.tileCacheOrder.shift();
      if (oldest) {
        this.tileCache.delete(oldest);
      }
    }
  }

  /**
   * Clears the metadata cache
   */
  clearCache(imageName?: string): void {
    if (imageName) {
      this.cachedMetadata.delete(imageName);
    } else {
      this.cachedMetadata.clear();
    }
  }

  /**
   * Clears the tile cache
   */
  clearTileCache(): void {
    this.tileCache.clear();
    this.tileCacheOrder = [];
  }
}
