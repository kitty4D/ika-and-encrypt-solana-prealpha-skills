// Must NOT trigger: paired with a dump_*_graph_bytes test in the same file.
pub const GRAPH: &[u8] = include_bytes!("../fixtures/my_graph.bin");

#[cfg(test)]
fn dump_my_graph_bytes() {
    // regenerate the bin at test time so the committed file is never silently stale.
}
