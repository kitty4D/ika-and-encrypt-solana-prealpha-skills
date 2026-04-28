// Must NOT trigger: emits the canonical 17-byte [fhe_type || value_le] format
// and every call site passes the fheType argument.

export function mockCiphertext(value: bigint, fheType: number): Uint8Array {
  const buf = new Uint8Array(17);
  buf[0] = fheType;
  let v = value;
  for (let i = 0; i < 16; i++) {
    buf[1 + i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return buf;
}

const ct = mockCiphertext(42n, 4);
