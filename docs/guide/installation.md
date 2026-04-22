# Installation

## Package Managers

### npm

```bash
npm install cloupe.js
```

### pnpm

```bash
pnpm add cloupe.js
```

### yarn

```bash
yarn add cloupe.js
```

## CDN

To use directly in the browser via CDN:

```html
<script type="module">
  import { CloupeReader } from "https://unpkg.com/cloupe/dist/cloupe.js";

  // Start using
</script>
```

## Requirements

### Browser Support

| Browser | Minimum Version |
| ------- | --------------- |
| Chrome  | 76+             |
| Firefox | 69+             |
| Safari  | 14+             |
| Edge    | 79+             |

### Required Features

cloupe.js requires the following browser features:

- **File API with `slice()`**: Read specific parts of a file
- **BigInt**: Handle uint64 values (CSC indices/pointers)
- **TextDecoder**: Decode UTF-8 strings

### TypeScript

TypeScript 4.5 or higher is recommended. Type definitions are included in the package.

```typescript
import { CloupeReader, Feature, Projection } from "cloupe.js";
```

## Bundler Configuration

### Vite

No additional configuration needed with Vite.

```typescript
// vite.config.ts
export default defineConfig({
  // Works with default settings
});
```

### Webpack

Additional configuration may be needed for Webpack 5:

```javascript
// webpack.config.js
module.exports = {
  resolve: {
    fallback: {
      // Polyfills for Node.js modules used by fflate
      buffer: false,
      stream: false,
    },
  },
};
```

### Web Worker Setup

To use Web Workers, your bundler needs to build worker files separately.

#### Vite

```typescript
// In your code
const worker = new Worker(new URL("cloupe/worker", import.meta.url), { type: "module" });
```

## Next Steps

Once installed, check [Getting Started](/guide/getting-started) to write your first code.
