/**
 * WorkerClient - Client-side interface for the Cloupe Web Worker
 *
 * Provides a Promise-based API that mirrors CloupeReader but executes
 * operations in a Web Worker for better performance on large files.
 */

import {
  type Feature,
  Projection,
  CellTrack,
  type SparseMatrix,
  type SparseRow,
  type PaginationOptions,
  type SliceOptions,
} from "../types/index.js";
import type { WorkerResponse } from "./cloupe.worker.js";

/**
 * Creates a worker instance
 * Note: The actual worker URL needs to be provided by the bundler
 */
export type WorkerFactory = () => Worker;

/**
 * Client for interacting with the Cloupe Web Worker
 */
export class CloupeWorkerClient {
  private worker: Worker;
  private requestId = 0;
  private pending = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
    }
  >();

  constructor(worker: Worker) {
    this.worker = worker;
    this.worker.onmessage = this.handleMessage.bind(this);
    this.worker.onerror = this.handleError.bind(this);
  }

  /**
   * Creates a client with a worker from a factory function
   */
  static create(workerFactory: WorkerFactory): CloupeWorkerClient {
    return new CloupeWorkerClient(workerFactory());
  }

  private handleMessage(event: MessageEvent<WorkerResponse>): void {
    const response = event.data;
    const pending = this.pending.get(response.id);

    if (!pending) {
      console.warn(`Received response for unknown request: ${response.id}`);
      return;
    }

    this.pending.delete(response.id);

    if (response.type === "error") {
      const error = new Error(response.error);
      (error as { code?: string }).code = response.code;
      pending.reject(error);
    } else {
      pending.resolve(response.result);
    }
  }

  private handleError(event: ErrorEvent): void {
    console.error("Worker error:", event);
    // Reject all pending requests
    for (const [id, pending] of this.pending) {
      pending.reject(new Error(`Worker error: ${event.message}`));
      this.pending.delete(id);
    }
  }

  private send<T>(request: Record<string, unknown> & { type: string }): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.worker.postMessage({ ...request, id });
    });
  }

  /**
   * Opens a .cloupe file in the worker
   */
  async open(file: File | Blob): Promise<void> {
    await this.send({ type: "open", file });
  }

  /**
   * Closes the file and releases resources
   */
  async close(): Promise<void> {
    await this.send({ type: "close" });
  }

  /**
   * Terminates the worker
   */
  terminate(): void {
    this.worker.terminate();
    this.pending.clear();
  }

  /**
   * Gets file summary
   */
  async getSummary(): Promise<{
    version: string;
    fileSize: number;
    barcodeCount: number;
    featureCount: number;
    projections: string[];
    cellTracks: string[];
    matrixStats: {
      shape: [number, number];
      nnz: number;
      sparsity: number;
    } | null;
  }> {
    return this.send({ type: "getSummary" });
  }

  /**
   * Gets barcodes
   */
  async getBarcodes(options?: PaginationOptions): Promise<string[]> {
    return this.send({ type: "getBarcodes", options });
  }

  /**
   * Gets features
   */
  async getFeatures(options?: PaginationOptions): Promise<Feature[]> {
    return this.send({ type: "getFeatures", options });
  }

  /**
   * Gets a projection and deserializes typed arrays
   */
  async getProjection(name: string): Promise<Projection> {
    const result = await this.send<{
      name: string;
      key: string;
      dimensions: number;
      coordinates: ArrayBuffer[];
    }>({ type: "getProjection", name });

    return new Projection({
      name: result.name,
      key: result.key,
      dimensions: result.dimensions,
      coordinates: result.coordinates.map((buf) => new Float64Array(buf)),
    });
  }

  /**
   * Gets a cell track and deserializes typed arrays
   */
  async getCellTrack(name: string): Promise<CellTrack> {
    const result = await this.send<{
      name: string;
      key: string;
      values: ArrayBuffer;
      categories?: string[];
    }>({ type: "getCellTrack", name });

    return new CellTrack({
      name: result.name,
      key: result.key,
      values: new Int16Array(result.values),
      categories: result.categories,
    });
  }

  /**
   * Gets expression for a feature and deserializes typed arrays
   */
  async getFeatureExpression(featureIndex: number): Promise<SparseRow> {
    const result = await this.send<{
      featureIndex: number;
      indices: ArrayBuffer;
      values: ArrayBuffer;
    }>({ type: "getFeatureExpression", featureIndex });

    return {
      featureIndex: result.featureIndex,
      indices: new Uint32Array(result.indices),
      values: new Float64Array(result.values),
    };
  }

  /**
   * Gets the full expression matrix
   */
  async getExpressionMatrix(): Promise<SparseMatrix> {
    const result = await this.send<{
      data: ArrayBuffer;
      indices: ArrayBuffer;
      indptr: ArrayBuffer;
      shape: [number, number];
    }>({ type: "getExpressionMatrix" });

    return {
      data: new Float64Array(result.data),
      indices: new Uint32Array(result.indices),
      indptr: new Uint32Array(result.indptr),
      shape: result.shape,
    };
  }

  /**
   * Gets a slice of the expression matrix
   */
  async getExpressionSlice(options: SliceOptions): Promise<SparseMatrix> {
    const result = await this.send<{
      data: ArrayBuffer;
      indices: ArrayBuffer;
      indptr: ArrayBuffer;
      shape: [number, number];
    }>({ type: "getExpressionSlice", options });

    return {
      data: new Float64Array(result.data),
      indices: new Uint32Array(result.indices),
      indptr: new Uint32Array(result.indptr),
      shape: result.shape,
    };
  }

  /**
   * Gets expression by feature name
   */
  async getExpressionByFeatureName(featureName: string): Promise<SparseRow | null> {
    const result = await this.send<{
      featureIndex: number;
      indices: ArrayBuffer;
      values: ArrayBuffer;
    } | null>({ type: "getExpressionByFeatureName", featureName });

    if (!result) {
      return null;
    }

    return {
      featureIndex: result.featureIndex,
      indices: new Uint32Array(result.indices),
      values: new Float64Array(result.values),
    };
  }

  /**
   * Gets cells in a cluster
   */
  async getCellsInCluster(trackName: string, category: string | number): Promise<number[]> {
    return this.send({ type: "getCellsInCluster", trackName, category });
  }
}
