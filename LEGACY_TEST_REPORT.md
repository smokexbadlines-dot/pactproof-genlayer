# Studionet integration report — 7 October 2026

This is a synthetic faucet-token test of PACTPROOF. The builder did not author the referenced GenLayer source. The claim only asserts that a pinned source file declares a Storage Intelligent Contract subclass.

## Setup

| Field | Observed value |
| --- | --- |
| Network | GenLayer Studionet, chain ID 61999 |
| Contract | `0x3b11E564247e517AA880902b00dDE5f11aAC9f0b` |
| Execution | Studio **Normal (Full Consensus)** |
| Creator test account | `0x15f03a35A83B4eC4bC19773851D0b436DE01CCf6` |
| Builder test account | `0x7B5cFF43D9b7bbc6F859bE8F28cfb385c1Ee68f2` |
| Grant | #2, `Studionet evidence integration test` |
| Reward | 1 faucet GEN (`1000000000000000000` wei) |
| Criterion | `The pinned source file declares a Storage intelligent contract subclass.` |
| Evidence type / weight | `SOURCE_CODE` / 10,000 basis points |
| Evidence URL | `https://raw.githubusercontent.com/genlayerlabs/genlayer-studio/c94072951e483510329670aa427fba3fa6944f45/examples/contracts/storage.py` |
| Manifest full-file SHA-256 | `c19ffb3e0c623705639dcb4f33a507cefb918655e7943cc8bf8f0d649282fb4b` |

## Finalized transactions

| Action | Transaction ID |
| --- | --- |
| Deploy contract | `0xf104526246a7dbd42e0ce6d53084f46787c3334cbd2a25e4f1c706b6c10867f9` |
| Create grant #2 with 1 GEN | `0x0bd7070853d527d12b9680c0439e650d4bfd754556c9abde0446f42d11fad2bf` |
| Builder accepts | `0x3d6f1238f3b60039bb88aada8df33249e725a3047ad17cdc97278781ed367580` |
| Submit manifest | `0x0f4e268db0d1732424ca22dbf340a36b19f8ea1d962c208ecd50283914ca80da` |
| Evaluate under full consensus | `0x80645aa11c0d0936f88b71d588e427b72267bed5a209ba62cfbb6490443f1cff` |
| Builder withdraws | `0x31aa6f3188efaf4cf35d876901aca3ecb47b94b86a6eacdb508a4b9a47fbe481` |

Record `2:1` has outcome `MET`, `earned_bps=10000`, and a `VERIFIED` window whose observed SHA-256 equals the manifest. Its citation is `class Storage(gl.contract.Contract):`. The onchain `evidence_window_hash` and independently recomputed SHA-256 of its canonical window array are both `25ed70ef242d054937c67202552efcf4046d211a68c4c9d91cc2bc6058067eef`. Terms hash: `79199609c52bf8ba01b890b6e002082bd32d1527d350129d1ba5089d26d662c2`; submission hash: `05a591c4aa5e005d4227451108103c7cde78cbee7b68e90e94e760bbf98d9e2c`.

The contract held 1 GEN immediately after funding. After evaluation, builder credit and contract balance were both 1 GEN. After withdrawal, builder balance changed from 10 to 11 GEN; contract balance, outstanding credits, and locked value were all zero. The withdrawal EVM receipt said `success` and the GenLayer transaction was `FINALIZED` with majority-agree result 6.

Studionet reported `effectiveGasPrice=0` wei and `gasUsed=8000000` for creation, evaluation and withdrawal. These are Studio EVM receipt observations only; consensus-specific fees and fee-charging network costs are not measured.

## Earlier Studio funding anomaly

Studio labeled its payable input `Value (GEN)` and rejected a fractional `0.01` via a BigInt conversion error. Entering `1000000000000000` as a workaround instead represented that many whole GEN. Studionet accepted grant #1 with `1000000000000000000000000000000000` wei despite the creator test account holding only 10 faucet GEN. This is an unresolved Studio/Studionet balance-validation anomaly. No real funds were involved. The unaccepted grant was canceled (`0x2d2b435b68644efc243f211ccbb12aa1af011ac41a4d7c6aa80cec4948f32be3`) and the creator withdrew the full refund (`0x6b3b479b0ed5789c5da041ceeb2802145a45b0df9f5ecbbd00eea8ed2e0e375f`). Grant #1 remains as a closed public record and causes an inflated historical funding total in the UI.

The MetaMask public account connected to the Chrome app, but the wallet extension's signing popup cannot be controlled by the available browser interface. The live write sequence therefore used Studio test accounts. Do not infer that Chrome/MetaMask app-originated writes were tested.

Reproduce reads with `node scripts/verify-deployment.mjs studionet <address> <deployment-tx>`, `node scripts/audit-record.mjs studionet <address> 2:1`, `node scripts/audit-escrow.mjs studionet <address>`, and `node scripts/audit-transactions.mjs studionet <tx...>`.
