/**
 * ClusteringReader - Reads clustering data from .cloupe files
 *
 * Clusterings represent algorithm-generated cell groupings such as
 * Graph-based clustering or K-means. Each cell is assigned to a cluster
 * identified by an integer ID.
 */

import {
  CloupeError,
  CloupeErrorCode,
  Clustering,
  type ClusteringInfo,
  type IndexBlock,
} from "../types/index.js";
import type { BlockReader } from "../core/BlockReader.js";
import { extractClusterings, findClustering } from "../core/IndexParser.js";

/**
 * Reads clustering data from a .cloupe file
 */
export class ClusteringReader {
  private blockReader: BlockReader;
  private indexBlock: IndexBlock;
  private cachedClusterings: Map<string, Clustering> = new Map();

  constructor(blockReader: BlockReader, indexBlock: IndexBlock) {
    this.blockReader = blockReader;
    this.indexBlock = indexBlock;
  }

  /**
   * Gets all available clustering names
   */
  get availableClusterings(): string[] {
    return extractClusterings(this.indexBlock).map((c) => c.Name);
  }

  /**
   * Gets the number of available clusterings
   */
  get count(): number {
    return extractClusterings(this.indexBlock).length;
  }

  /**
   * Gets clustering info by name
   */
  getClusteringInfo(name: string): ClusteringInfo | undefined {
    return findClustering(this.indexBlock, name);
  }

  /**
   * Reads a clustering by name
   * @param name - Clustering name (e.g., "Graph-based", "K-means (K=5)")
   */
  async read(name: string): Promise<Clustering> {
    // Check cache
    const cached = this.cachedClusterings.get(name);
    if (cached) {
      return cached;
    }

    const clusteringInfo = findClustering(this.indexBlock, name);
    if (!clusteringInfo) {
      throw new CloupeError(
        `Clustering "${name}" not found. Available: ${this.availableClusterings.join(", ")}`,
        CloupeErrorCode.NOT_FOUND
      );
    }

    const clustering = await this.readClusteringData(clusteringInfo);

    // Cache the result
    this.cachedClusterings.set(name, clustering);
    return clustering;
  }

  /**
   * Reads clustering data from ClusteringInfo
   */
  private async readClusteringData(clusteringInfo: ClusteringInfo): Promise<Clustering> {
    // Read metadata if available
    let metadata: Record<string, unknown> | undefined;
    if (clusteringInfo.Metadata) {
      try {
        metadata = await this.blockReader.readBlockAsJson<Record<string, unknown>>(
          clusteringInfo.Metadata
        );
      } catch {
        // Metadata parsing failed, continue without it
      }
    }

    // Read assignments (auto-detect Int16 or Int32 based on data size)
    let assignments: Int16Array | Int32Array;
    if (clusteringInfo.Assignments) {
      // Use readSignedIntArrayFromBlock - auto-detects element size and handles all compression types
      assignments = await this.blockReader.readSignedIntArrayFromBlock(clusteringInfo.Assignments);
    } else {
      throw new CloupeError(
        `Clustering "${clusteringInfo.Name}" has no assignments data`,
        CloupeErrorCode.INVALID_DATA
      );
    }

    return new Clustering({
      name: clusteringInfo.Name,
      assignments,
      metadata,
    });
  }

  /**
   * Reads all available clusterings
   */
  async readAll(): Promise<Clustering[]> {
    const clusteringInfos = extractClusterings(this.indexBlock);
    return Promise.all(clusteringInfos.map((info) => this.read(info.Name)));
  }

  /**
   * Gets the cluster ID for a cell by clustering name and cell index
   */
  async getClusterForCell(clusteringName: string, cellIndex: number): Promise<number | null> {
    const clustering = await this.read(clusteringName);
    return clustering.getClusterForCell(cellIndex);
  }

  /**
   * Gets cluster IDs for multiple cells
   */
  async getClustersForCells(clusteringName: string, cellIndices: number[]): Promise<number[]> {
    const clustering = await this.read(clusteringName);
    return cellIndices.map((index) => {
      const clusterId = clustering.getClusterForCell(index);
      if (clusterId === null) {
        throw new CloupeError(
          `Cell index ${index} out of range [0, ${clustering.numCells})`,
          CloupeErrorCode.INVALID_DATA
        );
      }
      return clusterId;
    });
  }

  /**
   * Gets cells belonging to a specific cluster
   * @param clusteringName - Name of the clustering
   * @param clusterId - Cluster ID
   * @returns Array of cell indices
   */
  async getCellsInCluster(clusteringName: string, clusterId: number): Promise<number[]> {
    const clustering = await this.read(clusteringName);
    return clustering.getCellsInCluster(clusterId);
  }

  /**
   * Gets cluster counts for a clustering
   */
  async getClusterCounts(clusteringName: string): Promise<Map<number, number>> {
    const clustering = await this.read(clusteringName);
    return clustering.getClusterCounts();
  }

  /**
   * Gets unique cluster IDs for a clustering
   */
  async getUniqueClusterIds(clusteringName: string): Promise<number[]> {
    const clustering = await this.read(clusteringName);
    return clustering.getUniqueClusterIds();
  }

  /**
   * Clears the cache for all or specific clusterings
   */
  clearCache(clusteringName?: string): void {
    if (clusteringName) {
      this.cachedClusterings.delete(clusteringName);
    } else {
      this.cachedClusterings.clear();
    }
  }
}
