/**
 * Parse the Encrypt skill's canonical environment strings (gRPC, Solana RPC, program ID)
 * out of SKILL.md's environment table.
 */

export function parseSkillCanonical(skillMd) {
  const norm = skillMd.replace(/\r\n/g, "\n");
  const grpc = norm.match(/\|\s*Encrypt gRPC \(TLS\)\s*\|\s*`([^`]+)`/);
  const rpc = norm.match(/\|\s*Solana RPC\s*\|\s*`([^`]+)`/);
  const pid = norm.match(/\|\s*Encrypt program id\s*\|\s*`([^`]+)`/);
  if (!grpc || !rpc || !pid) {
    throw new Error("Could not parse environment table from SKILL.md");
  }
  return {
    grpc: grpc[1],
    rpc: rpc[1],
    programId: pid[1],
  };
}
