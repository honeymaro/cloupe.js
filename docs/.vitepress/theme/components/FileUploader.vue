<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  sampleUrl?: string;
  sampleName?: string;
}>();

const emit = defineEmits<{
  (e: 'file-selected', file: File): void;
  (e: 'url-selected', url: string): void;
}>();

const isDragover = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const loadingSample = ref(false);

function handleDrop(e: DragEvent) {
  isDragover.value = false;
  const file = e.dataTransfer?.files[0];
  if (file && file.name.endsWith('.cloupe')) {
    emit('file-selected', file);
  }
}

function handleFileChange(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    emit('file-selected', file);
  }
}

function openFileDialog() {
  fileInput.value?.click();
}

async function loadSample() {
  if (!props.sampleUrl) return;
  loadingSample.value = true;
  emit('url-selected', props.sampleUrl);
}
</script>

<template>
  <div class="file-uploader">
    <div
      class="file-drop-zone"
      :class="{ dragover: isDragover }"
      @click="openFileDialog"
      @dragover.prevent="isDragover = true"
      @dragleave="isDragover = false"
      @drop.prevent="handleDrop"
    >
      <input
        ref="fileInput"
        type="file"
        accept=".cloupe"
        @change="handleFileChange"
      />
      <div class="icon">📁</div>
      <p>Drop a .cloupe file here or click to select</p>
    </div>

    <div v-if="sampleUrl" class="sample-loader">
      <span class="divider-text">or</span>
      <button
        class="sample-button"
        :disabled="loadingSample"
        @click="loadSample"
      >
        {{ loadingSample ? 'Loading...' : `Load Sample (${sampleName || 'AMLTutorial.cloupe'})` }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.file-uploader {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.sample-loader {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.divider-text {
  color: var(--vp-c-text-3);
  font-size: 0.875rem;
}

.sample-button {
  padding: 0.5rem 1rem;
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 4px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.sample-button:hover:not(:disabled) {
  background: var(--vp-c-brand-1);
  color: white;
}

.sample-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
