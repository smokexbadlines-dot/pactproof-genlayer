"""Direct GenLayer runtime tests. Network/model I/O is mocked, consensus is not live."""
import os
import sys
import json
import hashlib
from pathlib import Path
import pytest
from gltest.direct import VMContext, deploy_contract

# gltest 0.29.2 unlinks its stdin fixture while fd 0 still references it.
# Windows disallows that; defer cleanup until the VM restores stdin.
DEFERRED_STDIN_FILES = []
if sys.platform == "win32":
    from gltest.direct import loader
    original_inject = loader._inject_message_to_fd0
    def windows_inject(vm):
        try:
            original_inject(vm)
        except PermissionError as error:
            if getattr(error, "winerror", None) != 32 or not hasattr(vm, "_original_stdin_fd"):
                raise
            DEFERRED_STDIN_FILES.append(error.filename)
    loader._inject_message_to_fd0 = windows_inject

# Optional official source checkout avoids downloading a full GenVM release.
# The default gltest SDK resolver is unchanged when this variable is absent.
if os.getenv("PACTPROOF_SDK_SOURCE"):
    from gltest.direct import sdk_loader
    source = Path(os.environ["PACTPROOF_SDK_SOURCE"]).resolve()
    def setup_paths(*args, **kwargs):
        sys.path.insert(0, str(source))
        return [source]
    sdk_loader.setup_sdk_paths = setup_paths

CONTRACT = Path(__file__).resolve().parents[1] / "contracts" / "pactproof.py"
CREATOR = bytes.fromhex("11" * 20)
BUILDER = bytes.fromhex("22" * 20)
STRANGER = bytes.fromhex("33" * 20)
DEADLINE = 1791158400  # 5 October 2026 UTC


@pytest.fixture
def context():
    vm = VMContext()
    vm.warp("2026-10-03T12:00:00Z")
    vm.sender = CREATOR
    with vm.activate():
        sdk_contracts = sys.modules.get("genlayer.gl.genvm_contracts")
        if sdk_contracts:
            sdk_contracts.__known_contract__ = None
        contract = deploy_contract(CONTRACT, vm, sdk_version=os.getenv("PACTPROOF_DIRECT_SDK_VERSION", "v0.2.12"))
        yield vm, contract
    for path in DEFERRED_STDIN_FILES[:]:
        try:
            os.unlink(path)
            DEFERRED_STDIN_FILES.remove(path)
        except PermissionError:
            pass


def terms(weights=(6000, 4000)):
    return {"title": "Documentation grant", "description": "Publish a guide and its worked example.",
            "builder": "0x" + BUILDER.hex(), "deadline": DEADLINE,
            "criteria": [{"id": "a", "text": "Publish a complete installation guide.", "weight_bps": weights[0], "evidence_type": "DOCUMENTATION"},
                         {"id": "b", "text": "Publish a complete worked example.", "weight_bps": weights[1], "evidence_type": "DOCUMENTATION"}]}


def register(vm, contract, reward=101):
    vm.value = reward
    gid = contract.create_grant(json.dumps(terms()))
    vm.value = 0
    return gid


def submit(vm, contract, gid):
    vm.sender = BUILDER
    contract.accept_grant(gid)
    body = "Complete installation guide. Worked example is incomplete."
    evidence = [{"id": "e1", "url": "https://raw.githubusercontent.com/example/repo/commit/guide.md",
                 "sha256": hashlib.sha256(body.encode()).hexdigest(), "type": "DOCUMENTATION", "criterion_ids": ["a", "b"]}]
    contract.submit_evidence(gid, json.dumps(evidence))
    vm.mock_web("raw.githubusercontent.com", {"method": "GET", "status": 200, "body": body})
    return evidence, body


def mock_rows(vm, statuses=("MET", "NOT_MET")):
    vm.mock_llm("You assess developer-grant", json.dumps({"rows": [
        {"id": cid, "status": status, "reason": "Evidence establishes the registered criterion status.",
         "citations": [] if status == "INCONCLUSIVE" else [{"evidence_id": "e1", "quote": quote}]}
        for cid, status, quote in zip(("a", "b"), statuses, ("Complete installation guide.", "Worked example is incomplete."))]}))


def test_registration_locks_terms_and_requires_funding(context):
    vm, c = context
    with vm.expect_revert("Fund"):
        c.create_grant(json.dumps(terms()))
    gid = register(vm, c)
    g = json.loads(c.get_grant(gid))
    assert g["reward_wei"] == "101" and len(g["terms_hash"]) == 64
    assert g["state"] == "OPEN"
    assert json.loads(c.list_grants(0, 50))[0]["id"] == gid


def test_wrong_caller_cannot_accept_or_submit(context):
    vm, c = context
    gid = register(vm, c)
    vm.sender = STRANGER
    with vm.expect_revert("Only assigned"):
        c.accept_grant(gid)
    with vm.expect_revert("Only builder"):
        c.submit_evidence(gid, "[]")


