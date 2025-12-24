# FeatureReader

Class for reading gene/protein information.

## Access

```typescript
const reader = await CloupeReader.open(file);
const featureReader = reader.features;
```

## Properties

### count

```typescript
get count(): number
```

Returns the total number of features.

## Methods

### read()

```typescript
async read(options?: PaginationOptions): Promise<Feature[]>
```

Reads feature list.

**Returns**

```typescript
interface Feature {
  index: number; // Index in matrix
  id: string; // Ensembl ID, etc. (e.g., ENSG00000167286)
  name: string; // Gene symbol (e.g., CD3D)
  type?: string; // Feature type (e.g., Gene Expression)
}
```

**Examples**

```typescript
// Read all
const features = await reader.features.read();
console.log(features[0]);
// { index: 0, id: "ENSG00000167286", name: "CD3D", type: "Gene Expression" }

// With pagination
const page = await reader.features.read({ offset: 0, limit: 100 });
```

### readOne()

```typescript
async readOne(index: number): Promise<Feature>
```

Reads a single feature.

### search()

```typescript
async search(query: string): Promise<Array<{ index: number; feature: Feature }>>
```

Searches features by name or ID. Case-insensitive.

**Examples**

```typescript
// Search for genes starting with CD3
const results = await reader.features.search("CD3");

for (const { index, feature } of results) {
  console.log(`${feature.name} (${feature.id}) at index ${index}`);
}
// CD3D (ENSG00000167286) at index 1234
// CD3E (ENSG00000198851) at index 1235
// CD3G (ENSG00000160654) at index 1236
```

### findByName()

```typescript
async findByName(name: string): Promise<{ index: number; feature: Feature } | null>
```

Finds a feature by exact name. Case-insensitive.

**Examples**

```typescript
const result = await reader.features.findByName("CD3D");

if (result) {
  console.log(`Found at index ${result.index}`);
  console.log(result.feature);
} else {
  console.log("Not found");
}
```

### clearCache()

```typescript
clearCache(): void
```

Clears cached data.

## Feature Types

Common feature types:

| Type                 | Description       |
| -------------------- | ----------------- |
| Gene Expression      | mRNA expression   |
| Antibody Capture     | CITE-seq proteins |
| CRISPR Guide Capture | Perturb-seq gRNAs |
| Multiplexing Capture | Cell hashing      |
