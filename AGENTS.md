# W1 Capital — Engineering and Agent Contract

This repository is the canonical source for INFINITUM CRM. PredictBot owns the agent workspace; INFINITUM owns the CRM and its operational records.

## Required work loop

1. **Define the task:** state the user outcome, affected surfaces, non-goals, acceptance criteria and risk before changing behavior.
2. **Map the code:** inspect callers, routes, data ownership, auth boundaries and existing tests. Do not infer a dependency from a filename alone.
3. **Test first:** for behavior changes, add or update a regression test before implementation. Run it to establish the failure, then implement the smallest safe change.
4. **Execute with traceability:** migrations must be additive and idempotent where possible; background work needs explicit status, retries, timestamps and a recoverable failure state.
5. **Preserve evidence:** distinguish confirmed data, inferred results and unavailable sources. Never convert a timeout, 401, 403, 429 or 5xx into “no records”.
6. **Protect data:** enforce Supabase RLS, authenticate server routes, keep service-role keys and OAuth secrets server-side, and fail closed when identity or company scope is unclear.
7. **Verify:** run `npm test`, `npm run typecheck`, `npm run test:dom`, `npm run build`, and a Docker build when the relevant surface changes. Report exactly what ran and what did not.
8. **Deliver:** summarize changed paths, migration requirements, test evidence, remaining blockers and deployment steps. Do not claim a deployment or external action succeeded without a returned confirmation.

## Product boundaries

- INFINITUM owns clients, cases, deadlines, appointments, CRM records and legal-office workflows.
- PredictBot owns agent profiles, chats, orchestration, task runs, tool approvals and the Hermes 3D control room.
- Both may use the same Supabase project, but each app must validate the authenticated user and company scope on every server-side operation.
- PredictLM is an independently licensed service. Integrate only through its authorized API; do not copy its source or credentials into this repository.
- Vercel is optional. The application must build and run as a standalone Node.js service or Docker container.

## Agent safety

- Drafting is not sending. WhatsApp, email, CRM edits, publishing, payments and legal submissions require the configured human approval gate.
- Every displayed task status must come from a persisted record or a clearly labeled local UI state.
- A failed tool call must not be represented as a completed action.
- Never expose customer records, tokens, keys, session cookies or another operator's conversation.

## References

The execution/evidence/review workflow is informed by the MIT-licensed QoderAI Better Harness project. Its tools are development-time aids, not production runtime dependencies.
