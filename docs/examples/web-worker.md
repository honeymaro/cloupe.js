# Web Worker Usage

Use Web Workers to prevent main thread blocking when processing large .cloupe files.

## Why Use Web Workers?

.cloupe files can range from hundreds of megabytes to several gigabytes. Processing large data on the main thread causes:

- UI freezing (unresponsive)
- User interaction blocked
- Browser may suggest terminating the script

Web Workers run in a separate thread, preventing these issues.

## Basic Setup

### Vite

```typescript
// main.ts
import { CloupeWorkerClient } from "cloupe";

const worker = new Worker(new URL("cloupe/worker", import.meta.url), { type: "module" });

const client = new CloupeWorkerClient(worker);
```

### Webpack

```javascript
// webpack.config.js
module.exports = {
  module: {
    rules: [
      {
        test: /\.worker\.ts$/,
        use: { loader: "worker-loader" },
      },
    ],
  },
};
```

```typescript
// main.ts
import CloupeWorker from "cloupe/worker";
import { CloupeWorkerClient } from "cloupe";

const worker = new CloupeWorker();
const client = new CloupeWorkerClient(worker);
```

## API Usage

CloupeWorkerClient provides the same API as CloupeReader:

```typescript
import { CloupeWorkerClient } from "cloupe";

// Create Worker
const worker = new Worker(new URL("cloupe/worker", import.meta.url), { type: "module" });
const client = new CloupeWorkerClient(worker);

// Open file
await client.open(file);

// Read data (same API as CloupeReader)
const summary = await client.getSummary();
const barcodes = await client.getBarcodes({ limit: 100 });
const projection = await client.getProjection("UMAP");
const expression = await client.getExpressionByFeatureName("CD3D");

// Cleanup
await client.close();
client.terminate(); // Terminate worker
```

## Example: Progress Display

```typescript
import { CloupeWorkerClient } from "cloupe";

async function loadWithProgress(file: File, onProgress: (msg: string) => void) {
  const worker = new Worker(new URL("cloupe/worker", import.meta.url), { type: "module" });
  const client = new CloupeWorkerClient(worker);

  try {
    onProgress("Opening file...");
    await client.open(file);

    onProgress("Loading summary...");
    const summary = await client.getSummary();

    onProgress("Loading projection...");
    const projection = await client.getProjection("UMAP");

    onProgress("Loading features...");
    const features = await client.getFeatures();

    onProgress("Complete!");

    return { summary, projection, features };
  } finally {
    await client.close();
    client.terminate();
  }
}

// Usage
const result = await loadWithProgress(file, (msg) => {
  document.getElementById("status").textContent = msg;
});
```

## Example: Large Data Processing

```typescript
import { CloupeWorkerClient } from "cloupe";

async function analyzeExpression(
  file: File,
  geneNames: string[],
  onProgress: (progress: number) => void
) {
  const worker = new Worker(new URL("cloupe/worker", import.meta.url), { type: "module" });
  const client = new CloupeWorkerClient(worker);

  try {
    await client.open(file);

    const results: Map<string, number> = new Map();

    for (let i = 0; i < geneNames.length; i++) {
      const expression = await client.getExpressionByFeatureName(geneNames[i]);

      if (expression) {
        const mean = expression.values.reduce((a, b) => a + b, 0) / expression.values.length;
        results.set(geneNames[i], mean);
      }

      onProgress((i + 1) / geneNames.length);
    }

    return results;
  } finally {
    await client.close();
    client.terminate();
  }
}

// Usage
const genes = ["CD3D", "CD4", "CD8A", "MS4A1", "CD14"];
const results = await analyzeExpression(file, genes, (progress) => {
  progressBar.value = progress * 100;
});
```

## Example: React Hook

```tsx
import { useState, useEffect, useCallback } from "react";
import { CloupeWorkerClient } from "cloupe";

interface UseCloupeWorkerResult {
  client: CloupeWorkerClient | null;
  isLoading: boolean;
  error: Error | null;
  open: (file: File) => Promise<void>;
  close: () => Promise<void>;
}

export function useCloupeWorker(): UseCloupeWorkerResult {
  const [client, setClient] = useState<CloupeWorkerClient | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL("cloupe/worker", import.meta.url), { type: "module" });
    const newClient = new CloupeWorkerClient(worker);
    setClient(newClient);

    return () => {
      newClient.terminate();
    };
  }, []);

  const open = useCallback(
    async (file: File) => {
      if (!client) return;

      setIsLoading(true);
      setError(null);

      try {
        await client.open(file);
      } catch (e) {
        setError(e instanceof Error ? e : new Error("Unknown error"));
      } finally {
        setIsLoading(false);
      }
    },
    [client]
  );

  const close = useCallback(async () => {
    if (!client) return;
    await client.close();
  }, [client]);

  return { client, isLoading, error, open, close };
}

// Usage
function MyComponent() {
  const { client, isLoading, error, open, close } = useCloupeWorker();
  const [summary, setSummary] = useState(null);

  const handleFileSelect = async (file: File) => {
    await open(file);
    if (client) {
      const sum = await client.getSummary();
      setSummary(sum);
    }
  };

  if (error) return <div>Error: {error.message}</div>;
  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <input type="file" onChange={(e) => handleFileSelect(e.target.files[0])} />
      {summary && <pre>{JSON.stringify(summary, null, 2)}</pre>}
    </div>
  );
}
```

## Important Notes

### Data Transfer

Data transfer between worker and main thread uses the structured clone algorithm:

- TypedArrays (Float64Array, etc.) are transferred efficiently
- Large data may take time to transfer
- Original data is detached after transfer (transferable objects)

### Memory

- Workers use separate memory space
- Be aware of browser memory limits when loading large data
- Call `clearCache()` for unnecessary data

### Browser Support

- All modern browsers supported
- Module Workers require ES module-capable browsers
- SharedArrayBuffer usage requires CORS headers
