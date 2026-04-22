<script setup lang="ts">
import { ref, onUnmounted } from 'vue';
import { CloupeReader } from 'cloupe.js';

const SAMPLE_URL = 'https://pub-80efc7b31f944811985c0bdc785ee183.r2.dev/AMLTutorial.cloupe';

const reader = ref<CloupeReader | null>(null);
const summary = ref<any>(null);
const barcodes = ref<string[]>([]);
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
    summary.value = await reader.value.getSummary();
    barcodes.value = await reader.value.getBarcodes({ limit: 10 });
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load file';
  } finally {
    loading.value = false;
  }
}

onUnmounted(() => {
  reader.value?.close();
});
</script>

<template>
  <div class="example-container">
    <h4>Interactive Example: Basic Usage</h4>

    <FileUploader
      :sample-url="SAMPLE_URL"
      sample-name="AMLTutorial.cloupe (40MB)"
      @file-selected="handleFile"
      @url-selected="handleUrl"
    />

    <div v-if="loading" class="loading">Loading...</div>

    <div v-if="error" class="error-message">{{ error }}</div>

    <template v-if="summary && !loading">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="value">{{ summary.barcodeCount.toLocaleString() }}</div>
          <div class="label">Cells</div>
        </div>
        <div class="stat-card">
          <div class="value">{{ summary.featureCount.toLocaleString() }}</div>
          <div class="label">Genes</div>
        </div>
        <div class="stat-card">
          <div class="value">{{ summary.projections.length }}</div>
          <div class="label">Projections</div>
        </div>
        <div class="stat-card">
          <div class="value">v{{ summary.version }}</div>
          <div class="label">Version</div>
        </div>
      </div>

      <div class="result-panel">
        <strong>Available Projections:</strong>
        <pre><code>{{ summary.projections.join(', ') }}</code></pre>
      </div>

      <div class="result-panel">
        <strong>First 10 Barcodes:</strong>
        <pre><code>{{ barcodes.join('\n') }}</code></pre>
      </div>

      <div v-if="summary.matrixStats" class="result-panel">
        <strong>Matrix Statistics:</strong>
        <pre><code>Shape: {{ summary.matrixStats.shape[0] }} genes × {{ summary.matrixStats.shape[1] }} cells
Non-zero values: {{ summary.matrixStats.nnz.toLocaleString() }}
Sparsity: {{ (summary.matrixStats.sparsity * 100).toFixed(1) }}%</code></pre>
      </div>
    </template>
  </div>
</template>
