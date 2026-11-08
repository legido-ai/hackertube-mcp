# Tasks: HackerTube MCP Server

**Input**: Design documents from `/specs/001-hackertube-mcp/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`,
`contracts/tools.md`

**Tests**: Required by the constitution. Every story includes hermetic tests.

## Phase 1: Setup

- [x] T001 Create the Node.js 24 ESM project manifest and lockfile in `package.json` / `package-lock.json`.
- [x] T002 Add `.env.example`, `.dockerignore`, and `.gitignore` entries for local data and secrets.
- [x] T003 Replace the template Makefile with `test`, `lint`, `docker`, `run`, and `smoke` targets.
- [x] T004 Replace the template CI workflows with Node 24 tests and a multi-arch Docker build.

## Phase 2: Foundational

- [x] T005 Implement environment parsing and validation in `src/config.js`.
- [x] T006 [P] Implement compact video/comment/playlist projections in `src/format.js`.
- [x] T007 Implement the typed HackerTube HTTP client and dataset download allowlist in `src/client.js`.
- [x] T008 Implement the stdio entry point and stderr-only startup logging in `src/index.js`.

## Phase 3: User Story 1 - Semantic search (P1)

**Goal**: An agent can search the curated corpus in natural language.

**Independent Test**: Call `hackertube_search` with a stub client and verify
compact results, filters, `weak`, and limit truncation.

- [x] T009 [P] [US1] Add search client tests in `tests/client.test.js`.
- [x] T010 [US1] Implement `HackerTubeClient.search` with filter mapping and normalization.
- [x] T011 [US1] Register `hackertube_search` in `src/server.js` with typed input schema.
- [x] T012 [US1] Add search tool tests in `tests/tools.test.js`.

## Phase 4: User Story 2 - Video and HN evidence (P2)

**Goal**: An agent can inspect one video and its HN provenance.

**Independent Test**: Call `hackertube_video` for a valid id and verify metadata,
HN stats, bounded comments, and HN links.

- [x] T013 [P] [US2] Add video client tests for valid/invalid ids and 404 in `tests/client.test.js`.
- [x] T014 [US2] Implement `HackerTubeClient.video` with id validation and comment bounding.
- [x] T015 [US2] Register `hackertube_video` in `src/server.js`.
- [x] T016 [US2] Add video tool tests in `tests/tools.test.js`.

## Phase 5: User Story 3 - Discovery (P3)

**Goal**: An agent can explore related videos, topics, playlists, feed, and stats.

**Independent Test**: Call each discovery tool with a stub client and verify
shape and truncation.

- [x] T017 [P] [US3] Add related/browse/playlists/feed/stats client tests in `tests/client.test.js`.
- [x] T018 [US3] Implement the discovery methods in `src/client.js`.
- [x] T019 [US3] Register `hackertube_related`, `hackertube_browse`, `hackertube_playlists`, `hackertube_playlist`, `hackertube_feed`, and `hackertube_stats` in `src/server.js`.
- [x] T020 [US3] Add discovery tool tests in `tests/tools.test.js`.

## Phase 6: User Story 4 - Dataset (P4)

**Goal**: An agent can inspect and download advertised dataset files safely.

**Independent Test**: Call the manifest and download tools with a stub client;
verify traversal and non-advertised names are rejected.

- [x] T021 [P] [US4] Add manifest/download allowlist tests in `tests/client.test.js`.
- [x] T022 [US4] Implement `HackerTubeClient.dataset` and `downloadDataset`.
- [x] T023 [US4] Register `hackertube_dataset` and `hackertube_dataset_download` in `src/server.js`.
- [x] T024 [US4] Add dataset tool tests in `tests/tools.test.js`.

## Phase 7: User Story 5 - Container and integration (P5)

**Goal**: The server builds, starts, and lists all tools over stdio.

**Independent Test**: Build the image and run an MCP handshake that calls
`hackertube_stats` or `hackertube_search`.

- [x] T025 [P] [US5] Write the Dockerfile and `.dockerignore`.
- [x] T026 [US5] Add an in-memory MCP handshake test that lists all tools in `tests/tools.test.js`.
- [x] T027 [US5] Add a live smoke script (`scripts/smoke.js`) and `make smoke`.
- [x] T028 [US5] Build the image and verify the stdio handshake.

## Phase 8: Documentation and Verification

- [x] T029 Write `README.md` with tools, quickstart, architecture, security, and limits.
- [x] T030 Write `CHANGELOG.md` and `specs/001-hackertube-mcp/verification.md`.
- [x] T031 Run `make test`, `make lint`, and `make docker`; record results.
- [x] T032 Run the secret audit and review `git diff` for accidental data.
- [x] T033 Commit and push `001-hackertube-mcp`; verify the remote SHA.
