# Visualization Examples

Examples for visualizing projection data using Canvas or SVG.

## Try It Yourself

Upload a .cloupe file to visualize projections:

<ProjectionViewer />

## Basic Canvas Visualization

```html
<canvas id="canvas" width="800" height="600"></canvas>

<script type="module">
  import { CloupeReader } from "cloupe.js";

  async function visualize(file) {
    const reader = await CloupeReader.open(file);

    // Load projection data
    const projection = await reader.getDefaultProjection();
    if (!projection) {
      console.error("No projection available");
      return;
    }

    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas;

    // Get bounds for coordinate normalization
    const bounds = projection.getBounds();
    const xRange = bounds.max[0] - bounds.min[0];
    const yRange = bounds.max[1] - bounds.min[1];

    // Padding
    const padding = 40;
    const plotWidth = width - padding * 2;
    const plotHeight = height - padding * 2;

    // Coordinate transformation functions
    function transformX(x) {
      return padding + ((x - bounds.min[0]) / xRange) * plotWidth;
    }

    function transformY(y) {
      // Flip Y axis (canvas is top to bottom)
      return height - padding - ((y - bounds.min[1]) / yRange) * plotHeight;
    }

    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Draw points
    const x = projection.coordinates[0];
    const y = projection.coordinates[1];

    ctx.fillStyle = "rgba(59, 130, 246, 0.5)"; // Semi-transparent blue

    for (let i = 0; i < projection.numPoints; i++) {
      ctx.beginPath();
      ctx.arc(transformX(x[i]), transformY(y[i]), 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Title
    ctx.fillStyle = "#000000";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(projection.name, width / 2, 20);

    reader.close();
  }
</script>
```

## Cluster-colored Visualization

```typescript
import { CloupeReader, CellTrack } from "cloupe.js";

async function visualizeWithClusters(file: File, canvas: HTMLCanvasElement, trackName: string) {
  const reader = await CloupeReader.open(file);

  const projection = await reader.getDefaultProjection();
  const track = await reader.getCellTrack(trackName);

  if (!projection) {
    throw new Error("No projection available");
  }

  const ctx = canvas.getContext("2d")!;
  const { width, height } = canvas;

  // Color palette
  const colors = [
    "#3B82F6",
    "#EF4444",
    "#10B981",
    "#F59E0B",
    "#8B5CF6",
    "#EC4899",
    "#06B6D4",
    "#84CC16",
    "#F97316",
    "#6366F1",
  ];

  // Map categories to colors
  const categoryColors = new Map<string | number, string>();
  track.categories.forEach((cat, i) => {
    categoryColors.set(cat, colors[i % colors.length]);
  });

  // Calculate bounds
  const bounds = projection.getBounds();
  const xRange = bounds.max[0] - bounds.min[0];
  const yRange = bounds.max[1] - bounds.min[1];

  const padding = 40;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;

  function transformX(x: number) {
    return padding + ((x - bounds.min[0]) / xRange) * plotWidth;
  }

  function transformY(y: number) {
    return height - padding - ((y - bounds.min[1]) / yRange) * plotHeight;
  }

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Draw points
  const x = projection.coordinates[0];
  const y = projection.coordinates[1];

  for (let i = 0; i < projection.numPoints; i++) {
    const category = track.getCategoryForCell(i);
    const color = categoryColors.get(category!) || "#888888";

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(transformX(x[i]), transformY(y[i]), 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Legend
  let legendY = padding;
  ctx.font = "12px sans-serif";
  ctx.textAlign = "left";

  for (const [category, color] of categoryColors) {
    ctx.fillStyle = color;
    ctx.fillRect(width - 120, legendY, 12, 12);
    ctx.fillStyle = "#000000";
    ctx.fillText(String(category), width - 100, legendY + 10);
    legendY += 18;
  }

  reader.close();
}
```

## Gene Expression Heatmap

