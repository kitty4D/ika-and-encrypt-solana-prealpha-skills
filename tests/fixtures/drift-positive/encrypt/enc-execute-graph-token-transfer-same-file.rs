// Should trigger: execute_graph and spl_token transfer in the same file.
use spl_token::instruction as token;

pub fn run_and_pay(ctx: &EncryptCtx) {
    execute_graph(ctx, &[]);
    token::transfer(&[], &[], &[], &[], 1).unwrap();
}
