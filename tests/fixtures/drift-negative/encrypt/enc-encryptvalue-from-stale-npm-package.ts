// Must NOT trigger: hand-rolled 17-byte helper, no import of encryptValue from
// the npm package. Workaround until the package republishes past 0.1.0.

function mockEncryptScalarBytes(value: bigint, fheType: number): Uint8Array {
  const buf = new Uint8Array(17);
  buf[0] = fheType;
  let v = value;
  for (let i = 0; i < 16; i++) {
    buf[1 + i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return buf;
}

const ct = mockEncryptScalarBytes(42n, 4);
