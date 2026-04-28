// Should trigger enc-mock-ciphertext-16-byte-no-type-tag: hand-rolled 16-byte
// ciphertext buffer with no fhe_type prefix, plus a single-arg mockCiphertext call.

export function mockCiphertext(value: bigint): Uint8Array {
  const buf = new Uint8Array(16);
  let v = value;
  for (let i = 0; i < 16; i++) {
    buf[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return buf;
}

const ct = mockCiphertext(42n);
