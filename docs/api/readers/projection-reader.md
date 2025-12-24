# ProjectionReader

Class for reading UMAP, t-SNE, PCA and other dimensionality reduction coordinates.

## Access

```typescript
const reader = await CloupeReader.open(file);
const projectionReader = reader.projections;
```

## Properties

### availableProjections

```typescript
get availableProjections(): string[]
```

Returns available projection names.

## Methods

### read()

```typescript
async read(name: string): Promise<Projection>
```

Reads projection by name.

**Parameters**

| Name | Type     | Description                             |
| ---- | -------- | --------------------------------------- |
| name | `string` | Projection name (e.g., 'UMAP', 't-SNE') |

**Examples**

```typescript
const umap = await reader.projections.read("UMAP");

console.log(`Dimensions: ${umap.dimensions}`);
console.log(`Points: ${umap.numPoints}`);

// X, Y coordinate arrays
const x = umap.coordinates[0]; // Float64Array
const y = umap.coordinates[1]; // Float64Array
```

### readDefault()

```typescript
async readDefault(): Promise<Projection | null>
```

Returns the default projection. Returns `null` if no projections available.

### getBounds()

```typescript
async getBounds(name: string): Promise<{
  min: number[];
  max: number[];
}>
```

Returns projection bounds.

**Examples**

```typescript
const bounds = await reader.projections.getBounds("UMAP");

console.log(`X: ${bounds.min[0]} ~ ${bounds.max[0]}`);
console.log(`Y: ${bounds.min[1]} ~ ${bounds.max[1]}`);
```

### clearCache()

```typescript
clearCache(): void
```

Clears cached data.

## Projection Class

Methods of the Projection class returned by `read()`:

### getCoordinates()

```typescript
getCoordinates(cellIndex: number): number[] | null
```

Returns coordinates for a specific cell.

**Examples**

```typescript
const projection = await reader.projections.read("UMAP");

const coords = projection.getCoordinates(0);
if (coords) {
  console.log(`Cell 0: (${coords[0]}, ${coords[1]})`);
}
```

### getBounds()

```typescript
getBounds(): { min: number[]; max: number[] }
```

Returns bounds for all dimensions.

## Common Projection Types

| Name  | Description                                   |
| ----- | --------------------------------------------- |
| UMAP  | Uniform Manifold Approximation and Projection |
| t-SNE | t-distributed Stochastic Neighbor Embedding   |
| PCA   | Principal Component Analysis                  |
