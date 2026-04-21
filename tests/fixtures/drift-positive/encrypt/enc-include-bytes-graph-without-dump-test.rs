// Should trigger: include_bytes! of a graph.bin with no dump_*_graph_bytes helper in sight.
pub const GRAPH: &[u8] = include_bytes!("../fixtures/my_graph.bin");
