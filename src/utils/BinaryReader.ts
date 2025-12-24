/**
 * BinaryReader - A wrapper around DataView for convenient binary data parsing
 *
 * Supports reading various data types from ArrayBuffer with automatic
 * position tracking and both little-endian and big-endian byte orders.
 */

export class BinaryReader {
  private view: DataView;
  private position: number;
  private littleEndian: boolean;

  /**
   * Creates a new BinaryReader
   * @param buffer - The ArrayBuffer to read from
   * @param littleEndian - Whether to use little-endian byte order (default: true)
   */
  constructor(buffer: ArrayBuffer, littleEndian = true) {
    this.view = new DataView(buffer);
    this.position = 0;
    this.littleEndian = littleEndian;
  }

  /**
   * Creates a BinaryReader from a Uint8Array
   */
  static fromUint8Array(data: Uint8Array, littleEndian = true): BinaryReader {
    return new BinaryReader(
      data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer,
      littleEndian
    );
  }

  /**
   * Gets the current read position
   */
  get offset(): number {
    return this.position;
  }

  /**
   * Gets the total buffer length
   */
  get length(): number {
    return this.view.byteLength;
  }

  /**
   * Gets the remaining bytes to read
   */
  get remaining(): number {
    return this.length - this.position;
  }

  /**
   * Checks if there are more bytes to read
   */
  get hasMore(): boolean {
    return this.position < this.length;
  }

  /**
   * Seeks to a specific position
   */
  seek(position: number): this {
    if (position < 0 || position > this.length) {
      throw new RangeError(`Position ${position} out of bounds [0, ${this.length}]`);
    }
    this.position = position;
    return this;
  }

  /**
   * Skips a number of bytes
   */
  skip(bytes: number): this {
    return this.seek(this.position + bytes);
  }

  /**
   * Reads an unsigned 8-bit integer
   */
  readUint8(): number {
    const value = this.view.getUint8(this.position);
    this.position += 1;
    return value;
  }

  /**
   * Reads a signed 8-bit integer
   */
  readInt8(): number {
    const value = this.view.getInt8(this.position);
    this.position += 1;
    return value;
  }

  /**
   * Reads an unsigned 16-bit integer
   */
  readUint16(): number {
    const value = this.view.getUint16(this.position, this.littleEndian);
    this.position += 2;
    return value;
  }

  /**
   * Reads a signed 16-bit integer
   */
  readInt16(): number {
    const value = this.view.getInt16(this.position, this.littleEndian);
    this.position += 2;
    return value;
  }

  /**
   * Reads an unsigned 32-bit integer
   */
  readUint32(): number {
    const value = this.view.getUint32(this.position, this.littleEndian);
    this.position += 4;
    return value;
  }

  /**
   * Reads a signed 32-bit integer
   */
  readInt32(): number {
    const value = this.view.getInt32(this.position, this.littleEndian);
    this.position += 4;
    return value;
  }

  /**
   * Reads an unsigned 64-bit integer as BigInt
   */
  readUint64(): bigint {
    const value = this.view.getBigUint64(this.position, this.littleEndian);
    this.position += 8;
    return value;
  }

  /**
   * Reads an unsigned 64-bit integer as number (may lose precision for large values)
   */
  readUint64AsNumber(): number {
    return Number(this.readUint64());
  }

  /**
   * Reads a signed 64-bit integer as BigInt
   */
  readInt64(): bigint {
    const value = this.view.getBigInt64(this.position, this.littleEndian);
    this.position += 8;
    return value;
  }

  /**
   * Reads a 32-bit float
   */
  readFloat32(): number {
    const value = this.view.getFloat32(this.position, this.littleEndian);
    this.position += 4;
    return value;
  }

  /**
   * Reads a 64-bit double
   */
  readFloat64(): number {
    const value = this.view.getFloat64(this.position, this.littleEndian);
    this.position += 8;
    return value;
  }

  /**
   * Reads raw bytes as Uint8Array
   */
  readBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(this.view.buffer, this.view.byteOffset + this.position, length);
    this.position += length;
    return bytes;
  }

  /**
   * Reads a null-terminated string (stops at first null byte)
   */
  readNullTerminatedString(maxLength?: number): string {
    const startPos = this.position;
    const maxPos = maxLength ? Math.min(this.position + maxLength, this.length) : this.length;

    while (this.position < maxPos && this.view.getUint8(this.position) !== 0) {
      this.position++;
    }

    const bytes = new Uint8Array(
      this.view.buffer,
      this.view.byteOffset + startPos,
      this.position - startPos
    );

    // Skip the null terminator if present
    if (this.position < this.length && this.view.getUint8(this.position) === 0) {
      this.position++;
    }

    return new TextDecoder("utf-8").decode(bytes);
  }

  /**
   * Reads a fixed-length string (with null padding trimmed)
   */
  readFixedString(length: number): string {
    const bytes = this.readBytes(length);
    // Find the first null byte to trim padding
    let end = bytes.length;
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] === 0) {
        end = i;
        break;
      }
    }
    return new TextDecoder("utf-8").decode(bytes.subarray(0, end));
  }

  /**
   * Reads a UTF-8 string of specified byte length
   */
  readString(byteLength: number): string {
    const bytes = this.readBytes(byteLength);
    return new TextDecoder("utf-8").decode(bytes);
  }

  /**
   * Reads an array of 64-bit doubles
   */
  readFloat64Array(count: number): Float64Array {
    const result = new Float64Array(count);
    for (let i = 0; i < count; i++) {
      result[i] = this.readFloat64();
    }
    return result;
  }

  /**
   * Reads an array of unsigned 64-bit integers as numbers
   */
  readUint64Array(count: number): Float64Array {
    const result = new Float64Array(count);
    for (let i = 0; i < count; i++) {
      result[i] = this.readUint64AsNumber();
    }
    return result;
  }

  /**
   * Reads an array of signed 16-bit integers
   */
  readInt16Array(count: number): Int16Array {
    const result = new Int16Array(count);
    for (let i = 0; i < count; i++) {
      result[i] = this.readInt16();
    }
    return result;
  }

  /**
   * Reads an array of unsigned 32-bit integers
   */
  readUint32Array(count: number): Uint32Array {
    const result = new Uint32Array(count);
    for (let i = 0; i < count; i++) {
      result[i] = this.readUint32();
    }
    return result;
  }

  /**
   * Reads an array of signed 32-bit integers
   */
  readInt32Array(count: number): Int32Array {
    const result = new Int32Array(count);
    for (let i = 0; i < count; i++) {
      result[i] = this.readInt32();
    }
    return result;
  }

  /**
   * Peeks at bytes without advancing position
   */
  peek(length: number): Uint8Array {
    const pos = this.position;
    const bytes = this.readBytes(length);
    this.position = pos;
    return bytes;
  }

  /**
   * Gets the underlying ArrayBuffer
   */
  getBuffer(): ArrayBuffer {
    return this.view.buffer.slice(
      this.view.byteOffset,
      this.view.byteOffset + this.view.byteLength
    ) as ArrayBuffer;
  }
}
