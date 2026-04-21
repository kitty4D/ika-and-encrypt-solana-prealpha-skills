// Should trigger: decodes VersionedDWalletDataAttestation without obvious enum tag handling.
import { bcs } from "@mysten/bcs";

export function parseAttestation(bytes: Uint8Array): VersionedDWalletDataAttestation {
  return deserialize(bytes) as VersionedDWalletDataAttestation;
}

function deserialize(_: Uint8Array): unknown {
  return null;
}

type VersionedDWalletDataAttestation = unknown;
