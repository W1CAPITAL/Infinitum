# Agent work loop and evidence contract

This engineering process adopts the useful Better Harness pattern from QoderAI: make the task explicit, keep execution observable, verify changes independently, and preserve evidence for review.

## Lifecycle

```text
request
  -> task contract
  -> code/data map
  -> plan + acceptance criteria
  -> implementation
  -> independent review
  -> tests + build
  -> evidence summary
  -> release / rollback decision
```

## Evidence rules

| State | Meaning |
| --- | --- |
| queued | Persisted task is waiting for a worker |
| running | A worker has started and has a timestamp |
| waiting_approval | A human decision is required; no external write has happened |
| succeeded | The action returned a verifiable success result |
| failed | The action returned an error or timed out |
| canceled | An authorized operator canceled the task |

A chat response is not proof that a tool executed. A generated draft is not proof that it was sent. A provider timeout is not proof that a record does not exist.

## Review gates

- Scope and permissions are checked before a tool call.
- External writes are separated from read-only tools.
- High-impact actions require explicit human approval.
- Retries must be bounded and idempotent; do not repeat a send because its acknowledgement was lost.
- Logs must omit credentials and sensitive payloads.
- The final report names tests actually run and explicitly lists unverified items.

## QoderAI reuse boundary

- Source inspiration: [QoderAI/better-harness](https://github.com/QoderAI/better-harness).
- The harness is a development workflow, not a production agent runtime.
- Qoder Action and Qoder Agent SDK are optional integrations and are not required to run INFINITUM.
- No Qoder token, paid provider, browser extension or Qoder service is required by the application.
