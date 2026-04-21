// Must NOT trigger: uses the canonical "message_approval" seed chunk.
use solana_program::pubkey::Pubkey;

pub fn derive_message_approval(
    dwallet: &Pubkey,
    scheme_le: &[u8; 2],
    digest_chunks: &[&[u8]],
) -> (Pubkey, u8) {
    let mut seeds: Vec<&[u8]> = vec![b"dwallet", b"message_approval", scheme_le, dwallet.as_ref()];
    seeds.extend_from_slice(digest_chunks);
    Pubkey::find_program_address(&seeds, &crate::ID)
}

pub fn load_message_approval() -> MessageApproval {
    todo!()
}
