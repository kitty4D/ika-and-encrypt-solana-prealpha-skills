// Must NOT trigger: explicitly skips the 1-byte FHE-type prefix.
import { createEncryptClient } from "@encrypt.xyz/pre-alpha-solana-client";

export async function readCiphertext(id: string) {
  const client = createEncryptClient();
  const res = await client.ReadCiphertext({ id });
  const fhe_type_byte = res.body[0];
  return { fheType: fhe_type_byte, data: res.body.slice(1) };
}
