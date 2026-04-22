<script setup lang="ts">
import { ref, onUnmounted, watch, nextTick } from 'vue';
import { CloupeReader } from 'cloupe.js';
import type { Projection } from 'cloupe.js';

const SAMPLE_URL = 'https://pub-80efc7b31f944811985c0bdc785ee183.r2.dev/AMLTutorial.cloupe';

const reader = ref<CloupeReader | null>(null);
const projections = ref<string[]>([]);
const selectedProjection = ref('');
const projection = ref<Projection | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

async function handleFile(file: File) {
  await loadData(() => CloupeReader.open(file));
}

async function handleUrl(url: string) {
  await loadData(() => CloupeReader.open(url));
}

async function loadData(openFn: () => Promise<CloupeReader>) {
  loading.value = true;
  error.value = null;

  try {
    if (reader.value) {
      reader.value.close();
    }

    reader.value = await openFn();
    projections.value = reader.value.projectionNames;

    if (projections.value.length > 0) {
      selectedProjection.value = projections.value[0];
      await loadProjection();
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load file';
  } finally {
    loading.value = false;
  }
}

async function loadProjection() {
  if (!reader.value || !selectedProjection.value) return;

  loading.value = true;
  try {
    projection.value = await reader.value.getProjection(selectedProjection.value);
    await nextTick();
    renderCanvas();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load projection';
  } finally {
    loading.value = false;
  }
}

function renderCanvas() {
  if (!canvas.value || !projection.value) return;

  const ctx = canvas.value.getContext('2d');
  if (!ctx) return;

  const width = canvas.value.width;
  const height = canvas.value.height;
  const padding = 40;

  const bounds = projection.value.getBounds();
  const xRange = bounds.max[0] - bounds.min[0];
  const yRange = bounds.max[1] - bounds.min[1];
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;

  // Clear
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Draw points
  const x = projection.value.coordinates[0];
  const y = projection.value.coordinates[1];

  ctx.fillStyle = 'rgba(59, 130, 246, 0.5)';

  for (let i = 0; i < projection.value.numPoints; i++) {
    const px = padding + ((x[i] - bounds.min[0]) / xRange) * plotWidth;
    const py = height - padding - ((y[i] - bounds.min[1]) / yRange) * plotHeight;

    ctx.beginPath();
    ctx.arc(px, py, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Title
  ctx.fillStyle = '#000000';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${projection.value.name} (${projection.value.numPoints.toLocaleString()} points)`, width / 2, 20);
}

watch(selectedProjection, () => {
  if (reader.value) {
    loadProjection();
  }
});

onUnmounted(() => {
  reader.value?.close();
});
</script>

<template>
  <div class="example-container">
    <h4>Interactive Example: Projection Visualization</h4>

    <FileUploader
      :sample-url="SAMPLE_URL"
      sample-name="AMLTutorial.cloupe (40MB)"
      @file-selected="handleFile"
      @url-selected="handleUrl"
    />

    <div v-if="loading" class="loading">Loading...</div>

    <div v-if="error" class="error-message">{{ error }}</div>

    <template v-if="projections.length > 0 && !loading">
      <div class="controls">
        <select v-model="selectedProjection">
          <option v-for="name in projections" :key="name" :value="name">
            {{ name }}
          </option>
        </select>
      </div>

      <div class="canvas-container">
        <canvas ref="canvas" width="600" height="450"></canvas>
      </div>

      <div v-if="projection" class="result-panel">
        <strong>Projection Info:</strong>
        <pre><code>Name: {{ projection.name }}
Dimensions: {{ projection.dimensions }}D
Points: {{ projection.numPoints.toLocaleString() }}
X range: {{ projection.getBounds().min[0].toFixed(2) }} ~ {{ projection.getBounds().max[0].toFixed(2) }}
Y range: {{ projection.getBounds().min[1].toFixed(2) }} ~ {{ projection.getBounds().max[1].toFixed(2) }}</code></pre>
      </div>
    </template>
  </div>
</template>
