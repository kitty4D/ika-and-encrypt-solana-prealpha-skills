# Performance Caveats (community field-tested)

**Source:** Building on Encrypt pre-alpha (April 2026), confirmed with Encrypt team.

---

## Pre-alpha executor runs NO real FHE

All computation in the pre-alpha executor is **plaintext**. The ~3–5 s you observe on devnet for graph commits is mock overhead (gRPC round-trip, on-chain TX confirmation), not FHE evaluation time.

Do not use devnet timings to estimate production performance.

## REFHE vs TFHE

Encrypt uses **REFHE** (Ring-based Fully Homomorphic Encryption), not TFHE (the scheme used by Zama/fhEVM). Key theoretical differences:

| property | REFHE (Encrypt) | TFHE (Zama) |
| --- | --- | --- |
| Primitive | RLWE polynomial rings | LWE lattice |
| SIMD | Native — one bootstrap processes all polynomial slots in parallel | Per-element sequential (or batched via packing) |
| Vector ops | Theoretically O(1) per bootstrap cycle (same cost as scalar) | O(N) or requires explicit SIMD packing |
| Bootstrap cost | Unknown (no production benchmarks) | ~10–50 ms on GPU (Zama Concrete, 2025 benchmarks) |

REFHE's theoretical advantage is SIMD parallelism across polynomial ring slots — a 256-element vector operation costs the same wall-clock time as a scalar operation if the executor properly exploits the ring structure.

**This is unverified.** The mock executor cannot distinguish O(1) SIMD from O(N) sequential. Both produce identical digests.

## Bootstrap cost is the dominant unknown

Everything in FHE computation reduces to bootstrap cycles. The number of bootstraps in a graph is deterministic (comparisons, multiplications, and gathers each require one; additions, subtractions, and selects are free/leveled). The cost per bootstrap is not.

| scenario | per-bootstrap | 12-bootstrap graph | notes |
| --- | --- | --- | --- |
| Academic REFHE papers (CPU-only) | ~2 s | ~24 s | Basis for most public estimates |
| GPU-accelerated (production target) | unknown | unknown | Encrypt confirmed CPU+GPU from launch |
| Optimistic (GPU pipelining) | <100 ms | <1.2 s | Plausible but unverified |
| Pessimistic (unoptimized) | 10–15 s | 120–180 s | Would make complex graphs impractical |

Production executor will use **CPU + GPU** from day one — not CPU-first then GPU-upgraded later. This means CPU-only paper numbers are a lower bound, not a prediction.

## What to tell users / stakeholders

- Frame throughput as "architecture-ready, waiting on executor benchmarks" — not specific epoch times.
- Any timing number you see in the wild (8 s per graph, 2 s per bootstrap) comes from unverified theoretical estimates, not measured production performance.
- The mock executor provides zero timing signal — it processes digests, not RLWE polynomials.

## Open questions for the Encrypt team

These cannot be self-verified against the pre-alpha mock:

| question | why it matters |
| --- | --- |
| Is vector SIMD truly O(1) per bootstrap? | Determines whether vector types are viable for production programs or just syntactic sugar over sequential ops |
| Does `gather` with encrypted indices work in production RLWE? | Permuting polynomial slots by encrypted offsets works in mock but is unverified in real RLWE |
| Milliseconds per bootstrap cycle on production hardware? | Determines whether complex graphs complete in seconds or minutes |
| Can independent graphs run on different cluster nodes? | Sequential execution across independent graphs is a bottleneck for multi-graph programs |
| Division semantics — what happens on divide-by-zero? | Need to know if executor crashes or returns a defined value |
