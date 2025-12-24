/**
 * Web Worker for offloading heavy .cloupe file operations
 *
 * This worker handles CPU-intensive tasks like:
 * - Full matrix loading
 * - Large projection reads
 * - Batch operations
 *
 * Communication is done via postMessage with typed message protocol.
 */

import { CloupeReader } from "../core/CloupeReader.js";
import type {
  Projection,
  CellTrack,
  SparseMatrix,
  SparseRow,
  PaginationOptions,
  SliceOptions,
} from "../types/index.js";

// ============================================================================
// Message Types
// ============================================================================

export type WorkerRequest =
  | { type: "open"; id: number; file: File | Blob }
  | { type: "close"; id: number }
  | { type: "getSummary"; id: number }
  | { type: "getBarcodes"; id: number; options?: PaginationOptions }
  | { type: "getFeatures"; id: number; options?: PaginationOptions }
  | { type: "getProjection"; id: number; name: string }
  | { type: "getCellTrack"; id: number; name: string }
  | { type: "getFeatureExpression"; id: number; featureIndex: number }
  | { type: "getExpressionMatrix"; id: number }
  | { type: "getExpressionSlice"; id: number; options: SliceOptions }
  | { type: "getExpressionByFeatureName"; id: number; featureName: string }
  | { type: "getCellsInCluster"; id: number; trackName: string; category: string | number };

export type WorkerResponse =
  | { type: "success"; id: number; result: unknown }
  | { type: "error"; id: number; error: string; code?: string };

// ============================================================================
// Worker State
// ============================================================================

let reader: CloupeReader | null = null;

// ============================================================================
// Message Handler
// ============================================================================

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;

  try {
    const result = await handleRequest(request);
    self.postMessage({
      type: "success",
      id: request.id,
      result,
    } as WorkerResponse);
  } catch (error) {
    self.postMessage({
      type: "error",
      id: request.id,
      error: error instanceof Error ? error.message : String(error),
      code: (error as { code?: string }).code,
    } as WorkerResponse);
  }
};

async function handleRequest(request: WorkerRequest): Promise<unknown> {
  switch (request.type) {
    case "open":
      reader = await CloupeReader.open(request.file);
      return { success: true };

    case "close":
      reader?.close();
      reader = null;
      return { success: true };

    case "getSummary":
      return assertReader().getSummary();

    case "getBarcodes":
      return assertReader().getBarcodes(request.options);

    case "getFeatures":
      return assertReader().getFeatures(request.options);

    case "getProjection":
      return serializeProjection(await assertReader().getProjection(request.name));

    case "getCellTrack":
      return serializeCellTrack(await assertReader().getCellTrack(request.name));

    case "getFeatureExpression":
      return serializeSparseRow(await assertReader().getFeatureExpression(request.featureIndex));

    case "getExpressionMatrix":
      return serializeSparseMatrix(await assertReader().getExpressionMatrix());

    case "getExpressionSlice":
      return serializeSparseMatrix(await assertReader().getExpressionSlice(request.options));

    case "getExpressionByFeatureName": {
      const row = await assertReader().getExpressionByFeatureName(request.featureName);
      return row ? serializeSparseRow(row) : null;
    }

    case "getCellsInCluster":
      return assertReader().getCellsInCluster(request.trackName, request.category);

    default:
      throw new Error(`Unknown request type: ${(request as WorkerRequest).type}`);
  }
}

function assertReader(): CloupeReader {
  if (!reader) {
    throw new Error("No file opened. Call open() first.");
  }
  return reader;
}

// ============================================================================
// Serialization helpers for transferable data
// ============================================================================

interface SerializedProjection {
  name: string;
  key?: string;
  dimensions: number;
  coordinates: ArrayBuffer[];
}

function serializeProjection(proj: Projection): SerializedProjection {
  return {
    name: proj.name,
    key: proj.key,
    dimensions: proj.dimensions,
    coordinates: proj.coordinates.map((arr) => arr.buffer.slice(0) as ArrayBuffer),
  };
}

interface SerializedCellTrack {
  name: string;
  key?: string;
  values: ArrayBuffer;
  categories?: string[];
}

function serializeCellTrack(track: CellTrack): SerializedCellTrack {
  return {
    name: track.name,
    key: track.key,
    values: track.values.buffer.slice(0) as ArrayBuffer,
    categories: track.categories,
  };
}

interface SerializedSparseRow {
  featureIndex: number;
  indices: ArrayBuffer;
  values: ArrayBuffer;
}

function serializeSparseRow(row: SparseRow): SerializedSparseRow {
  return {
    featureIndex: row.featureIndex,
    indices: row.indices.buffer.slice(0) as ArrayBuffer,
    values: row.values.buffer.slice(0) as ArrayBuffer,
  };
}

interface SerializedSparseMatrix {
  data: ArrayBuffer;
  indices: ArrayBuffer;
  indptr: ArrayBuffer;
  shape: [number, number];
}

function serializeSparseMatrix(matrix: SparseMatrix): SerializedSparseMatrix {
  return {
    data: matrix.data.buffer.slice(0) as ArrayBuffer,
    indices: matrix.indices.buffer.slice(0) as ArrayBuffer,
    indptr: matrix.indptr.buffer.slice(0) as ArrayBuffer,
    shape: matrix.shape,
  };
}
