// Must NOT trigger: checks the BCS enum tag byte before decoding V1.
export function parseAttestation(bytes: Uint8Array): V1Body {
  const tag = bytes[0];
  if (tag !== 0) throw new Error("unknown VersionedDWalletDataAttestation variant: " + tag);
  return decodeV1(bytes.slice(1));
}

function decodeV1(_: Uint8Array): V1Body {
  return {} as V1Body;
}

type V1Body = { sig: Uint8Array };
