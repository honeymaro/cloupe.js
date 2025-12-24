# CellTrackReader

Class for reading cell tracks (clusters, annotations, etc.).

## Access

```typescript
const reader = await CloupeReader.open(file);
const cellTrackReader = reader.cellTracks;
```

## Properties

### availableTracks

```typescript
get availableTracks(): string[]
```

Returns available cell track names.

## Methods

### read()

```typescript
async read(name: string): Promise<CellTrack>
```

Reads cell track by name.

**Parameters**

| Name | Type     | Description                               |
| ---- | -------- | ----------------------------------------- |
| name | `string` | Track name (e.g., 'Cluster', 'LibraryID') |

**Examples**

```typescript
const track = await reader.cellTracks.read("Cluster");

console.log(`Name: ${track.name}`);
console.log(`Categories: ${track.categories.join(", ")}`);
```

### getCellsInCategory()

```typescript
async getCellsInCategory(trackName: string, category: string | number): Promise<number[]>
```

Returns cell indices belonging to a specific category.

**Examples**

```typescript
const tCellIndices = await reader.cellTracks.getCellsInCategory("Cluster", "T cells");
console.log(`${tCellIndices.length} T cells found`);
```

### clearCache()

```typescript
clearCache(): void
```

Clears cached data.

## CellTrack Class

Methods of the CellTrack class returned by `read()`:

### getCategoryCounts()

```typescript
getCategoryCounts(): Record<string | number, number>
```

Returns cell count for each category.

**Examples**

```typescript
const track = await reader.cellTracks.read("Cluster");
const counts = track.getCategoryCounts();

for (const [category, count] of Object.entries(counts)) {
  console.log(`${category}: ${count} cells`);
}
// T cells: 2341 cells
// B cells: 1234 cells
// Monocytes: 876 cells
```

### getCellsInCategory()

```typescript
getCellsInCategory(category: string | number): number[]
```

Returns cell indices for a specific category.

**Examples**

```typescript
const track = await reader.cellTracks.read("Cluster");
const indices = track.getCellsInCategory("T cells");

// indices: [0, 3, 7, 12, ...]
```

### getCategoryForCell()

```typescript
getCategoryForCell(cellIndex: number): string | number | null
```

Returns the category for a specific cell.

**Examples**

```typescript
const track = await reader.cellTracks.read("Cluster");
const category = track.getCategoryForCell(0);

console.log(`Cell 0 belongs to: ${category}`);
```

## Common Cell Tracks

| Name       | Description         |
| ---------- | ------------------- |
| Cluster    | Cluster assignments |
| LibraryID  | Library/sample ID   |
| Annotation | Custom annotations  |

## Example: Cluster Analysis

```typescript
const track = await reader.getCellTrack("Cluster");
const counts = track.getCategoryCounts();

// Find largest cluster
const largestCluster = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];

console.log(`Largest cluster: ${largestCluster[0]} (${largestCluster[1]} cells)`);

// Analyze gene expression in that cluster
const clusterCells = track.getCellsInCategory(largestCluster[0]);
const expression = await reader.getExpressionByFeatureName("CD3D");

if (expression) {
  const clusterExpression = clusterCells.filter((i) => expression.indices.includes(i));
  console.log(`CD3D+ cells in ${largestCluster[0]}: ${clusterExpression.length}`);
}
```
