# Clean Studionet integration report — 8 October 2026

This is a synthetic, faucet-token demonstration of PACTPROOF. The assigned builder is a Studio test account and did not author the source file. The criterion tests only the presence of a `Storage` Intelligent Contract subclass in a pinned source file; it does not claim that the builder produced software.

| Field | Verified value |
| --- | --- |
| Network | GenLayer Studionet, chain ID 61999 |
| Contract | `0xC6AE9b4AA319dfDd1486A846DfEb5fc4012dD918` |
| Execution | Studio Normal (Full Consensus) |
| Creator | `0x93968362408833630848b47c6FA1C8920191BCdE` |
| Assigned builder | `0x7B5cFF43D9b7bbc6F859bE8F28cfb385c1Ee68f2` |
| Grant | #1, 1 faucet GEN (`1000000000000000000` wei) |
| Evidence | Commit-pinned [`storage.py`](https://raw.githubusercontent.com/genlayerlabs/genlayer-studio/c94072951e483510329670aa427fba3fa6944f45/examples/contracts/storage.py), `SOURCE_CODE` |
| Full-file SHA-256 | `c19ffb3e0c623705639dcb4f33a507cefb918655e7943cc8bf8f0d649282fb4b` |

All six transactions finalized successfully:

| Action | Transaction ID |
| --- | --- |
| Deploy | `0xc0c7e22fd72b63535f0cc1d11b6a3686e210c6a1080ed3a66b95781f6932279a` |
| Fund grant #1 | `0x7e44b2d85488cfe4d4fff396a18d2bdc863707c03e59c3ce677da1c78871839e` |
| Builder accepts | `0xde4b695f2f25b62979d52be2f7d4bb2fbe6b3159abab51b70d14d859ae53bf56` |
| Submit typed manifest | `0xaf9c203023109d604b7ffdcf9f7b64ac07f1b8322b182f28dfa7f1857685ef71` |
| Evaluate with validators | `0xba329150fcfd4da396d1bc68016001ad9d5ee4c0dac495ec67b1876f525a16f3` |
| Builder withdraws | `0xfd63ca95f910abda4814df245166228e03ba113264c3ea6a087041932266fee2` |

The evaluation receipt showed validator agreement. Public record `1:1` is `MET`, with 10,000 earned basis points, a `VERIFIED` retrieval, the exact quote `class Storage(gl.contract.Contract):`, and a matching observed file SHA-256. Independently hashing the archived canonical evidence-window array produced `25ed70ef242d054937c67202552efcf4046d211a68c4c9d91cc2bc6058067eef`, identical to the onchain `evidence_window_hash`. The terms hash is `74869803d8c8f24e31377d015f164700b63958aed654fb60321429c4135efa47`; the submission hash is `05a591c4aa5e005d4227451108103c7cde78cbee7b68e90e94e760bbf98d9e2c`.

After funding, contract balance was exactly 1 GEN. Evaluation closed the grant with 1 GEN builder credit and no creator refund. After withdrawal, the builder's faucet balance rose from 11 to 12 GEN; contract balance, locked value, and all credits were zero. The sampled funding, evaluation and withdrawal EVM receipts each reported `status=success`, `gasUsed=8000000`, and `effectiveGasPrice=0`. These Studio observations do not establish fees or failed-message behavior on another network.

Reproduce the read checks with `node scripts/verify-deployment.mjs studionet <address> <deploy-tx>`, `node scripts/audit-record.mjs studionet <address> 1:1`, `node scripts/audit-escrow.mjs studionet <address>`, and `node scripts/audit-transactions.mjs studionet <tx...>`.

An earlier disposable Studio deployment had a payable-input anomaly and a separate successful full-consensus test. Its history is retained in [`LEGACY_TEST_REPORT.md`](LEGACY_TEST_REPORT.md); this clean deployment has only the 1 GEN grant above. The MetaMask account connected to the browser app for reads, but app-originated signed writes were not verified because its extension confirmation was unavailable to the browser-control interface. The full live write path above used Studio test accounts.
