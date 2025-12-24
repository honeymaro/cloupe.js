/**
 * Script to analyze .cloupe file structure
 */

import { readFileSync } from "fs";
import { gunzipSync } from "fflate";

const filePath = process.argv[2] || "./tests/fixtures/AMLTutorial.cloupe";

console.log(`Analyzing: ${filePath}\n`);

const buffer = readFileSync(filePath);

// Read header (first 4096 bytes)
const headerBytes = buffer.subarray(0, 4096);
let headerEnd = 4096;
for (let i = 0; i < 4096; i++) {
  if (headerBytes[i] === 0) {
    headerEnd = i;
    break;
  }
}

const headerStr = headerBytes.subarray(0, headerEnd).toString("utf-8");
const header = JSON.parse(headerStr);

console.log("=== HEADER ===");
console.log(JSON.stringify(header, null, 2));

// Read index block
const indexStart = header.indexBlock.Start;
const indexEnd = header.indexBlock.End;
console.log(`\n=== INDEX BLOCK (bytes ${indexStart}-${indexEnd}) ===`);

let indexBytes = buffer.subarray(indexStart, indexEnd);

// Check if gzip compressed
if (indexBytes[0] === 0x1f && indexBytes[1] === 0x8b) {
  console.log("Index block is gzip compressed");
  indexBytes = Buffer.from(gunzipSync(indexBytes));
}

const indexStr = indexBytes.toString("utf-8");
const indexBlock = JSON.parse(indexStr);

console.log("\nTop-level keys:", Object.keys(indexBlock));

// Print structure for each key
for (const key of Object.keys(indexBlock)) {
  const value = indexBlock[key];
  console.log(`\n--- ${key} ---`);

  if (Array.isArray(value)) {
    console.log(`Array with ${value.length} items`);
    if (value.length > 0) {
      console.log("First item structure:", JSON.stringify(value[0], null, 2).slice(0, 1000));
    }
  } else if (typeof value === "object" && value !== null) {
    console.log("Object keys:", Object.keys(value));
    console.log(JSON.stringify(value, null, 2).slice(0, 1000));
  } else {
    console.log(value);
  }
}

// Check nextHeaderOffset for additional data
if (header.nextHeaderOffset) {
  console.log(`\n=== NEXT HEADER (offset ${header.nextHeaderOffset}) ===`);
  const nextHeaderBytes = buffer.subarray(header.nextHeaderOffset, header.nextHeaderOffset + 4096);
  let nextHeaderEnd = 4096;
  for (let i = 0; i < 4096; i++) {
    if (nextHeaderBytes[i] === 0) {
      nextHeaderEnd = i;
      break;
    }
  }

  if (nextHeaderEnd > 0) {
    const nextHeaderStr = nextHeaderBytes.subarray(0, nextHeaderEnd).toString("utf-8");
    try {
      const nextHeader = JSON.parse(nextHeaderStr);
      console.log(JSON.stringify(nextHeader, null, 2));
    } catch {
      console.log("Not JSON:", nextHeaderStr.slice(0, 200));
    }
  }
}
