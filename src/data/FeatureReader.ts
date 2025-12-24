/**
 * FeatureReader - Reads feature (gene/protein) data from .cloupe files
 *
 * Features are stored as fixed-width UTF-8 strings with null padding.
 * Each feature has an ID (Genes), name (GeneNames), and optionally a type.
 */

import {
  CloupeError,
  CloupeErrorCode,
  CompressionType,
  type Feature,
  type MatrixInfo,
  type PaginationOptions,
} from "../types/index.js";
import type { BlockReader } from "../core/BlockReader.js";

/**
 * Reads feature data from a .cloupe file
 */
export class FeatureReader {
  private blockReader: BlockReader;
  private matrixInfo: MatrixInfo;
  private cachedFeatures: Feature[] | null = null;
  private cachedIds: string[] | null = null;
  private cachedNames: string[] | null = null;

  constructor(blockReader: BlockReader, matrixInfo: MatrixInfo) {
    this.blockReader = blockReader;
    this.matrixInfo = matrixInfo;
  }

  /**
   * Gets the total number of features
   */
  get count(): number {
    // Try explicit counts first
    if (this.matrixInfo.GeneCount && this.matrixInfo.GeneCount > 0) {
      return this.matrixInfo.GeneCount;
    }
    if (this.matrixInfo.Rows && this.matrixInfo.Rows > 0) {
      return this.matrixInfo.Rows;
    }

    // Try ArraySize from ID block
    const idBlock = this.featureIdBlock;
    if (idBlock?.ArraySize && idBlock.ArraySize > 0) {
      return idBlock.ArraySize;
    }

    // Try ArraySize from Name block
    const nameBlock = this.featureNameBlock;
    if (nameBlock?.ArraySize && nameBlock.ArraySize > 0) {
      return nameBlock.ArraySize;
    }

    // For CSR format: numFeatures = CSRPointers.ArraySize - 1 (rows are features)
    const csrPointers = this.matrixInfo.CSRPointers;
    if (csrPointers?.ArraySize && csrPointers.ArraySize > 1) {
      return csrPointers.ArraySize - 1;
    }

    // Calculate from block size as last resort
    if (idBlock && idBlock.ArrayWidth && idBlock.ArrayWidth > 0) {
      const blockSize = idBlock.End - idBlock.Start;
      if (blockSize > 0) {
        return Math.floor(blockSize / idBlock.ArrayWidth);
      }
    }
    if (nameBlock && nameBlock.ArrayWidth && nameBlock.ArrayWidth > 0) {
      const blockSize = nameBlock.End - nameBlock.Start;
      if (blockSize > 0) {
        return Math.floor(blockSize / nameBlock.ArrayWidth);
      }
    }

    return 0;
  }

  /**
   * Gets the feature ID block information (Genes or Features)
   */
  private get featureIdBlock() {
    return this.matrixInfo.Genes ?? this.matrixInfo.Features;
  }

  /**
   * Gets the feature name block information (GeneNames or FeatureNames)
   */
  private get featureNameBlock() {
    return this.matrixInfo.GeneNames ?? this.matrixInfo.FeatureNames;
  }

  /**
   * Gets the feature type block information
   */
  private get featureTypeBlock() {
    return this.matrixInfo.FeatureTypes;
  }

  /**
   * Checks if feature data is available
   */
  get isAvailable(): boolean {
    return this.featureIdBlock !== undefined || this.featureNameBlock !== undefined;
  }

  /**
   * Reads all features (cached after first read)
   */
  async readAll(): Promise<Feature[]> {
    if (this.cachedFeatures) {
      return this.cachedFeatures;
    }

    const features = await this.read();
    this.cachedFeatures = features;
    return features;
  }

  /**
   * Reads feature IDs only
   */
  async readIds(options?: PaginationOptions): Promise<string[]> {
    const block = this.featureIdBlock;

    if (!block) {
      // Fall back to names if IDs not available
      return this.readNames(options);
    }

    // Use cache if reading all
    if (!options && this.cachedIds) {
      return this.cachedIds;
    }

    const totalCount = block.ArraySize;
    const width = block.ArrayWidth;

    // Handle CompressionType=2 (block-indexed compression)
    const allIds =
      block.CompressionType === CompressionType.BLOCK && block.Index
        ? await this.blockReader.readFixedStringsFromBlock(block)
        : await this.blockReader.readFixedStrings(block.Start, block.End, width, totalCount);

    if (!options) {
      this.cachedIds = allIds;
      return allIds;
    }

    const { offset = 0, limit } = options;
    const startIndex = Math.max(0, Math.min(offset, totalCount));
    const endIndex = limit !== undefined ? Math.min(startIndex + limit, totalCount) : totalCount;

    return allIds.slice(startIndex, endIndex);
  }

