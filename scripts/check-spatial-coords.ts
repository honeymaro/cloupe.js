/**
 * Script to check spatial coordinate ranges
 * Compares coordinates to image dimensions to understand the coordinate system
 */
import { CloupeReader } from "../src/index";
import * as fs from "fs";

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npx tsx scripts/check-spatial-coords.ts <cloupe-file>");
    process.exit(1);
  }

  console.log(`Analyzing: ${filePath}\n`);

  // Open file as Blob for Node.js
  const buffer = fs.readFileSync(filePath);
  const blob = new Blob([buffer]);

  const reader = await CloupeReader.open(blob);

  // Get spatial projection
  const projections = reader.projections.availableProjections;
  console.log("Available projections:", projections);

  const spatialProj = await reader.projections.read("Spatial");
  if (!spatialProj) {
    console.error("Spatial projection not found");
    process.exit(1);
  }

  console.log(`\nSpatial projection:`);
  console.log(`  Name: ${spatialProj.name}`);
  console.log(`  Dimensions: ${spatialProj.dimensions}`);
  console.log(`  Points: ${spatialProj.numPoints}`);

  // Get coordinate bounds
  const bounds = spatialProj.getBounds();
  console.log(`\nCoordinate bounds:`);
  for (let i = 0; i < bounds.min.length; i++) {
    console.log(
      `  Dimension ${i}: min=${bounds.min[i].toFixed(2)}, max=${bounds.max[i].toFixed(2)}`
    );
  }

  // Get image info
  const imageNames = reader.spatialImages.availableImages;
  console.log(`\nSpatial images: ${imageNames}`);

  if (imageNames.length > 0) {
    const image = await reader.spatialImages.read(imageNames[0]);
    console.log(`\nImage "${image.name}":`);
    console.log(`  Dimensions: ${image.width} x ${image.height} pixels`);

    // Compare
    console.log(`\n=== Coordinate System Analysis ===`);
    console.log(`Image size: ${image.width} x ${image.height}`);
    console.log(`X range: ${bounds.min[0].toFixed(2)} to ${bounds.max[0].toFixed(2)}`);
    console.log(`Y range: ${bounds.min[1].toFixed(2)} to ${bounds.max[1].toFixed(2)}`);

    if (
      bounds.max[0] <= image.width &&
      bounds.max[1] <= image.height &&
      bounds.min[0] >= 0 &&
      bounds.min[1] >= 0
    ) {
      console.log(`\n✓ Coordinates appear to be in pixel space with (0,0) at top-left`);
      console.log(
        `  X range covers ${(((bounds.max[0] - bounds.min[0]) / image.width) * 100).toFixed(1)}% of image width`
      );
      console.log(
        `  Y range covers ${(((bounds.max[1] - bounds.min[1]) / image.height) * 100).toFixed(1)}% of image height`
      );
    } else {
      console.log(`\n⚠ Coordinates may NOT be in pixel space`);
      console.log(`  X range exceeds image width: ${bounds.max[0] > image.width}`);
      console.log(`  Y range exceeds image height: ${bounds.max[1] > image.height}`);
    }

    // Check if 3rd dimension exists
    if (spatialProj.dimensions >= 3) {
      console.log(`\n3rd dimension (likely spot diameter/radius):`);
      console.log(`  Range: ${bounds.min[2].toFixed(2)} to ${bounds.max[2].toFixed(2)}`);
    }
  }

  // Sample some coordinates
  console.log(`\n=== Sample coordinates (first 5 points) ===`);
  for (let i = 0; i < Math.min(5, spatialProj.numPoints); i++) {
    const coords = spatialProj.getCoordinates(i);
    console.log(`  Point ${i}: [${coords?.map((c) => c.toFixed(2)).join(", ")}]`);
  }

  reader.close();
}

main().catch(console.error);
