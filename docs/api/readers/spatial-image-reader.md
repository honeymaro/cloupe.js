# SpatialImageReader

Class for reading spatial H&E (Hematoxylin and Eosin) images from Spatial/Visium .cloupe files.

Spatial images are stored as tile pyramids (similar to web map tiles like Leaflet/OpenLayers), enabling efficient viewing at different zoom levels without loading the entire image into memory.

## Access

```typescript
const reader = await CloupeReader.open(file);
const spatialReader = reader.spatialImages;
```

## Properties

### availableImages

```typescript
get availableImages(): string[]
```

Returns available spatial image names.

### count

```typescript
get count(): number
```

Returns the number of available spatial images.

## Methods

### read()

```typescript
async read(name: string): Promise<SpatialImage>
```

Reads spatial image metadata by name.

**Parameters**

| Name | Type     | Description        |
| ---- | -------- | ------------------ |
| name | `string` | Spatial image name |

**Examples**

```typescript
const image = await reader.spatialImages.read("Visium_HD_microscope.btf");

console.log(`Name: ${image.name}`);
console.log(`Size: ${image.width} x ${image.height}`);
console.log(`Tile Size: ${image.tileSize}px`);
console.log(`Zoom Levels: ${image.minZoom} - ${image.maxZoom}`);
console.log(`Type: ${image.type}`); // "brightfield" or "fluorescence"
```

### readDefault()

```typescript
async readDefault(): Promise<SpatialImage | null>
```

Returns the first spatial image. Returns `null` if no spatial images available.

### getTile()

```typescript
async getTile(
  imageName: string,
  level: number,
  x: number,
  y: number
): Promise<Uint8Array>
```

Gets a specific tile as PNG binary data.

**Parameters**

| Name      | Type     | Description               |
| --------- | -------- | ------------------------- |
| imageName | `string` | Name of the spatial image |
| level     | `number` | Zoom level                |
| x         | `number` | Tile X coordinate         |
| y         | `number` | Tile Y coordinate         |

**Examples**

```typescript
// Get a specific tile
const tilePng = await reader.spatialImages.getTile(
  "Visium_HD_microscope.btf",
  15, // zoom level
  10, // x tile index
  5 // y tile index
);

// tilePng is a Uint8Array containing PNG data

// Display in browser
const blob = new Blob([tilePng], { type: "image/png" });
const url = URL.createObjectURL(blob);
document.getElementById("tile-img").src = url;
```

### getThumbnail()

```typescript
async getThumbnail(imageName?: string): Promise<Uint8Array>
```

Gets the thumbnail (smallest zoom level tile) for a spatial image.

**Parameters**

| Name      | Type     | Description                                 |
| --------- | -------- | ------------------------------------------- |
| imageName | `string` | Optional. Defaults to first available image |

**Examples**

```typescript
const thumbnail = await reader.spatialImages.getThumbnail();
const blob = new Blob([thumbnail], { type: "image/png" });
const url = URL.createObjectURL(blob);
document.getElementById("thumbnail").src = url;
```

### getTilesInRegion()

```typescript
async getTilesInRegion(
  imageName: string,
  level: number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
): Promise<Map<string, Uint8Array>>
```

Gets all tiles within a specific region.

**Examples**

```typescript
const tiles = await reader.spatialImages.getTilesInRegion("Visium_HD_microscope.btf", 12, {
  minX: 0,
  minY: 0,
  maxX: 5,
  maxY: 5,
});

// tiles is a Map<string, Uint8Array>
// Keys are like "12/0_0.png", "12/1_0.png", etc.
```

### getTileAsObjectURL()

```typescript
async getTileAsObjectURL(
  imageName: string,
  level: number,
  x: number,
  y: number
): Promise<string>
```

Gets a tile as a Blob URL (browser only). Remember to call `URL.revokeObjectURL()` when done.

### getTileAsDataURL()

```typescript
async getTileAsDataURL(
  imageName: string,
  level: number,
  x: number,
  y: number
): Promise<string>
```

Gets a tile as a Base64 data URL.

### clearCache()

```typescript
clearCache(imageName?: string): void
```

Clears cached metadata.

### clearTileCache()

```typescript
clearTileCache(): void
```

Clears the tile cache.

### setTileCacheSize()

```typescript
setTileCacheSize(size: number): void
```

Sets the maximum number of tiles to cache (default: 100).

## SpatialImage Class

The `SpatialImage` class returned by `read()`:

### Properties

```typescript
class SpatialImage {
  readonly name: string;
  readonly width: number; // Original image width in pixels
  readonly height: number; // Original image height in pixels
  readonly format: string; // Image format (usually "png")
  readonly type: string; // "brightfield" or "fluorescence"
  readonly tileSize: number; // Tile size in pixels (usually 512)
  readonly tileOverlap: number; // Tile overlap in pixels
  readonly zoomLevels: ZoomLevelInfo[];
  readonly minZoom: number; // Minimum zoom level (thumbnail)
  readonly maxZoom: number; // Maximum zoom level (full resolution)
}
```

### getZoomLevel()

```typescript
getZoomLevel(level: number): ZoomLevelInfo | null
```

Returns information about a specific zoom level.

### getTileKey()

```typescript
getTileKey(level: number, x: number, y: number): string
```

Returns the tile key string (e.g., "15/10_5.png").

### coordsToTile()

```typescript
coordsToTile(level: number, pixelX: number, pixelY: number): { x: number; y: number }
```

Converts pixel coordinates to tile indices at a given zoom level.

## ZoomLevelInfo Interface

```typescript
interface ZoomLevelInfo {
  level: number; // Zoom level number
  gridWidth: number; // Number of tiles horizontally
  gridHeight: number; // Number of tiles vertically
  tileCount: number; // Total number of tiles at this level
}
```

## Integration with Map Libraries

### Leaflet Example

```typescript
import L from "leaflet";
import { CloupeReader } from "cloupe.js";

async function createViewer(container: HTMLElement, file: File) {
  const reader = await CloupeReader.open(file);
  const image = await reader.spatialImages.readDefault();

  const map = L.map(container, {
    crs: L.CRS.Simple,
    minZoom: image.minZoom,
    maxZoom: image.maxZoom,
  });

  const bounds = L.latLngBounds([0, 0], [image.height, image.width]);
  map.fitBounds(bounds);

  // Custom tile layer
  const tileLayer = L.tileLayer("", { tileSize: image.tileSize });

  tileLayer.createTile = function (coords, done) {
    const tile = document.createElement("img");

    reader.spatialImages
      .getTile(image.name, coords.z, coords.x, coords.y)
      .then((pngData) => {
        const blob = new Blob([pngData], { type: "image/png" });
        tile.src = URL.createObjectURL(blob);
        tile.onload = () => {
          URL.revokeObjectURL(tile.src);
          done(null, tile);
        };
      })
      .catch((err) => done(err, tile));

    return tile;
  };

  tileLayer.addTo(map);
}
```

## Notes

- Spatial images are stored as tile pyramids for efficient viewing
- Tiles are PNG format, stored uncompressed in the .cloupe file
- Higher zoom levels have more tiles but show more detail
- Use `getThumbnail()` for quick previews
- Consider using LRU cache for large-scale tile viewing