def test_partial_payment_conserves_escrow_and_cannot_repeat(context):
    vm, c = context
    gid = register(vm, c)
    submit(vm, c, gid)
    mock_rows(vm)
    vm.sender = STRANGER  # Evaluation is permissionless.
    c.evaluate(gid)
    assert vm.run_validator()
    g = json.loads(c.get_grant(gid))
    assert g["outcome"] == "PARTIALLY_MET" and g["state"] == "CLOSED"
    assert int(g["payout_wei"]) == 60 and int(g["refund_wei"]) == 41
    assert c.get_credit("0x" + BUILDER.hex()) == "60"
    assert c.get_credit("0x" + CREATOR.hex()) == "41"
    with vm.expect_revert("No pending"):
        c.evaluate(gid)
    with vm.expect_revert("Already closed"):
        c.close_expired(gid)


def test_validator_rejects_changed_evidence_and_different_status(context):
    vm, c = context
    gid = register(vm, c)
    submit(vm, c, gid)
    mock_rows(vm)
    c.evaluate(gid)
    assert vm.run_validator()
    original = vm._captured_validators[-1][0]
    altered = json.loads(json.dumps(original))
    altered["rows"][1]["status"] = "MET"
    assert not vm.run_validator(leader_result=altered)
    vm.clear_mocks()
    vm.mock_web("raw.githubusercontent.com", {"method": "GET", "status": 200, "body": "Changed evidence"})
    assert not vm.run_validator()


def test_withdrawal_only_spends_callers_credit_once(context):
    vm, c = context
    gid = register(vm, c)
    c.cancel_unaccepted(gid)
    vm.sender = STRANGER
    with vm.expect_revert("No available"):
        c.withdraw()
    messages = []
    def capture(vm_context, request):
        if "EthSend" in request:
            messages.append(request["EthSend"])
            return {"ok": None}
    vm._gl_call_hook = capture
    vm.sender = CREATOR
    c.withdraw()
    assert c.get_credit("0x" + CREATOR.hex()) == "0"
    assert len(messages) == 1 and messages[0]["value"] == 101
    assert messages[0]["address"].as_bytes == CREATOR
    with vm.expect_revert("No available"):
        c.withdraw()


def test_hash_mismatch_is_inconclusive_and_preserves_funds(context):
    vm, c = context
    gid = register(vm, c)
    submit(vm, c, gid)
    vm.clear_mocks()
    vm.mock_web("raw.githubusercontent.com", {"method": "GET", "status": 200, "body": "Changed content"})
    c.evaluate(gid)
    assert vm.run_validator()
    g = json.loads(c.get_grant(gid))
    assert g["state"] == "REVISION" and g["outcome"] == "INCONCLUSIVE"
    assert c.get_credit("0x" + BUILDER.hex()) == "0"
    assert c.get_credit("0x" + CREATOR.hex()) == "0"
    record = json.loads(c.get_record(g["latest_record"]))
    assert record["windows"][0]["retrieval"] == "HASH_MISMATCH"
    assert len(record["evidence_window_hash"]) == 64


def test_invalid_quotes_cannot_unlock_payment(context):
    vm, c = context
    gid = register(vm, c)
    submit(vm, c, gid)
    rows = [{"id": cid, "status": "MET", "reason": "Claim", "citations": [{"evidence_id": "e1", "quote": "A fabricated quote"}]} for cid in ("a", "b")]
    vm.mock_llm("You assess", json.dumps({"rows": rows}))
    c.evaluate(gid)
    assert json.loads(c.get_grant(gid))["outcome"] == "INCONCLUSIVE"


def test_creator_cannot_cancel_accepted_work_and_expiry_refunds(context):
    vm, c = context
    gid = register(vm, c)
    vm.sender = BUILDER
    c.accept_grant(gid)
    vm.sender = CREATOR
    with vm.expect_revert("Accepted"):
        c.cancel_unaccepted(gid)
    with vm.expect_revert("window"):
        c.close_expired(gid)
    vm.warp("2026-10-13T12:00:00Z")
    vm.sender = STRANGER
    c.close_expired(gid)
    assert c.get_credit("0x" + CREATOR.hex()) == "101"


def test_rejects_invalid_weights_and_private_evidence_hosts(context):
    vm, c = context
    vm.value = 101
    with vm.expect_revert("Weights"):
        c.create_grant(json.dumps(terms((5000, 4999))))
    gid = register(vm, c)
    vm.sender = BUILDER
    c.accept_grant(gid)
    item = {"id": "e", "url": "https://127.0.0.1/secrets", "sha256": "a" * 64, "type": "DOCUMENTATION", "criterion_ids": ["a", "b"]}
    with vm.expect_revert("allowed public"):
        c.submit_evidence(gid, json.dumps([item]))
