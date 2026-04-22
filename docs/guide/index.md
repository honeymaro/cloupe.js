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

## Next Steps

- [Installation](/guide/installation) - Add cloupe.js to your project
- [Getting Started](/guide/getting-started) - Learn basic usage
- [API Reference](/api/) - Detailed API documentation