```typescript
async function visualizeExpression(file: File, canvas: HTMLCanvasElement, geneName: string) {
  const reader = await CloupeReader.open(file);

  const projection = await reader.getDefaultProjection();
  const expression = await reader.getExpressionByFeatureName(geneName);

  if (!projection || !expression) {
    throw new Error("Data not available");
  }

  const ctx = canvas.getContext("2d")!;
  const { width, height } = canvas;

  // Normalize expression values
  const maxValue = Math.max(...expression.values);
  const expressionMap = new Map<number, number>();

  for (let i = 0; i < expression.indices.length; i++) {
    expressionMap.set(expression.indices[i], expression.values[i]);
  }

  // Color gradient function (gray → red)
  function getColor(value: number): string {
    const normalized = value / maxValue;
    const r = Math.round(128 + normalized * 127);
    const g = Math.round(128 * (1 - normalized));
    const b = Math.round(128 * (1 - normalized));
    return `rgb(${r}, ${g}, ${b})`;
  }

  // Bounds
  const bounds = projection.getBounds();
  const xRange = bounds.max[0] - bounds.min[0];
  const yRange = bounds.max[1] - bounds.min[1];

  const padding = 40;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;

  function transformX(x: number) {
    return padding + ((x - bounds.min[0]) / xRange) * plotWidth;
  }

  function transformY(y: number) {
    return height - padding - ((y - bounds.min[1]) / yRange) * plotHeight;
  }

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const x = projection.coordinates[0];
  const y = projection.coordinates[1];

  // Draw cells without expression first (gray)
  ctx.fillStyle = "#cccccc";
  for (let i = 0; i < projection.numPoints; i++) {
    if (!expressionMap.has(i)) {
      ctx.beginPath();
      ctx.arc(transformX(x[i]), transformY(y[i]), 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Draw cells with expression (colored)
  for (let i = 0; i < projection.numPoints; i++) {
    const value = expressionMap.get(i);
    if (value !== undefined) {
      ctx.fillStyle = getColor(value);
      ctx.beginPath();
      ctx.arc(transformX(x[i]), transformY(y[i]), 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Title
  ctx.fillStyle = "#000000";
  ctx.font = "16px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${geneName} Expression`, width / 2, 20);

  // Color bar
  const barWidth = 20;
  const barHeight = 100;
  const barX = width - padding - barWidth;
  const barY = height / 2 - barHeight / 2;

  const gradient = ctx.createLinearGradient(0, barY + barHeight, 0, barY);
  gradient.addColorStop(0, "rgb(128, 128, 128)");
  gradient.addColorStop(1, "rgb(255, 0, 0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(barX, barY, barWidth, barHeight);

  ctx.font = "10px sans-serif";
  ctx.textAlign = "left";
  ctx.fillStyle = "#000000";
  ctx.fillText("0", barX + barWidth + 5, barY + barHeight);
  ctx.fillText(maxValue.toFixed(1), barX + barWidth + 5, barY + 10);

  reader.close();
}
```

## SVG Visualization

```typescript
async function createSVG(file: File): Promise<SVGSVGElement> {
  const reader = await CloupeReader.open(file);
  const projection = await reader.getDefaultProjection();

  if (!projection) {
    throw new Error("No projection available");
  }

  const width = 800;
  const height = 600;
  const padding = 40;

  const bounds = projection.getBounds();
  const xRange = bounds.max[0] - bounds.min[0];
  const yRange = bounds.max[1] - bounds.min[1];

  const scaleX = (width - padding * 2) / xRange;
  const scaleY = (height - padding * 2) / yRange;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  // Background
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("width", "100%");
  bg.setAttribute("height", "100%");
  bg.setAttribute("fill", "white");
  svg.appendChild(bg);

  // Group for points
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");

  const x = projection.coordinates[0];
  const y = projection.coordinates[1];

  for (let i = 0; i < projection.numPoints; i++) {
    const cx = padding + (x[i] - bounds.min[0]) * scaleX;
    const cy = height - padding - (y[i] - bounds.min[1]) * scaleY;

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", String(cx));
    circle.setAttribute("cy", String(cy));
    circle.setAttribute("r", "2");
    circle.setAttribute("fill", "rgba(59, 130, 246, 0.5)");
    circle.setAttribute("data-index", String(i));

    group.appendChild(circle);
  }

  svg.appendChild(group);

  // Title
  const title = document.createElementNS("http://www.w3.org/2000/svg", "text");
  title.setAttribute("x", String(width / 2));
  title.setAttribute("y", "25");
  title.setAttribute("text-anchor", "middle");
  title.setAttribute("font-size", "16");
  title.textContent = projection.name;
  svg.appendChild(title);

  reader.close();

  return svg;
}

// Usage
const svg = await createSVG(file);
document.body.appendChild(svg);
```

## Adding Interactivity

```typescript
function addInteractivity(canvas: HTMLCanvasElement, projection: Projection, barcodes: string[]) {
  const bounds = projection.getBounds();
  const padding = 40;
  const { width, height } = canvas;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;
  const xRange = bounds.max[0] - bounds.min[0];
  const yRange = bounds.max[1] - bounds.min[1];

  // Inverse transformation function
  function screenToData(sx: number, sy: number): [number, number] {
    const x = bounds.min[0] + ((sx - padding) / plotWidth) * xRange;
    const y = bounds.min[1] + ((height - padding - sy) / plotHeight) * yRange;
    return [x, y];
  }

  // Find nearest point
  function findNearest(mx: number, my: number): number | null {
    const [dx, dy] = screenToData(mx, my);
    let minDist = Infinity;
    let nearest: number | null = null;

    const x = projection.coordinates[0];
    const y = projection.coordinates[1];

    for (let i = 0; i < projection.numPoints; i++) {
      const dist = Math.hypot(x[i] - dx, y[i] - dy);
      if (dist < minDist) {
        minDist = dist;
        nearest = i;
      }
    }

    // Threshold (in data coordinates)
    const threshold = Math.max(xRange, yRange) * 0.02;
    return minDist < threshold ? nearest : null;
  }

  // Tooltip
  const tooltip = document.createElement("div");
  tooltip.style.cssText = `
    position: absolute;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    pointer-events: none;
    display: none;
  `;
  document.body.appendChild(tooltip);

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const idx = findNearest(mx, my);

    if (idx !== null) {
      tooltip.textContent = `Cell ${idx}: ${barcodes[idx]}`;
      tooltip.style.left = `${e.clientX + 10}px`;
      tooltip.style.top = `${e.clientY + 10}px`;
      tooltip.style.display = "block";
      canvas.style.cursor = "pointer";
    } else {
      tooltip.style.display = "none";
      canvas.style.cursor = "default";
    }
  });

  canvas.addEventListener("mouseleave", () => {
    tooltip.style.display = "none";
  });
}
```
