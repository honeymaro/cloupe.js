# Browser Support

This page describes browsers supported by cloupe.js and required features.

## Supported Browsers

| Browser | Minimum Version | Notes          |
| ------- | --------------- | -------------- |
| Chrome  | 76+             | Recommended    |
| Firefox | 69+             |                |
| Safari  | 14+             |                |
| Edge    | 79+             | Chromium-based |

## Required Browser Features

### File API with `slice()`

Uses File/Blob's `slice()` method to read specific parts of .cloupe files.

```typescript
// How it works internally
const chunk = file.slice(start, end);
const buffer = await chunk.arrayBuffer();
```

### BigInt

CSC matrix indices and pointers are stored as uint64. JavaScript's Number can only accurately represent up to 53 bits, so BigInt is required.

```typescript
// Reading uint64 values
const value = dataView.getBigUint64(offset, true);
```

### TextDecoder

Barcodes and feature names are encoded in UTF-8.

```typescript
const decoder = new TextDecoder("utf-8");
const text = decoder.decode(bytes);
```

### ArrayBuffer & TypedArrays

Required for binary data processing:

- `ArrayBuffer`
- `DataView`
- `Uint8Array`, `Float64Array`, `BigUint64Array`, etc.

## Additional Requirements for Web Workers

### SharedArrayBuffer (Optional)

To efficiently share large data between main thread and workers, SharedArrayBuffer is needed. This feature requires the following HTTP headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

The library works without SharedArrayBuffer, but there will be overhead from data copying.

### Module Worker

Web Workers are loaded as ES modules:

```typescript
const worker = new Worker(
  new URL("cloupe/worker", import.meta.url),
  { type: "module" } // Required
);
```

## Requirements for Loading Files from URL

### Range Requests

To load .cloupe files from remote URLs, the server must support HTTP Range requests:

```
Accept-Ranges: bytes
Content-Range: bytes 0-1023/1048576
```

### CORS

To load files from different domains, CORS headers are required:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: Range
Access-Control-Expose-Headers: Content-Range, Content-Length
```

## Feature Detection

You can check for required features at runtime:

```typescript
function checkBrowserSupport(): { supported: boolean; missing: string[] } {
  const missing: string[] = [];

  // BigInt
  if (typeof BigInt === "undefined") {
    missing.push("BigInt");
  }

  // TextDecoder
  if (typeof TextDecoder === "undefined") {
    missing.push("TextDecoder");
  }

  // File.slice
  if (typeof File !== "undefined" && typeof File.prototype.slice !== "function") {
    missing.push("File.slice");
  }

  // ArrayBuffer
  if (typeof ArrayBuffer === "undefined") {
    missing.push("ArrayBuffer");
  }

  return {
    supported: missing.length === 0,
    missing,
  };
}

const { supported, missing } = checkBrowserSupport();
if (!supported) {
  console.error(`Browser not supported. Missing: ${missing.join(", ")}`);
}
```

## Polyfills

Most modern browsers support all required features. If you need to support older browsers:

### BigInt Polyfill

BigInt cannot be polyfilled. cloupe.js cannot be used in browsers that don't support BigInt.

### TextDecoder Polyfill

```bash
npm install text-encoding-polyfill
```

```typescript
import "text-encoding-polyfill";
```

## Performance Considerations

### Performance Differences by Browser

- **Chrome/Edge**: Best File API slice() performance
- **Firefox**: Slight overhead for large file processing
- **Safari**: More conservative memory management

### Recommendations

1. **Use Chrome or Edge**: Especially for large files over 100MB
2. **Use Web Workers**: Prevent main thread blocking
3. **Use pagination**: Don't load all data at once

```typescript
// Good
const barcodes = await reader.getBarcodes({ offset: 0, limit: 1000 });

// Avoid (for large files)
const allBarcodes = await reader.getBarcodes();
```
