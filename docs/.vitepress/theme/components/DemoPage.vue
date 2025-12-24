<script setup lang="ts">
import { ref, onUnmounted } from 'vue';
import { CloupeReader } from 'cloupe';

// State
const reader = ref<CloupeReader | null>(null);
const isLoading = ref(false);
const error = ref<string | null>(null);
const fileName = ref('No file selected');
const activeTab = ref('summary');

// Summary data
const summary = ref<any>(null);

// Barcode data
const barcodes = ref<string[]>([]);
const barcodeOffset = ref(0);
const barcodeLimit = ref(100);

// Feature data
const features = ref<any[]>([]);
const featureSearch = ref('');
const featureOffset = ref(0);
const featureLimit = ref(100);

// Projection data
const projectionNames = ref<string[]>([]);
const selectedProjection = ref('');
const projectionInfo = ref<any>(null);
const projectionCanvas = ref<HTMLCanvasElement | null>(null);

// Track data
const trackNames = ref<string[]>([]);
const selectedTrack = ref('');
const trackData = ref<any>(null);

// Clustering data
const clusteringNames = ref<string[]>([]);
const selectedClustering = ref('');
const clusteringData = ref<any>(null);

// Expression data
const geneSearch = ref('');
const expressionData = ref<any>(null);
const expressionCanvas = ref<HTMLCanvasElement | null>(null);
const hasMatrixData = ref(false);

// Spatial data
const spatialImageNames = ref<string[]>([]);
const selectedSpatialImage = ref('');
const spatialImageInfo = ref<any>(null);
const spatialThumbnailUrl = ref<string | null>(null);
const spatialZoomLevels = ref<any[]>([]);
const selectedZoomLevel = ref<number | null>(null);
const spatialTileX = ref(0);
const spatialTileY = ref(0);
const spatialTileUrl = ref<string | null>(null);
const spatialTileLoading = ref(false);

// Reset all loaded data when switching files
function resetData() {
  // Clear summary
  summary.value = null;

  // Clear barcodes
  barcodes.value = [];
  barcodeOffset.value = 0;

  // Clear features
  features.value = [];
  featureSearch.value = '';
  featureOffset.value = 0;

  // Clear projections
  projectionNames.value = [];
  selectedProjection.value = '';
  projectionInfo.value = null;
  if (projectionCanvas.value) {
    const ctx = projectionCanvas.value.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, projectionCanvas.value.width, projectionCanvas.value.height);
  }

  // Clear tracks
  trackNames.value = [];
  selectedTrack.value = '';
  trackData.value = null;

  // Clear clusterings
  clusteringNames.value = [];
  selectedClustering.value = '';
  clusteringData.value = null;

  // Clear expression
  geneSearch.value = '';
  expressionData.value = null;
  hasMatrixData.value = false;
  if (expressionCanvas.value) {
    const ctx = expressionCanvas.value.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, expressionCanvas.value.width, expressionCanvas.value.height);
  }

  // Clear spatial
  spatialImageNames.value = [];
  selectedSpatialImage.value = '';
  spatialImageInfo.value = null;
  if (spatialThumbnailUrl.value) {
    URL.revokeObjectURL(spatialThumbnailUrl.value);
    spatialThumbnailUrl.value = null;
  }
  if (spatialTileUrl.value) {
    URL.revokeObjectURL(spatialTileUrl.value);
    spatialTileUrl.value = null;
  }
  spatialZoomLevels.value = [];
  selectedZoomLevel.value = null;
  spatialTileX.value = 0;
  spatialTileY.value = 0;

  // Reset to summary tab
  activeTab.value = 'summary';
}

