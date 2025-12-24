<script setup lang="ts">
import { ref, onUnmounted } from 'vue';
import { CloupeReader } from 'cloupe';

const SAMPLE_URL = '/samples/AMLTutorial.cloupe';

interface SearchResult {
  index: number;
  name: string;
  id: string;
}

const reader = ref<CloupeReader | null>(null);
const searchQuery = ref('');
const searchResults = ref<SearchResult[]>([]);
const selectedGene = ref<SearchResult | null>(null);
const expressionStats = ref<{
  expressedCells: number;
  totalCells: number;
  min: number;
  max: number;
  mean: number;
} | null>(null);
const loading = ref(false);
const searching = ref(false);
const error = ref<string | null>(null);
const fileLoaded = ref(false);

async function handleFile(file: File) {
  await loadData(() => CloupeReader.open(file));
}

async function handleUrl(url: string) {
  await loadData(() => CloupeReader.open(url));
}

async function loadData(openFn: () => Promise<CloupeReader>) {
  loading.value = true;
  error.value = null;
  searchResults.value = [];
  selectedGene.value = null;
  expressionStats.value = null;
  fileLoaded.value = false;

  try {
    if (reader.value) {
      reader.value.close();
    }

    reader.value = await openFn();
    fileLoaded.value = true;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load file';
  } finally {
    loading.value = false;
  }
}

async function searchGenes() {
  if (!reader.value || !searchQuery.value.trim()) return;

  searching.value = true;
  try {
    const results = await reader.value.features.search(searchQuery.value);
    searchResults.value = results.slice(0, 20).map(r => ({
      index: r.index,
      name: r.feature.name,
      id: r.feature.id,
    }));
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Search failed';
  } finally {
    searching.value = false;
  }
}

async function selectGene(gene: SearchResult) {
  if (!reader.value) return;

  selectedGene.value = gene;
  loading.value = true;

  try {
    const expression = await reader.value.getFeatureExpression(gene.index);

    if (expression && expression.values.length > 0) {
      const values = Array.from(expression.values);
      expressionStats.value = {
        expressedCells: expression.indices.length,
        totalCells: reader.value.barcodeCount,
        min: Math.min(...values),
        max: Math.max(...values),
        mean: values.reduce((a, b) => a + b, 0) / values.length,
      };
    } else {
      expressionStats.value = {
        expressedCells: 0,
        totalCells: reader.value.barcodeCount,
        min: 0,
        max: 0,
        mean: 0,
      };
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load expression';
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
    <h4>Interactive Example: Gene Expression</h4>

    <FileUploader
      :sample-url="SAMPLE_URL"
      sample-name="AMLTutorial.cloupe (40MB)"
      @file-selected="handleFile"
      @url-selected="handleUrl"
    />

    <div v-if="error" class="error-message">{{ error }}</div>

    <template v-if="fileLoaded && !loading">
      <div class="controls">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search genes (e.g., CD3D, MS4A1)"
          @keyup.enter="searchGenes"
        />
        <button @click="searchGenes" :disabled="searching || !searchQuery.trim()">
          {{ searching ? 'Searching...' : 'Search' }}
        </button>
      </div>

      <div v-if="searchResults.length > 0" class="result-panel">
        <strong>Search Results:</strong>
        <table class="data-table">
          <thead>
            <tr>
              <th>Index</th>
              <th>Name</th>
              <th>ID</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="gene in searchResults" :key="gene.index">
              <td>{{ gene.index }}</td>
              <td>{{ gene.name }}</td>
              <td>{{ gene.id }}</td>
              <td>
                <button @click="selectGene(gene)" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">
                  View
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="selectedGene && expressionStats" class="result-panel">
        <strong>Expression: {{ selectedGene.name }}</strong>
        <div class="stats-grid" style="margin-top: 0.5rem;">
          <div class="stat-card">
            <div class="value">{{ expressionStats.expressedCells.toLocaleString() }}</div>
            <div class="label">Expressed Cells</div>
          </div>
          <div class="stat-card">
            <div class="value">{{ ((expressionStats.expressedCells / expressionStats.totalCells) * 100).toFixed(1) }}%</div>
            <div class="label">% Expressed</div>
          </div>
          <div class="stat-card">
            <div class="value">{{ expressionStats.mean.toFixed(2) }}</div>
            <div class="label">Mean</div>
          </div>
          <div class="stat-card">
            <div class="value">{{ expressionStats.max.toFixed(2) }}</div>
            <div class="label">Max</div>
          </div>
        </div>
      </div>
    </template>

    <div v-if="loading" class="loading">Loading...</div>
  </div>
</template>
