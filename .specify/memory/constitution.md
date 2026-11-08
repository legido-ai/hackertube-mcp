# HackerTube MCP Constitution

This document governs all development on `hackertube-mcp`. It is the supreme
authority for process, quality, security, and governance decisions.
Specifications are the source of truth. No implementation proceeds without an
approved specification. No merge or acceptance occurs without completing the
compliance gate below.

## Core Principles

### I. Specification-Driven Delivery

- Every feature or fix starts with a written specification under `specs/`.
- The specification defines user value, acceptance criteria, scope, and
  non-goals before code is written.
- Implementation follows the approved plan and task list. Scope changes are
  recorded in the spec or plan before they are implemented.
- A completed cycle records its evidence in `verification.md`.

### II. Test-First, Hermetic Tests (NON-NEGOTIABLE)

- Every behavior change includes an automated test written before or alongside
  the implementation.
- `make test` is the canonical test command. It MUST pass with zero failures
  before any merge or acceptance.
- The default suite MUST be hermetic: no live HackerTube calls, no network, no
  credentials, no shared state.
- Live checks are separate, opt-in smoke tests and MUST be read-only.

### III. Read-Only Public Upstream

- HackerTube is a third-party public service. This project consumes its public
  JSON endpoints only.
- The server MUST NOT scrape YouTube pages, download video streams, bypass
  rate limits, or write to HackerTube.
- Requests MUST identify the client with a descriptive `User-Agent`, use a
  bounded timeout, and return a clear error when the upstream is unavailable.
- Dataset downloads are limited to the files advertised by HackerTube's own
  export manifest.

### IV. Security and Secret Hygiene

- No credentials are required for normal operation: the HackerTube API is
  public and unauthenticated.
- Secrets MUST NOT be committed, baked into images, printed in logs, or included
  in tool output. The repository MUST include a secret audit test.
- `.env.example` documents every supported environment variable with
  placeholder values. `.env` is ignored.
- The container runs as an unprivileged user, drops capabilities, and exposes
  no network port (stdio transport only).

### V. Small, Composable Surface

- Tools are thin, documented wrappers over the upstream API. Formatting is
  explicit and compact so an agent can consume results without flooding its
  context.
- Prefer the smallest dependency set that is actively maintained.
- Every tool has a stable name, a precise description, and a typed input schema.
- Failures are returned as actionable MCP tool errors, never as silent empty
  results or stack traces.

### VI. Observability Without Leakage

- Logs go to stderr and include only operational metadata: startup, upstream
  status, latency, and error class.
- Logs MUST NOT include full prompts, credentials, or complete upstream
  payloads.
- Tool responses include enough provenance (video id, HackerTube URL, HN thread
  links) for a user to verify a result.

## Compliance Gate

Before an implementation plan may proceed, verify:

- [ ] The spec defines prioritized user stories and measurable acceptance
      criteria.
- [ ] Every planned behavior has a hermetic test in `tests/`.
- [ ] `make test` runs the full suite with no failures.
- [ ] No secret, credential, or private key is present in source or images.
- [ ] The server remains read-only against HackerTube and YouTube.
- [ ] README, Makefile, and `.env.example` minimum requirements are satisfied.

Any exception MUST be documented in the plan's complexity tracking section with
justification.

## Governance

- The constitution outranks local convenience and generated defaults.
- Amendments require a documented rationale and a corresponding update to the
  spec or plan.
- The feature branch is the unit of review. No pull requests are opened for
  `legido-ai` repositories; the branch is pushed and merged only when the user
  explicitly approves the completed cycle.