  /**
   * Reads feature names only
   */
  async readNames(options?: PaginationOptions): Promise<string[]> {
    const block = this.featureNameBlock;

    if (!block) {
      // Fall back to IDs if names not available
      const idBlock = this.featureIdBlock;
      if (idBlock) {
        return this.readIds(options);
      }
      throw new CloupeError("Feature data not available in this file", CloupeErrorCode.NOT_FOUND);
    }

    // Use cache if reading all
    if (!options && this.cachedNames) {
      return this.cachedNames;
    }

    const totalCount = block.ArraySize;
    const width = block.ArrayWidth;

    // Handle CompressionType=2 (block-indexed compression)
    const allNames =
      block.CompressionType === CompressionType.BLOCK && block.Index
        ? await this.blockReader.readFixedStringsFromBlock(block)
        : await this.blockReader.readFixedStrings(block.Start, block.End, width, totalCount);

    if (!options) {
      this.cachedNames = allNames;
      return allNames;
    }

    const { offset = 0, limit } = options;
    const startIndex = Math.max(0, Math.min(offset, totalCount));
    const endIndex = limit !== undefined ? Math.min(startIndex + limit, totalCount) : totalCount;

    return allNames.slice(startIndex, endIndex);
  }

  /**
   * Reads feature types only
   */
  async readTypes(options?: PaginationOptions): Promise<string[] | null> {
    const block = this.featureTypeBlock;

    if (!block) {
      return null;
    }

    const totalCount = block.ArraySize;
    const width = block.ArrayWidth;

    // Handle CompressionType=2 (block-indexed compression)
    const allTypes =
      block.CompressionType === CompressionType.BLOCK && block.Index
        ? await this.blockReader.readFixedStringsFromBlock(block)
        : await this.blockReader.readFixedStrings(block.Start, block.End, width, totalCount);

    if (!options) {
      return allTypes;
    }

    const { offset = 0, limit } = options;
    const startIndex = Math.max(0, Math.min(offset, totalCount));
    const endIndex = limit !== undefined ? Math.min(startIndex + limit, totalCount) : totalCount;

    return allTypes.slice(startIndex, endIndex);
  }

  /**
   * Reads features with all available fields
   */
  async read(options?: PaginationOptions): Promise<Feature[]> {
    const [ids, names, types] = await Promise.all([
      this.featureIdBlock ? this.readIds(options) : null,
      this.featureNameBlock ? this.readNames(options) : null,
      this.readTypes(options),
    ]);

    // Use whichever is available as the primary identifier
    const primaryList = ids ?? names;

    if (!primaryList) {
      throw new CloupeError("Feature data not available in this file", CloupeErrorCode.NOT_FOUND);
    }

    // Calculate base index for pagination
    const baseIndex = options?.offset ?? 0;

    return primaryList.map((_, i) => ({
      index: baseIndex + i,
      id: ids?.[i] ?? names![i],
      name: names?.[i] ?? ids![i],
      type: types?.[i],
    }));
  }

  /**
   * Reads a single feature by index
   */
  async readOne(index: number): Promise<Feature> {
    if (index < 0 || index >= this.count) {
      throw new CloupeError(
        `Feature index ${index} out of range [0, ${this.count})`,
        CloupeErrorCode.INVALID_DATA
      );
    }

    // Use cached data if available
    if (this.cachedFeatures) {
      const feature = this.cachedFeatures[index];
      return { ...feature, index };
    }

    const features = await this.readAll();
    return { ...features[index], index };
  }

  /**
   * Reads multiple features by indices
   */
  async readByIndices(indices: number[]): Promise<Feature[]> {
    if (indices.length === 0) {
      return [];
    }

    const features = await this.readAll();
    return indices.map((i) => {
      if (i < 0 || i >= features.length) {
        throw new CloupeError(
          `Feature index ${i} out of range [0, ${features.length})`,
          CloupeErrorCode.INVALID_DATA
        );
      }
      return { ...features[i], index: i };
    });
  }

  /**
   * Searches for features by name or ID pattern
   */
  async search(pattern: string | RegExp): Promise<{ index: number; feature: Feature }[]> {
    const features = await this.readAll();
    const regex = typeof pattern === "string" ? new RegExp(pattern, "i") : pattern;

    const results: { index: number; feature: Feature }[] = [];
    for (let i = 0; i < features.length; i++) {
      const feature = features[i];
      if (regex.test(feature.id) || regex.test(feature.name)) {
        results.push({ index: i, feature });
      }
    }

    return results;
  }

  /**
   * Finds a feature by exact name or ID
   */
  async findByName(name: string): Promise<{ index: number; feature: Feature } | null> {
    const features = await this.readAll();
    const lowerName = name.toLowerCase();

    for (let i = 0; i < features.length; i++) {
      const feature = features[i];
      if (feature.id.toLowerCase() === lowerName || feature.name.toLowerCase() === lowerName) {
        return { index: i, feature };
      }
    }

    return null;
  }

  /**
   * Clears the cached features
   */
  clearCache(): void {
    this.cachedFeatures = null;
    this.cachedIds = null;
    this.cachedNames = null;
  }
}
