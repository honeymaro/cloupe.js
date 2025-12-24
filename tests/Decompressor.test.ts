import { describe, it, expect } from "vitest";
import { gzipSync } from "fflate";
import {
  isGzipCompressed,
  decompress,
  decompressToString,
  decompressToJson,
} from "../src/utils/Decompressor.js";
import { CloupeError } from "../src/types/index.js";

describe("Decompressor", () => {
  describe("isGzipCompressed", () => {
    it("should detect gzip magic bytes", () => {
      const gzipData = new Uint8Array([0x1f, 0x8b, 0x08, 0x00]);
      expect(isGzipCompressed(gzipData)).toBe(true);
    });

    it("should return false for non-gzip data", () => {
      const plainData = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
      expect(isGzipCompressed(plainData)).toBe(false);
    });

    it("should return false for short data", () => {
      const shortData = new Uint8Array([0x1f]);
      expect(isGzipCompressed(shortData)).toBe(false);
    });
  });

  describe("decompress", () => {
    it("should decompress gzip data", () => {
      const original = "Hello, World!";
      const originalBytes = new TextEncoder().encode(original);
      const compressed = gzipSync(originalBytes);

      const decompressed = decompress(compressed);
      const result = new TextDecoder().decode(decompressed);

      expect(result).toBe(original);
    });

    it("should return uncompressed data as-is", () => {
      const original = new Uint8Array([1, 2, 3, 4, 5]);
      const result = decompress(original);

      expect(Array.from(result)).toEqual([1, 2, 3, 4, 5]);
    });

    it("should throw on invalid gzip data", () => {
      // Invalid gzip: has magic bytes but corrupted content
      const invalid = new Uint8Array([0x1f, 0x8b, 0x00, 0x00, 0xff, 0xff]);

      expect(() => decompress(invalid)).toThrow(CloupeError);
    });
  });

  describe("decompressToString", () => {
    it("should decompress and decode as UTF-8", () => {
      const original = "日本語テスト";
      const originalBytes = new TextEncoder().encode(original);
      const compressed = gzipSync(originalBytes);

      const result = decompressToString(compressed);
      expect(result).toBe(original);
    });

    it("should handle uncompressed string", () => {
      const original = "Plain text";
      const bytes = new TextEncoder().encode(original);

      const result = decompressToString(bytes);
      expect(result).toBe(original);
    });
  });

  describe("decompressToJson", () => {
    it("should decompress and parse JSON", () => {
      const original = { name: "test", value: 42 };
      const jsonStr = JSON.stringify(original);
      const compressed = gzipSync(new TextEncoder().encode(jsonStr));

      const result = decompressToJson(compressed);
      expect(result).toEqual(original);
    });

    it("should throw on invalid JSON", () => {
      const invalid = "not valid json";
      const bytes = new TextEncoder().encode(invalid);

      expect(() => decompressToJson(bytes)).toThrow(CloupeError);
    });

    it("should handle nested objects", () => {
      const original = {
        header: { version: "1.0" },
        data: [1, 2, 3],
        nested: { a: { b: { c: true } } },
      };
      const jsonStr = JSON.stringify(original);
      const compressed = gzipSync(new TextEncoder().encode(jsonStr));

      const result = decompressToJson(compressed);
      expect(result).toEqual(original);
    });
  });
});
