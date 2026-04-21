// Should trigger: vector type + is_equal(&...) on a runtime ciphertext reference.
use encrypt_solana_dsl::*;

#[encrypt_fn]
pub fn compare(vec: EUint32Vector, scalar: EUint32) -> EBool {
    vec.is_equal(&scalar)
}
