// Should trigger: ReadCiphertext is called but no byte-0 prefix skip is visible.
import { createEncryptClient } from "@encrypt.xyz/pre-alpha-solana-client";

export async function readCiphertext(id: string) {
  const client = createEncryptClient();
  const res = await client.ReadCiphertext({ id });
  return res.body;
}
