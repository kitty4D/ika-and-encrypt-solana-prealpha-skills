// Fixture: MessageApproval-adjacent code uses find_program_address without the
// canonical chunked seed layout.
use solana_program::pubkey::Pubkey;

pub fn derive_message_approval(dwallet: &Pubkey, digest: &[u8]) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"dwallet", dwallet.as_ref(), digest], &crate::ID)
}

pub fn load_message_approval() -> MessageApproval {
    todo!()
}
