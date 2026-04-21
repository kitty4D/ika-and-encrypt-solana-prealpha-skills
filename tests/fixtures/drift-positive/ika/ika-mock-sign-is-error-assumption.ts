// Should trigger: the stale "mock Sign always returns Error" assumption.
//
// Note: in mock mode the Sign RPC always returns an Error; it never commits a
// MessageApproval. This claim is the one CHANGELOG-IKA.md 2026-04-17 flipped.
export async function signMock() {
  return { ok: false, reason: "mock" };
}
