// Must NOT trigger: scalar-only, no vector type in file.
use encrypt_solana_dsl::*;

#[encrypt_fn]
pub fn compare(a: EUint32, b: EUint32) -> EBool {
    a.is_equal(&b)
}