async function loadFile(file: File) {
  isLoading.value = true;
  error.value = null;

  try {
    if (reader.value) {
      reader.value.close();
    }

    // Reset all data before loading new file
    resetData();

    reader.value = await CloupeReader.open(file);
    fileName.value = file.name;

    // Load summary
    summary.value = await reader.value.getSummary();

    // Set available projections, tracks, clusterings, and spatial images
    projectionNames.value = reader.value.projectionNames;
    trackNames.value = reader.value.cellTrackNames;
    clusteringNames.value = reader.value.clusteringNames;
    hasMatrixData.value = reader.value.hasMatrixData;
    spatialImageNames.value = reader.value.spatialImageNames;

    if (projectionNames.value.length > 0) {
      selectedProjection.value = projectionNames.value[0];
    }
    if (trackNames.value.length > 0) {
      selectedTrack.value = trackNames.value[0];
    }
    if (clusteringNames.value.length > 0) {
      selectedClustering.value = clusteringNames.value[0];
    }
    if (spatialImageNames.value.length > 0) {
      selectedSpatialImage.value = spatialImageNames.value[0];
    }
  } catch (e: any) {
    error.value = e.message || 'Failed to load file';
  } finally {
    isLoading.value = false;
  }
}

async function loadFromUrl(url: string) {
  isLoading.value = true;
  error.value = null;

  try {
    if (reader.value) {
      reader.value.close();
    }

    // Reset all data before loading new file
    resetData();

    reader.value = await CloupeReader.open(url);
    fileName.value = url.split('/').pop() || url;

    summary.value = await reader.value.getSummary();
    projectionNames.value = reader.value.projectionNames;
    trackNames.value = reader.value.cellTrackNames;
    clusteringNames.value = reader.value.clusteringNames;
    hasMatrixData.value = reader.value.hasMatrixData;
    spatialImageNames.value = reader.value.spatialImageNames;

    if (projectionNames.value.length > 0) {
      selectedProjection.value = projectionNames.value[0];
    }
    if (trackNames.value.length > 0) {
      selectedTrack.value = trackNames.value[0];
    }
    if (clusteringNames.value.length > 0) {
      selectedClustering.value = clusteringNames.value[0];
    }
    if (spatialImageNames.value.length > 0) {
      selectedSpatialImage.value = spatialImageNames.value[0];
    }
  } catch (e: any) {
    error.value = e.message || 'Failed to load file';
  } finally {
    isLoading.value = false;
  }
}

async function loadSample(filename: string) {
  await loadFromUrl(`/samples/${filename}`);
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    loadFile(input.files[0]);
  }
}

async function loadBarcodes() {
  if (!reader.value) return;
  barcodes.value = await reader.value.getBarcodes({
    offset: barcodeOffset.value,
    limit: barcodeLimit.value,
  });
}

async function loadFeatures() {
  if (!reader.value) return;

  if (featureSearch.value) {
    const results = await reader.value.features.search(featureSearch.value);
    features.value = results.slice(0, featureLimit.value);
  } else {
    const all = await reader.value.getFeatures({
      offset: featureOffset.value,
      limit: featureLimit.value,
    });
    features.value = all.map((f, i) => ({ index: featureOffset.value + i, feature: f }));
  }
}

