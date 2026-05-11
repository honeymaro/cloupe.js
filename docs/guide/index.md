# Guide

Learn how to read .cloupe files in the browser using cloupe.js.

## Introduction

cloupe.js is a JavaScript library for reading 10x Genomics Loupe Browser file format (.cloupe) in browser environments. It uses the File API for random access without loading the entire file into memory.

## Key Features

### Lazy Loading

cloupe.js reads only the data you need. When you open a file, only the header and index are parsed. Actual data is read only when requested.

```typescript
const reader = await CloupeReader.open(file);

// Only header/index parsed, no data read yet
console.log(reader.barcodeCount); // Metadata available immediately

// Barcode data is read at this point
const barcodes = await reader.getBarcodes();
```

### Random Access

Efficiently reads sparse matrices in CSC (Compressed Sparse Column) format. You can fetch expression data for specific genes or cells without loading the entire matrix.

```typescript
// Read expression data for a specific gene only
const expression = await reader.getExpressionByFeatureName("CD3D");

// Read expression data for a specific cell only
const cellExpression = await reader.getCellExpression(0);
```

### Compression Support

.cloupe files use gzip compression. cloupe.js supports all three compression modes:

- **No compression** (CompressionType=0)
- **Standard gzip** (CompressionType=1)
- **Block-indexed compression** (CompressionType=2): Used for large data, enables random access

## Supported producers

This library reads `.cloupe` files written by:

- [10XGenomics/loupeR](https://github.com/10XGenomics/loupeR) (R) and
  [linearparadox/loupepy](https://github.com/linearparadox/loupepy) (Python)
- 10x Genomics Cell Ranger / Space Ranger pipelines
- Loupe Browser when saving user annotations

### Tested producer versions

| Producer                                  | Version range tested | Notes                                                                                         |
| ----------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------- |
| `loupeR`                                  | ≤ 1.1.5 (2026-02)    | Full support                                                                                  |
| `loupepy`                                 | ≤ 1.1.1 (2025-08)    | Full support                                                                                  |
| Loupe Browser (user annotation read-back) | 8.x – 9.0 (2025-06)  | Full support                                                                                  |
| Loupe Browser 9.1+ (Visium HD 11 mm)      | 9.1 (2026-04)        | **Partial** — spatial-image tile reads are reverse-engineered and may not handle 11 mm slides |

The format is reverse-engineered from public readers / writers. See
[cellgeni/cloupe](https://github.com/cellgeni/cloupe) for the Python reference.

## Next Steps

- [Installation](/guide/installation) - Add cloupe.js to your project
- [Getting Started](/guide/getting-started) - Learn basic usage
- [API Reference](/api/) - Detailed API documentation
