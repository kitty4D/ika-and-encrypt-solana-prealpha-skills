// Should trigger: uses message_hash / messageHash instead of message_digest.
export function makeApproval(message_hash: Uint8Array) {
  const messageHash = message_hash;
  return { messageHash };
}
