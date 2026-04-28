// Should trigger this rule: pc-swap composes with pc-token via the older
// Approve / transfer_from delegate flow only.

export async function pcSwapCompose(amount: bigint) {
  // pc-swap calls Approve then transfer_from on pc-token.
  await pcTokenApprove(delegate, amount);
  await pcTokenTransferFrom(from, to, amount);
}

declare const delegate: string;
declare const from: string;
declare const to: string;
declare function pcTokenApprove(d: string, a: bigint): Promise<void>;
declare function pcTokenTransferFrom(f: string, t: string, a: bigint): Promise<void>;
