// Should trigger this rule: imports encryptValue from the npm package, which on
// version 0.1.0 still ships the pre-fix 16-byte helper.

import { createEncryptWebClient, encryptValue } from "@encrypt.xyz/pre-alpha-solana-client/grpc-web";

const client = createEncryptWebClient("https://pre-alpha-dev-1.encrypt.ika-network.net:443");
const ct = encryptValue(42n, 4); // even with fheType, package @0.1.0 emits 16 bytes
