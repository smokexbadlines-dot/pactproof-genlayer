# Focused escrow and evidence review — 8 October 2026

This is an engineering review of the MVP, not an independent security audit. PACTPROOF should use faucet GEN until the open issues below are resolved and network behavior has been measured.

## Confirmed in code and direct tests

- A grant can be registered only with a positive payable reward; locked terms include the builder, deadline, evidence types, weights, and reward.
- Only the assigned builder can accept or submit; only the creator can cancel an unaccepted grant. Anyone may evaluate a submitted grant or close it after the grace period.
- Criterion weights must be positive and sum to 10,000 basis points. For a conclusive result, `builder payout + creator refund = original reward`, with rounding remainder returned to the creator.
- Evaluation requires independently retrieved evidence and matching ordered criterion statuses across validators. The archived record stores the exact retrieval windows and their deterministic hash.
- Invalid quotes and hash mismatches cannot unlock a payout in direct tests. `INCONCLUSIVE` leaves the reward locked for revision or eventual expiry refund.
- Closed grants cannot be evaluated or expired twice. Withdrawal zeroes the caller's credit before emitting one finalization-time transfer.

The nine direct-runtime tests pass with the official GenVM v0.2.12 Python SDK source. Studio's v0.2.16 runtime deployed a clean contract and finalized a full-consensus evaluation. Grant #1's 1 GEN escrow, credit, and actual builder balance transfer were independently checked on Studionet. The exact v0.2.16 direct test suite was not completed locally.

## Open production blockers

1. **Studio/Studionet funding validation.** An earlier disposable deployment showed that Studio rejected fractional `0.01` in its GEN payable field, then accepted an enormous whole-GEN value beyond the faucet account's balance. That test grant was canceled and refunded. The current clean deployment has only a correctly funded 1 GEN grant and no inflated record, but the earlier behavior still needs network-level investigation before any value-bearing network.
2. **Withdrawal failure recovery.** One successful payout was verified by native recipient balance, but `withdraw()` clears internal credit before finalization-time transfer. There is no recovery path if an external message fails after that state change. Test failed-message semantics and design recovery before meaningful escrow.
3. **Fees and liveness.** Three Studionet EVM receipts showed zero effective gas price and a fixed 8M gas-used field. Consensus-specific fees, deployment fee, worst-case evidence loads and a fee-charging network remain unprofiled. The stable SDK does not expose the v2 fee-policy methods. Integrate compatible fee-aware tooling and measure on the intended target network.
4. **Runtime and wallet compatibility.** Direct tests run GenVM v0.2.12 while the deployed source pins v0.2.16. The stable `genlayer-js@1.1.8` SDK was verified for finalized reads and Studio transactions, but app-originated MetaMask writes remain untested because its signing popup could not be controlled. The v2 release candidate called an unavailable `sim_getFeeConfig` endpoint on Studionet. Test every path on the eventual network and wallet combination.
5. **Evidence availability and model judgment.** The contract accepts URLs on three public hosts but does not require commit-pinned or content-addressed paths. Its hash detects changed bytes, after which a submission becomes inconclusive; it cannot force a host to remain available. Validator agreement on a bounded status reduces disagreement but does not prove a real-world claim beyond the retrieved text. Use precise criteria and immutable URLs; add source provenance where required.

The completed synthetic test is documented in [`LIVE_TEST_REPORT.md`](LIVE_TEST_REPORT.md). It is not a substitute for adversarial review, maximum-size evidence tests, or testing failed message delivery.