async function loadProjection() {
  if (!reader.value || !selectedProjection.value) return;

  const proj = await reader.value.getProjection(selectedProjection.value);
  if (!proj) return;

  projectionInfo.value = {
    name: proj.name,
    dimensions: proj.dimensions,
    numPoints: proj.numPoints,
  };

  // Draw projection
  const canvas = projectionCanvas.value;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const bounds = proj.getBounds();
  const x = proj.coordinates[0];
  const y = proj.coordinates[1];

  const width = canvas.width;
  const height = canvas.height;
  const padding = 20;

  const xScale = (width - 2 * padding) / (bounds.max[0] - bounds.min[0]);
  const yScale = (height - 2 * padding) / (bounds.max[1] - bounds.min[1]);
  const scale = Math.min(xScale, yScale);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0891b2';
  ctx.globalAlpha = 0.3;

  for (let i = 0; i < x.length; i++) {
    const px = padding + (x[i] - bounds.min[0]) * scale;
    const py = height - padding - (y[i] - bounds.min[1]) * scale;
    ctx.beginPath();
    ctx.arc(px, py, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

async function loadTrack() {
  if (!reader.value || !selectedTrack.value) return;

  const track = await reader.value.getCellTrack(selectedTrack.value);
  if (!track) return;

  trackData.value = {
    name: track.name,
    categories: track.categories,
    counts: track.getCategoryCounts(),
  };
}

async function loadClustering() {
  if (!reader.value || !selectedClustering.value) return;

  const clustering = await reader.value.getClustering(selectedClustering.value);
  const counts = clustering.getClusterCounts();

  // Convert Map to object for display
  const countsObj: Record<number, number> = {};
  counts.forEach((count, clusterId) => {
    countsObj[clusterId] = count;
  });

  clusteringData.value = {
    name: clustering.name,
    numClusters: clustering.numClusters,
    numCells: clustering.numCells,
    clusterIds: clustering.getUniqueClusterIds(),
    counts: countsObj,
  };
}

async function loadExpression() {
  if (!reader.value || !geneSearch.value) return;

  const expr = await reader.value.getExpressionByFeatureName(geneSearch.value);
  if (!expr) {
    error.value = `Gene "${geneSearch.value}" not found`;
    return;
  }

  expressionData.value = {
    featureIndex: expr.featureIndex,
    nonZeroCells: expr.indices.length,
    maxValue: Math.max(...Array.from(expr.values)),
    minValue: Math.min(...Array.from(expr.values)),
    meanValue: Array.from(expr.values).reduce((a, b) => a + b, 0) / expr.values.length,
  };

  // Draw on projection if available
  if (!selectedProjection.value) return;

  const proj = await reader.value.getProjection(selectedProjection.value);
  if (!proj) return;

  const canvas = expressionCanvas.value;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const bounds = proj.getBounds();
  const x = proj.coordinates[0];
  const y = proj.coordinates[1];

  const width = canvas.width;
  const height = canvas.height;
  const padding = 20;

  const xScale = (width - 2 * padding) / (bounds.max[0] - bounds.min[0]);
  const yScale = (height - 2 * padding) / (bounds.max[1] - bounds.min[1]);
  const scale = Math.min(xScale, yScale);

  // Create expression map
  const exprMap = new Map<number, number>();
  const maxExpr = Math.max(...Array.from(expr.values));
  for (let i = 0; i < expr.indices.length; i++) {
    exprMap.set(expr.indices[i], expr.values[i] / maxExpr);
  }

  ctx.clearRect(0, 0, width, height);

  // Draw non-expressing cells first
  ctx.fillStyle = '#e2e8f0';
  ctx.globalAlpha = 0.3;
  for (let i = 0; i < x.length; i++) {
    if (exprMap.has(i)) continue;
    const px = padding + (x[i] - bounds.min[0]) * scale;
    const py = height - padding - (y[i] - bounds.min[1]) * scale;
    ctx.beginPath();
    ctx.arc(px, py, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw expressing cells
  ctx.globalAlpha = 0.6;
  for (let i = 0; i < x.length; i++) {
    const intensity = exprMap.get(i);
    if (intensity === undefined) continue;

    const px = padding + (x[i] - bounds.min[0]) * scale;
    const py = height - padding - (y[i] - bounds.min[1]) * scale;

    // Red color intensity
    const red = Math.floor(220 * intensity + 35);
    ctx.fillStyle = `rgb(${red}, 50, 50)`;
    ctx.beginPath();
    ctx.arc(px, py, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

async function loadSpatialImage() {
  if (!reader.value || !selectedSpatialImage.value) return;

  try {
    const image = await reader.value.spatialImages.read(selectedSpatialImage.value);

    spatialImageInfo.value = {
      name: image.name,
      width: image.width,
      height: image.height,
      tileSize: image.tileSize,
      type: image.type,
      minZoom: image.minZoom,
      maxZoom: image.maxZoom,
      totalTiles: image.zoomLevels.reduce((sum: number, z: any) => sum + z.tileCount, 0),
    };

    spatialZoomLevels.value = image.zoomLevels;
    if (spatialZoomLevels.value.length > 0) {
      selectedZoomLevel.value = spatialZoomLevels.value[0].level;
    }
    spatialTileX.value = 0;
    spatialTileY.value = 0;

    // Load thumbnail
    if (spatialThumbnailUrl.value) {
      URL.revokeObjectURL(spatialThumbnailUrl.value);
    }
    const thumbnailData = await reader.value.spatialImages.getThumbnail(selectedSpatialImage.value);
    const blob = new Blob([thumbnailData], { type: 'image/png' });
    spatialThumbnailUrl.value = URL.createObjectURL(blob);
  } catch (e: any) {
    error.value = e.message || 'Failed to load spatial image';
  }
}

async function loadSpatialTile() {
  if (!reader.value || !selectedSpatialImage.value || selectedZoomLevel.value === null) return;

  spatialTileLoading.value = true;

  try {
    if (spatialTileUrl.value) {
      URL.revokeObjectURL(spatialTileUrl.value);
    }

    const tileData = await reader.value.spatialImages.getTile(
      selectedSpatialImage.value,
      selectedZoomLevel.value,
      spatialTileX.value,
      spatialTileY.value
    );

    const blob = new Blob([tileData], { type: 'image/png' });
    spatialTileUrl.value = URL.createObjectURL(blob);
  } catch (e: any) {
    spatialTileUrl.value = null;
    error.value = `Tile not found: ${selectedZoomLevel.value}/${spatialTileX.value}_${spatialTileY.value}`;
  } finally {
    spatialTileLoading.value = false;
  }
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}

onUnmounted(() => {
  if (reader.value) {
    reader.value.close();
  }
  if (spatialThumbnailUrl.value) {
    URL.revokeObjectURL(spatialThumbnailUrl.value);
  }
  if (spatialTileUrl.value) {
    URL.revokeObjectURL(spatialTileUrl.value);
  }
});
</script>

<template>
  <div class="demo-container">
    <header class="demo-header">
      <h1>Live Demo</h1>
      <p class="subtitle">Interactive .cloupe file explorer</p>
    </header>

    <!-- File Input Section -->
    <section class="input-section">
      <h2>Open .cloupe File</h2>

      <div class="demo-files">
        <span class="demo-label">Try a demo file:</span>
        <button class="btn btn-demo" @click="loadSample('AMLTutorial.cloupe')">AML Tutorial</button>
        <button class="btn btn-demo" @click="loadSample('ATACTutorial.cloupe')">ATAC Tutorial</button>
        <button class="btn btn-demo" @click="loadSample('SpatialTutorial.cloupe')">Spatial Tutorial</button>
      </div>

      <div class="divider"><span>or</span></div>

      <div class="file-input-row">
        <label class="file-input-label">
          <input type="file" accept=".cloupe" @change="handleFileSelect" />
          <span class="file-button">Choose File</span>
          <span class="file-name">{{ fileName }}</span>
        </label>
      </div>
    </section>

    <!-- Loading -->
    <div v-if="isLoading" class="loading">
      <div class="spinner"></div>
      <p>Loading file...</p>
    </div>

    <!-- Error -->
    <div v-if="error" class="error">
      <strong>Error:</strong> {{ error }}
    </div>

    <!-- Results -->
    <section v-if="summary && !isLoading" class="results">
      <div class="tabs">
        <button
          v-for="tab in ['summary', 'barcodes', 'features', 'projections', 'tracks', 'clusterings', 'expression', 'spatial']"
          :key="tab"
          class="tab"
          :class="{ active: activeTab === tab }"
          @click="activeTab = tab"
        >
          {{ tab.charAt(0).toUpperCase() + tab.slice(1) }}
        </button>
      </div>

      <!-- Summary Tab -->
      <div v-if="activeTab === 'summary'" class="tab-content">
        <div class="stat-grid">
          <div class="stat-item">
            <div class="stat-label">Version</div>
            <div class="stat-value">{{ summary.version }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">File Size</div>
            <div class="stat-value">{{ (summary.fileSize / 1024 / 1024).toFixed(1) }} MB</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Cells</div>
            <div class="stat-value">{{ formatNumber(summary.barcodeCount) }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Features</div>
            <div class="stat-value">{{ formatNumber(summary.featureCount) }}</div>
          </div>
        </div>

        <div class="info-section">
          <h3>Projections</h3>
          <p>{{ summary.projections?.join(', ') || 'None' }}</p>
        </div>

        <div class="info-section">
          <h3>Cell Tracks</h3>
          <p>{{ summary.cellTracks?.join(', ') || 'None' }}</p>
        </div>

        <div class="info-section">
          <h3>Clusterings</h3>
          <p>{{ summary.clusterings?.join(', ') || 'None' }}</p>
        </div>

        <div class="info-section">
          <h3>Spatial Images</h3>
          <p>{{ summary.spatialImages?.length > 0 ? summary.spatialImages.join(', ') : 'None' }}</p>
        </div>

        <div v-if="summary.matrixStats" class="info-section">
          <h3>Matrix Statistics</h3>
          <p>Shape: {{ summary.matrixStats.shape.join(' x ') }}</p>
          <p>Non-zero values: {{ formatNumber(summary.matrixStats.nnz) }}</p>
          <p>Sparsity: {{ (summary.matrixStats.sparsity * 100).toFixed(1) }}%</p>
        </div>
      </div>

      <!-- Barcodes Tab -->
      <div v-if="activeTab === 'barcodes'" class="tab-content">
        <div class="controls">
          <input v-model.number="barcodeOffset" type="number" placeholder="Offset" min="0" />
          <input v-model.number="barcodeLimit" type="number" placeholder="Limit" min="1" max="1000" />
          <button class="btn" @click="loadBarcodes">Load</button>
        </div>
        <div v-if="barcodes.length" class="data-list">
          <div v-for="(barcode, i) in barcodes" :key="i" class="data-item">
            <span class="index">{{ barcodeOffset + i }}</span>
            <span class="value">{{ barcode }}</span>
          </div>
        </div>
        <p v-else class="empty-message">Click "Load" to view barcodes</p>
      </div>

      <!-- Features Tab -->
      <div v-if="activeTab === 'features'" class="tab-content">
        <div class="controls">
          <input v-model="featureSearch" type="text" placeholder="Search by name..." />
          <input v-model.number="featureOffset" type="number" placeholder="Offset" min="0" />
          <input v-model.number="featureLimit" type="number" placeholder="Limit" min="1" max="1000" />
          <button class="btn" @click="loadFeatures">Load</button>
        </div>
        <div v-if="features.length" class="data-table">
          <table>
            <thead>
              <tr>
                <th>Index</th>
                <th>Name</th>
                <th>ID</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in features" :key="item.index">
                <td>{{ item.index }}</td>
                <td>{{ item.feature.name }}</td>
                <td>{{ item.feature.id }}</td>
                <td>{{ item.feature.type }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="empty-message">Click "Load" to view features</p>
      </div>

      <!-- Projections Tab -->
      <div v-if="activeTab === 'projections'" class="tab-content">
        <template v-if="projectionNames.length > 0">
          <div class="controls">
            <select v-model="selectedProjection">
              <option v-for="name in projectionNames" :key="name" :value="name">{{ name }}</option>
            </select>
            <button class="btn" @click="loadProjection">Load</button>
          </div>
          <div v-if="projectionInfo" class="info-section">
            <p><strong>Name:</strong> {{ projectionInfo.name }}</p>
            <p><strong>Dimensions:</strong> {{ projectionInfo.dimensions }}D</p>
            <p><strong>Points:</strong> {{ formatNumber(projectionInfo.numPoints) }}</p>
          </div>
          <canvas ref="projectionCanvas" width="600" height="400"></canvas>
        </template>
        <p v-else class="no-data-message">No projection data available in this file.</p>
      </div>

      <!-- Tracks Tab -->
      <div v-if="activeTab === 'tracks'" class="tab-content">
        <template v-if="trackNames.length > 0">
          <div class="controls">
            <select v-model="selectedTrack">
              <option v-for="name in trackNames" :key="name" :value="name">{{ name }}</option>
            </select>
            <button class="btn" @click="loadTrack">Load</button>
          </div>
          <div v-if="trackData" class="track-info">
            <h3>{{ trackData.name }}</h3>
            <div class="category-list">
              <div v-for="category in trackData.categories" :key="category" class="category-item">
                <span class="category-name">{{ category }}</span>
                <span class="category-count">{{ formatNumber(trackData.counts[category] || 0) }} cells</span>
              </div>
            </div>
          </div>
          <p v-else class="empty-message">Click "Load" to view cell track data</p>
        </template>
        <p v-else class="no-data-message">No cell track data available in this file.</p>
      </div>

      <!-- Clusterings Tab -->
      <div v-if="activeTab === 'clusterings'" class="tab-content">
        <template v-if="clusteringNames.length > 0">
          <div class="controls">
            <select v-model="selectedClustering">
              <option v-for="name in clusteringNames" :key="name" :value="name">{{ name }}</option>
            </select>
            <button class="btn" @click="loadClustering">Load</button>
          </div>
          <div v-if="clusteringData" class="clustering-info">
            <h3>{{ clusteringData.name }}</h3>
            <div class="info-section">
              <p><strong>Number of Clusters:</strong> {{ clusteringData.numClusters }}</p>
              <p><strong>Total Cells:</strong> {{ formatNumber(clusteringData.numCells) }}</p>
            </div>
            <div class="cluster-list">
              <div v-for="clusterId in clusteringData.clusterIds" :key="clusterId" class="cluster-item">
                <span class="cluster-id">Cluster {{ clusterId }}</span>
                <span class="cluster-count">{{ formatNumber(clusteringData.counts[clusterId] || 0) }} cells</span>
              </div>
            </div>
          </div>
          <p v-else class="empty-message">Click "Load" to view clustering data</p>
        </template>
        <p v-else class="no-data-message">No clustering data available in this file.</p>
      </div>

      <!-- Expression Tab -->
      <div v-if="activeTab === 'expression'" class="tab-content">
        <template v-if="hasMatrixData">
          <div class="controls">
            <input v-model="geneSearch" type="text" placeholder="Enter gene name (e.g., CD3D)..." />
            <button class="btn" @click="loadExpression">Load</button>
          </div>
          <div v-if="expressionData" class="info-section">
            <p><strong>Feature Index:</strong> {{ expressionData.featureIndex }}</p>
            <p><strong>Expressing Cells:</strong> {{ formatNumber(expressionData.nonZeroCells) }}</p>
            <p><strong>Max Value:</strong> {{ expressionData.maxValue.toFixed(2) }}</p>
            <p><strong>Mean Value:</strong> {{ expressionData.meanValue.toFixed(2) }}</p>
          </div>
          <canvas ref="expressionCanvas" width="600" height="400"></canvas>
        </template>
        <p v-else class="no-data-message">No expression matrix data available in this file.</p>
      </div>

      <!-- Spatial Tab -->
      <div v-if="activeTab === 'spatial'" class="tab-content">
        <template v-if="spatialImageNames.length > 0">
          <div class="controls">
            <select v-model="selectedSpatialImage">
              <option v-for="name in spatialImageNames" :key="name" :value="name">{{ name }}</option>
            </select>
            <button class="btn" @click="loadSpatialImage">Load</button>
          </div>

          <div v-if="spatialImageInfo" class="spatial-info">
            <div class="stat-grid">
              <div class="stat-item">
                <div class="stat-label">Dimensions</div>
                <div class="stat-value stat-value-sm">{{ formatNumber(spatialImageInfo.width) }} x {{ formatNumber(spatialImageInfo.height) }}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">Tile Size</div>
                <div class="stat-value">{{ spatialImageInfo.tileSize }}px</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">Type</div>
                <div class="stat-value">{{ spatialImageInfo.type }}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">Zoom Levels</div>
                <div class="stat-value">{{ spatialImageInfo.minZoom }} - {{ spatialImageInfo.maxZoom }}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">Total Tiles</div>
                <div class="stat-value">{{ formatNumber(spatialImageInfo.totalTiles) }}</div>
              </div>
            </div>

            <div class="info-section">
              <h3>Thumbnail</h3>
              <img v-if="spatialThumbnailUrl" :src="spatialThumbnailUrl" alt="H&E Thumbnail" class="spatial-thumbnail" />
            </div>

            <div class="info-section">
              <h3>Tile Viewer</h3>
              <div class="controls">
                <select v-model="selectedZoomLevel">
                  <option v-for="level in spatialZoomLevels" :key="level.level" :value="level.level">
                    Level {{ level.level }} ({{ level.gridWidth }}x{{ level.gridHeight }})
                  </option>
                </select>
                <input v-model.number="spatialTileX" type="number" placeholder="X" min="0" class="tile-coord" />
                <input v-model.number="spatialTileY" type="number" placeholder="Y" min="0" class="tile-coord" />
                <button class="btn" @click="loadSpatialTile" :disabled="spatialTileLoading">
                  {{ spatialTileLoading ? 'Loading...' : 'Load Tile' }}
                </button>
              </div>
              <img v-if="spatialTileUrl" :src="spatialTileUrl" alt="Tile" class="spatial-tile" />
              <p v-else class="empty-message">Select zoom level and coordinates, then click "Load Tile"</p>
            </div>
          </div>

          <p v-else class="empty-message">Click "Load" to view spatial image info</p>
        </template>
        <p v-else class="no-data-message">No spatial H&E images available in this file.</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.demo-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem 0;
}

.demo-header {
  text-align: center;
  margin-bottom: 2rem;
}

.demo-header h1 {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  border: none;
}

.subtitle {
  color: var(--vp-c-text-2);
  font-size: 1.1rem;
}

.input-section {
  background: var(--vp-c-bg-soft);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  border: 1px solid var(--vp-c-divider);
}

.input-section h2 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 1rem;
  border: none;
}

.demo-files {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  padding: 1rem;
  background: var(--vp-c-bg);
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
}

.demo-label {
  color: var(--vp-c-text-2);
  font-size: 0.875rem;
  margin-right: 0.5rem;
}

.btn {
  background: var(--vp-c-brand-1);
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.btn:hover {
  background: var(--vp-c-brand-2);
}

.btn-demo {
  background: var(--vp-c-green-1);
}

.btn-demo:hover {
  background: var(--vp-c-green-2);
}

.divider {
  display: flex;
  align-items: center;
  margin: 1rem 0;
  color: var(--vp-c-text-3);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--vp-c-divider);
}

.divider span {
  padding: 0 1rem;
}

.file-input-row {
  display: flex;
  gap: 1rem;
}

.file-input-label {
  display: flex;
  align-items: center;
  gap: 1rem;
  cursor: pointer;
}

.file-input-label input {
  display: none;
}

.file-button {
  background: var(--vp-c-brand-1);
  color: white;
  padding: 0.75rem 1.25rem;
  border-radius: 6px;
  font-weight: 500;
  transition: background 0.2s;
}

.file-button:hover {
  background: var(--vp-c-brand-2);
}

.file-name {
  color: var(--vp-c-text-2);
  font-family: var(--vp-font-family-mono);
  font-size: 0.875rem;
}

.loading {
  text-align: center;
  padding: 3rem;
  background: var(--vp-c-bg-soft);
  border-radius: 12px;
  border: 1px solid var(--vp-c-divider);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--vp-c-divider);
  border-top-color: var(--vp-c-brand-1);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error {
  background: var(--vp-c-danger-soft);
  color: var(--vp-c-danger-1);
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  border: 1px solid var(--vp-c-danger-2);
}

.results {
  background: var(--vp-c-bg-soft);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
}

.tabs {
  display: flex;
  background: var(--vp-c-bg);
  border-bottom: 1px solid var(--vp-c-divider);
  overflow-x: auto;
}

.tab {
  padding: 0.75rem 1.25rem;
  background: none;
  border: none;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--vp-c-text-2);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.tab:hover {
  color: var(--vp-c-text-1);
}

.tab.active {
  color: var(--vp-c-brand-1);
  border-bottom-color: var(--vp-c-brand-1);
}

.tab-content {
  padding: 1.5rem;
}

.controls {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.controls input,
.controls select {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  font-size: 0.875rem;
  background: var(--vp-c-bg);
}

.controls input:focus,
.controls select:focus {
  outline: none;
  border-color: var(--vp-c-brand-1);
}

.controls input[type="number"] {
  width: 100px;
}

.controls input[type="text"] {
  flex: 1;
  min-width: 200px;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat-item {
  background: var(--vp-c-bg);
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
}

.stat-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--vp-c-text-3);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.25rem;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
}

.info-section {
  background: var(--vp-c-bg);
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  border: 1px solid var(--vp-c-divider);
}

.info-section h3 {
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  border: none;
}

.info-section p {
  margin: 0.25rem 0;
  font-size: 0.875rem;
}

.data-list {
  max-height: 400px;
  overflow-y: auto;
  background: var(--vp-c-bg);
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
}

.data-item {
  display: flex;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--vp-c-divider);
  font-family: var(--vp-font-family-mono);
  font-size: 0.8125rem;
}

.data-item:last-child {
  border-bottom: none;
}

.data-item .index {
  color: var(--vp-c-text-3);
  width: 60px;
}

.data-table {
  overflow-x: auto;
}

.data-table table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.data-table th,
.data-table td {
  padding: 0.5rem 1rem;
  text-align: left;
  border-bottom: 1px solid var(--vp-c-divider);
}

.data-table th {
  font-weight: 600;
  color: var(--vp-c-text-2);
  font-size: 0.75rem;
  text-transform: uppercase;
  background: var(--vp-c-bg);
}

.category-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.category-item {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  background: var(--vp-c-bg);
  border-radius: 6px;
  border: 1px solid var(--vp-c-divider);
}

.category-name {
  font-weight: 500;
}

.category-count {
  color: var(--vp-c-text-2);
  font-family: var(--vp-font-family-mono);
  font-size: 0.875rem;
}

.empty-message {
  color: var(--vp-c-text-3);
  text-align: center;
  padding: 2rem;
}

.no-data-message {
  color: var(--vp-c-text-2);
  text-align: center;
  padding: 3rem 2rem;
  background: var(--vp-c-bg);
  border-radius: 8px;
  border: 1px dashed var(--vp-c-divider);
}

canvas {
  width: 100%;
  max-width: 100%;
  height: auto;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: white;
}

.track-info h3 {
  margin-bottom: 1rem;
  border: none;
}

.clustering-description {
  color: var(--vp-c-text-2);
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

.clustering-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.clustering-item {
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  background: var(--vp-c-bg);
  border-radius: 6px;
  border: 1px solid var(--vp-c-divider);
}

.clustering-name {
  font-weight: 500;
}

.clustering-info h3 {
  margin-bottom: 1rem;
  border: none;
}

.cluster-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.cluster-item {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  background: var(--vp-c-bg);
  border-radius: 6px;
  border: 1px solid var(--vp-c-divider);
}

.cluster-id {
  font-weight: 500;
}

.cluster-count {
  color: var(--vp-c-text-2);
  font-family: var(--vp-font-family-mono);
  font-size: 0.875rem;
}

.spatial-thumbnail {
  max-width: 100%;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
}

.spatial-tile {
  max-width: 100%;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
  margin-top: 1rem;
}

.tile-coord {
  width: 70px !important;
}

.stat-value-sm {
  font-size: 1.1rem;
}

@media (max-width: 640px) {
  .demo-container {
    padding: 1rem 0;
  }

  .stat-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .controls {
    flex-direction: column;
  }

  .controls input,
  .controls select {
    width: 100%;
  }
}
</style>
