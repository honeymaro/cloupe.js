# BarcodeReader

Class for reading cell barcodes.

## Access

```typescript
const reader = await CloupeReader.open(file);
const barcodeReader = reader.barcodes;
```

## Properties

### count

```typescript
get count(): number
```

Returns the total number of barcodes.

## Methods

### read()

```typescript
async read(options?: PaginationOptions): Promise<string[]>
```

Reads barcodes.

**Parameters**

| Name           | Type     | Description                   |
| -------------- | -------- | ----------------------------- |
| options.offset | `number` | Start position (default: 0)   |
| options.limit  | `number` | Number to read (default: all) |

**Examples**

```typescript
// Read all
const barcodes = await reader.barcodes.read();
console.log(barcodes[0]); // "AAACCCAAGCGCCCAT-1"

// With pagination
const page1 = await reader.barcodes.read({ offset: 0, limit: 1000 });
const page2 = await reader.barcodes.read({ offset: 1000, limit: 1000 });
```

### readOne()

```typescript
async readOne(index: number): Promise<string>
```

Reads a single barcode.

**Parameters**

| Name  | Type     | Description   |
| ----- | -------- | ------------- |
| index | `number` | Barcode index |

**Examples**

```typescript
const barcode = await reader.barcodes.readOne(0);
console.log(barcode); // "AAACCCAAGCGCCCAT-1"
```

### clearCache()

```typescript
clearCache(): void
```

Clears cached data.

## Barcode Format

10x Genomics barcodes typically follow this format:

```
AAACCCAAGCGCCCAT-1
└──────┬───────┘ └┘
   16bp sequence  Sample ID
```

- **16bp sequence**: DNA sequence identifying the cell
- **Sample ID**: Sample identifier when multiple samples are merged
