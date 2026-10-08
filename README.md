# PACTPROOF

**Proof before payment.** A GenLayer-native developer-grant protocol: funders preregister acceptance criteria and GEN rewards; builders publish evidence; validators independently retrieve and assess it; deterministic code allocates payouts.

## Included

- Python Intelligent Contract with payable registration, immutable criteria, assigned-builder acceptance, typed evidence manifests, independently retrieved evidence and custom validator equivalence.
- React + TypeScript app: grant board, registration form, evidence form, criterion verdicts, JSON archive exports, balances, expiry and cancellation controls.
- Browser-wallet integration using the stable `genlayer-js@1.1.8` for Studionet, EIP-6963 MetaMask discovery with injected-provider fallback, finalized-state reads, native GEN amounts, execution-success checks, persistent transaction tracking and an appeal action for pending decisions.
- A clearly labeled browser-local demonstration. Demo grants and simulated verdicts never represent validator decisions or real funds.
- Deployment script and contract/domain tests.

**Live Studionet deployment:** `0xC6AE9b4AA319dfDd1486A846DfEb5fc4012dD918` ([explorer](https://explorer-studio.genlayer.com/address/0xC6AE9b4AA319dfDd1486A846DfEb5fc4012dD918)). A clean, synthetic 1 GEN grant completed full-consensus evaluation and payout; see [`LIVE_TEST_REPORT.md`](LIVE_TEST_REPORT.md). Use faucet tokens only.

## Run locally

Requires Node 22+ and pnpm 11 (or npm).

```sh
pnpm install
pnpm dev
```

Copy `.env.example` to `.env` to default local development to the deployed Studionet contract, then open the printed local URL in the Chrome profile where MetaMask is installed and unlocked. The production build already has the public Studionet address in `.env.production`. The app opens in GenLayer mode. **Connect wallet** requests your public account; signed writes require MetaMask approval. The app prefers MetaMask's EIP-6963 announcement when more than one wallet is installed. If no wallet is detected, finish MetaMask setup, allow it on the local site, and reload. Choose **Demo workspace** from the mode selector to explore seeded examples without a contract. Use **Builder view / Funder view** to switch the two demo identities. Evidence hashes are required in both modes; the demo does not retrieve evidence or contact validators. Select a local UTF-8 file in the evidence form to hash its bytes; this does not upload it.

```sh
pnpm build
pnpm test
python -m pip install -r requirements-dev.txt
python -m pytest tests/test_contract.py -q
```

The contract pins Studio's GenVM v0.2.16 runner. Contract tests use the official `gltest.direct` runtime against available GenVM SDK v0.2.12 source and mocked web/model responses; they do not replace a v0.2.16 network test. The runtime may download the corresponding GenVM SDK release on first run. Python 3.12+ is required. Alternatively, point `PACTPROOF_SDK_SOURCE` at `runners/genlayer-py-std/src` in an official GenVM v0.2.12 checkout. Tests include a Windows adaptation for the runtime's temporary stdin cleanup.

## Connect to GenLayer

1. Copy `.env.example` to `.env`.
2. Select `studionet` or `localnet`; use the matching GenLayer network and SDK release. The app pins the stable SDK because the v2 release candidate calls a fee-policy method unavailable on stable Studionet. Studio-dev is a separate network and is not interchangeable with stable Studio.
3. Use the existing Studionet deployment recorded in `studio-deployment.json`, deploy a separate instance of `contracts/pactproof.py` in [GenLayer Studio](https://studio.genlayer.com), or set `GENLAYER_PRIVATE_KEY` to a funded development account and run `pnpm deploy:contract`.
4. In the app, choose **GenLayer network**, select the matching network, and paste the finalized deployment address. The app verifies that it is a PACTPROOF contract before loading its finalized grants. Connect or reconnect MetaMask to the chosen GenLayer network before submitting transactions. You can still set `VITE_CONTRACT_ADDRESS` in `.env` as a default connection; the in-app setting takes precedence.

Never put a private key in a `VITE_` variable. The browser only requests signatures from its wallet. The deployment script saves its transaction ID in ignored `deployment.json` before waiting, and resumes that ID on subsequent runs. It does not automatically submit duplicate deployments after a timeout.

The stable SDK submits transactions using the fee behavior of the selected Studionet backend. Before fee-charging testnet or production deployment, measure deployment, evidence-evaluation and withdrawal-message consumption on the actual target network and integrate a compatible fee-aware SDK and measured profile. The v2 release candidate's `sim_getFeeConfig` request is unavailable on this stable Studionet backend; do not mix those deployments.

## Grant lifecycle

`OPEN → ACTIVE → SUBMITTED → CLOSED`

An inconclusive assessment instead enters `REVISION`, allowing a new submission before the deadline, up to three attempts. A conclusive partial result is terminal: it closes the grant and returns unearned funding. Each grant represents one funded milestone; create separate grants for separate milestones.

The creator can cancel only before the builder accepts. After deadline plus seven days, anyone can close a grant that is still open and return all escrow to the creator. Closed grants retain their terms, submissions and evaluation records.

## Deterministic payment policy

Criteria have positive basis-point weights totaling 10,000. The model never chooses a payment amount.

| Criterion results | Grant outcome | Allocation |
| --- | --- | --- |
| All met | MET | Full reward to builder |
| Some met, remaining not met | PARTIALLY_MET | Reward × met weights ÷ 10,000, rounded down |
| All not met | NOT_MET | Full reward returned to creator |
| Any inconclusive | INCONCLUSIVE | No credits; entire reward remains in escrow |

On a conclusive decision, deterministic code credits the builder and creator. Each withdraws their own credits; the external EOA transfer is emitted at GenLayer finalization. This app reads only finalized state. No application boolean or manually entered transaction hash is used as proof of finality.

## Evidence representation and consensus

Each submission contains 1–6 public HTTPS files on `raw.githubusercontent.com`, `arweave.net`, or `ipfs.io`. Use commit-pinned raw GitHub URLs or content-addressed files. Evidence types: SOURCE_CODE, DOCUMENTATION, TEST_REPORT. Every criterion requires evidence of its preregistered type. Files must be UTF-8, at most 12,000 bytes, and match the manifest's full-file SHA-256.

Leader and validators fetch independently. The custom validator checks exact equality of retrieved windows, including bytes represented as decoded UTF-8 text, URL, type, assignments, observed hash and retrieval status. Each validator performs its own model assessment and requires the same ordered criterion IDs/statuses. Rationale wording may differ; accepted leader rationale must have bounded structure and exact quotes from the appropriate evidence. Invalid model responses and unavailable evidence fall back to inconclusive criteria.

Each evaluation archives terms hash, manifest hash, exact windows, window hash, rows, derived outcome and evaluation timestamp. Hashes use SHA-256 of sorted-key, compact JSON encoded as UTF-8. A hash commits to a representation, not to the truth or long-term availability of the source. Exact windows are included in exports, so they remain inspectable from contract state even if the source later changes.

Public file contents and criterion text are treated as untrusted prompt data. Prompt-injection instructions are explicitly excluded. Quotes and status matching constrain the result but do not eliminate model error or adversarial evidence.

## Contract methods

| Method | Caller / behavior |
| --- | --- |
| `create_grant(terms_json)` payable | Funder deposits the full native GEN reward |
| `accept_grant(id)` | Only assigned builder |
| `submit_evidence(id, manifest_json)` | Only assigned builder, before deadline |
| `evaluate(id)` | Anyone; independently retrieved evidence and consensus |
| `cancel_unaccepted(id)` | Only creator; OPEN grants only |
| `close_expired(id)` | Anyone after evaluation grace period |
| `withdraw()` | Caller’s available credits, zeroed before transfer emission |
| `get_grant`, `list_grants`, `get_count` | Public views; pagination bounded to 50 |
| `get_record`, `get_credit` | Public audit and balance views |

## Development limits

This is an MVP, not an audited production escrow. The clean deployment's narrow full-consensus Studionet test and actual recipient balance delivery were verified; appeals, failed external-message recovery, worst-case evidence and fee-charging network costs were not. Direct tests still use mocks. An earlier disposable Studio deployment accepted an oversized test deposit beyond the faucet account's original balance; that network/Studio funding anomaly remains a production blocker, though it is absent from the clean deployment. Before real funds: audit lifecycle/accounting, measure fees, test wallet-originated writes and wallet/network changes, appeal recomputation, and failed-transfer recovery.

See [`LIVE_TEST_REPORT.md`](LIVE_TEST_REPORT.md) for actual Studionet transactions and [`SECURITY_REVIEW.md`](SECURITY_REVIEW.md) for the focused escrow review and production blockers.

The MVP assesses text artifacts; it does not execute submitted source, run CI, authenticate test reporters, analyze PDF/video evidence or establish source provenance. Register criteria requiring independently inspectable execution evidence when making runtime claims. Source-code assertions alone should be inconclusive for runtime behavior.

## Official references

- [GenLayer contract storage](https://docs.genlayer.com/developers/intelligent-contracts/features/storage)
- [Custom equivalence principles](https://docs.genlayer.com/developers/intelligent-contracts/equivalence-principle)
- [Native GEN transfers](https://docs.genlayer.com/developers/intelligent-contracts/features/value-transfers)
- [Transaction context](https://docs.genlayer.com/developers/intelligent-contracts/features/transaction-context)
- [GenLayerJS lifecycle and wallet integration](https://docs.genlayer.com/api-references/genlayer-js)
- [Direct-mode contract tests](https://docs.genlayer.com/api-references/genlayer-test/direct)
