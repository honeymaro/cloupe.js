import { describe, it, expect } from "vitest";
import { BinaryReader } from "../src/utils/BinaryReader.js";

describe("BinaryReader", () => {
  describe("basic reading", () => {
    it("should read uint8", () => {
      const buffer = new Uint8Array([0x42, 0xff]).buffer;
      const reader = new BinaryReader(buffer);

      expect(reader.readUint8()).toBe(0x42);
      expect(reader.readUint8()).toBe(0xff);
    });

    it("should read int16 (little-endian)", () => {
      const buffer = new Uint8Array([0x01, 0x00, 0xff, 0xff]).buffer;
      const reader = new BinaryReader(buffer, true);

      expect(reader.readInt16()).toBe(1);
      expect(reader.readInt16()).toBe(-1);
    });

    it("should read uint32 (little-endian)", () => {
      const buffer = new Uint8Array([0x78, 0x56, 0x34, 0x12]).buffer;
      const reader = new BinaryReader(buffer, true);

      expect(reader.readUint32()).toBe(0x12345678);
    });

    it("should read float64", () => {
      const arr = new Float64Array([3.14159, -42.5]);
      const reader = new BinaryReader(arr.buffer);

      expect(reader.readFloat64()).toBeCloseTo(3.14159, 5);
      expect(reader.readFloat64()).toBe(-42.5);
    });

    it("should read uint64 as bigint", () => {
      const arr = new BigUint64Array([BigInt("18446744073709551615")]);
      const reader = new BinaryReader(arr.buffer);

      expect(reader.readUint64()).toBe(BigInt("18446744073709551615"));
    });
  });

  describe("position management", () => {
    it("should track position", () => {
      const buffer = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer;
      const reader = new BinaryReader(buffer);

      expect(reader.offset).toBe(0);
      reader.readUint32();
      expect(reader.offset).toBe(4);
      expect(reader.remaining).toBe(4);
    });

    it("should seek to position", () => {
      const buffer = new Uint8Array([1, 2, 3, 4]).buffer;
      const reader = new BinaryReader(buffer);

      reader.seek(2);
      expect(reader.readUint8()).toBe(3);
    });

    it("should skip bytes", () => {
      const buffer = new Uint8Array([1, 2, 3, 4]).buffer;
      const reader = new BinaryReader(buffer);

      reader.skip(2);
      expect(reader.readUint8()).toBe(3);
    });

    it("should throw on invalid seek", () => {
      const buffer = new Uint8Array([1, 2, 3, 4]).buffer;
      const reader = new BinaryReader(buffer);

      expect(() => reader.seek(-1)).toThrow(RangeError);
      expect(() => reader.seek(10)).toThrow(RangeError);
    });
  });

  describe("string reading", () => {
    it("should read fixed-length string with null padding", () => {
      const str = "hello\0\0\0";
      const bytes = new TextEncoder().encode(str);
      const reader = new BinaryReader(bytes.buffer);

      expect(reader.readFixedString(8)).toBe("hello");
    });

    it("should read null-terminated string", () => {
      const str = "hello\0world";
      const bytes = new TextEncoder().encode(str);
      const reader = new BinaryReader(bytes.buffer);

      expect(reader.readNullTerminatedString()).toBe("hello");
      expect(reader.readNullTerminatedString()).toBe("world");
    });

    it("should read UTF-8 string", () => {
      const str = "日本語テスト";
      const bytes = new TextEncoder().encode(str);
      const reader = new BinaryReader(bytes.buffer);

      expect(reader.readString(bytes.length)).toBe(str);
    });
  });

  describe("array reading", () => {
    it("should read float64 array", () => {
      const arr = new Float64Array([1.1, 2.2, 3.3]);
      const reader = new BinaryReader(arr.buffer);

      const result = reader.readFloat64Array(3);
      expect(result.length).toBe(3);
      expect(result[0]).toBeCloseTo(1.1);
      expect(result[1]).toBeCloseTo(2.2);
      expect(result[2]).toBeCloseTo(3.3);
    });

    it("should read int16 array", () => {
      const arr = new Int16Array([100, -200, 300]);
      const reader = new BinaryReader(arr.buffer);

      const result = reader.readInt16Array(3);
      expect(Array.from(result)).toEqual([100, -200, 300]);
    });
  });

  describe("peek", () => {
    it("should peek without advancing position", () => {
      const buffer = new Uint8Array([1, 2, 3, 4]).buffer;
      const reader = new BinaryReader(buffer);

      const peeked = reader.peek(2);
      expect(Array.from(peeked)).toEqual([1, 2]);
      expect(reader.offset).toBe(0);
    });
  });

  describe("fromUint8Array", () => {
    it("should create reader from Uint8Array slice", () => {
      const full = new Uint8Array([0, 0, 1, 2, 3, 4, 0, 0]);
      const slice = full.subarray(2, 6);
      const reader = BinaryReader.fromUint8Array(slice);

      expect(reader.length).toBe(4);
      expect(reader.readUint8()).toBe(1);
    });
  });
});
