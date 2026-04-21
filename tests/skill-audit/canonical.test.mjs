import { test } from "node:test";
import assert from "node:assert/strict";

import { parseSkillCanonical as parseEncryptCanonical } from "../../skills/encrypt-solana-prealpha/scripts/lib/canonical.mjs";
import { parseSkillCanonical as parseIkaCanonical } from "../../skills/ika-solana-prealpha/scripts/lib/canonical.mjs";

const ENCRYPT_SKILL = `
## environment (pre-alpha)

| resource | value |
| --- | --- |
| Encrypt gRPC (TLS) | \`https://pre-alpha-dev-1.encrypt.ika-network.net:443\` |
| Solana RPC | \`https://api.devnet.solana.com\` |
| Encrypt program id | \`4ebfzWdKnrnGseuQpezXdG8yCdHqwQ1SSBHD3bWArND8\` |
`;

const IKA_SKILL = `
## environment (pre-alpha)

| resource | value |
| --- | --- |
| dWallet gRPC | \`https://pre-alpha-dev-1.ika.ika-network.net:443\` |
| Solana RPC | \`https://api.devnet.solana.com\` |
| dWallet program id | \`87W54kGYFQ1rgWqMeu4XTPHWXWmXSQCcjm8vCTfiq1oY\` |
`;

test("parseEncryptCanonical extracts gRPC, RPC, and program id", () => {
  const c = parseEncryptCanonical(ENCRYPT_SKILL);
  assert.equal(c.grpc, "https://pre-alpha-dev-1.encrypt.ika-network.net:443");
  assert.equal(c.rpc, "https://api.devnet.solana.com");
  assert.equal(c.programId, "4ebfzWdKnrnGseuQpezXdG8yCdHqwQ1SSBHD3bWArND8");
});

test("parseIkaCanonical extracts dWallet values", () => {
  const c = parseIkaCanonical(IKA_SKILL);
  assert.equal(c.grpc, "https://pre-alpha-dev-1.ika.ika-network.net:443");
  assert.equal(c.rpc, "https://api.devnet.solana.com");
  assert.equal(c.programId, "87W54kGYFQ1rgWqMeu4XTPHWXWmXSQCcjm8vCTfiq1oY");
});

test("parseEncryptCanonical tolerates CRLF", () => {
  const c = parseEncryptCanonical(ENCRYPT_SKILL.replace(/\n/g, "\r\n"));
  assert.equal(c.programId, "4ebfzWdKnrnGseuQpezXdG8yCdHqwQ1SSBHD3bWArND8");
});

test("parseEncryptCanonical throws when rows are missing", () => {
  assert.throws(() => parseEncryptCanonical("no table here"));
});

test("parseIkaCanonical throws when rows are missing", () => {
  assert.throws(() => parseIkaCanonical("no table here"));
});
