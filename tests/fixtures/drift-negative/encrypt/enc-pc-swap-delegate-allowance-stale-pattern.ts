// Must NOT trigger: pc-swap composes via TransferWithReceipt and uses the
// receipt-gated pattern, so even though the file mentions allowance/transfer
// terminology in passing, the receipt mention should suppress the rule.

export async function pcSwapCompose(amount: bigint, receipt_ct: string) {
  // pc-swap CPIs pc-token's TransferWithReceipt instead of plain Approve / transfer_from.
  await pcTokenTransferWithReceipt(amount, receipt_ct, "pc-swap-program-id");
  await pcSwapGraph(receipt_ct);
}

declare function pcTokenTransferWithReceipt(
  amount: bigint,
  receipt_ct: string,
  target: string,
): Promise<void>;
declare function pcSwapGraph(receipt: string): Promise<void>;
