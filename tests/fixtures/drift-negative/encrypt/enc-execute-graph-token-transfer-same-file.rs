// Must NOT trigger: only execute_graph, no token program reference.
pub fn run(ctx: &EncryptCtx) {
    execute_graph(ctx, &[]);
}
