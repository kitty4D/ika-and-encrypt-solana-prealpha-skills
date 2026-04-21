// Must NOT trigger: canonical message_digest terminology.
export function makeApproval(message_digest: Uint8Array) {
  return { message_digest };
}
