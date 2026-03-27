# APICaramba Testing Strategy and Phase Gates

## Purpose

Define test layers, mandatory validation gates, and measurable acceptance criteria so gaps are found early during phased delivery.

## Test Pyramid

- Unit tests: core model transforms, validation rules, metadata merge/rebuild logic
- Integration tests: file IO + parser + validator + Git adapter boundaries
- End-to-end tests: desktop workflows from workspace open to save/execute
- Manual exploratory QA: UX and cross-platform behavior

## Tooling (Suggested)

- Unit/integration: Vitest or Jest
- UI component tests: React Testing Library
- E2E desktop tests: Playwright (Electron mode)
- Static quality gates: ESLint + TypeScript strict mode

## Cross-Phase Quality Gates

- `lint` passes
- `typecheck` passes with no errors
- Unit test suite green
- No known data-loss bugs in open issues
- Changelog/update notes captured for new behavior

## Determinism and Round-Trip Validation

## Semantic Equivalence Contract

A save/re-export cycle must preserve:

- Path + method operation set
- Parameter meaning and location
- Request/response schema semantics
- Security scheme usage
- Server/base URL behavior

Allowed changes:

- Property ordering
- Formatting and whitespace
- Deterministic normalization/sorting

## Required Test Cases

- Import existing OpenAPI without metadata -> operations appear in root/ungrouped
- Edit + save + reload -> no semantic drift
- Repeated save with no changes -> stable output (idempotent write)
- External manual edit + reopen -> metadata rebuild succeeds without blocking

## Git Validation Matrix

- Dirty working tree detection
- Branch switch with unsaved changes warning flow
- Commit with changed `openapi.json` and `.api-tool/*`
- Pull with conflict in `openapi.json`
- Pull with conflict in `.api-tool/*`
- Post-conflict reopen and metadata rebuild

Expected behavior:

- Conflict resolution itself is done via standard Git tools
- App re-imports and reconciles after user resolves conflicts

## Phase-Specific Test Gates

## Phase 0 Gate

- Deterministic JSON writer tests pass
- Metadata schema validation tests pass
- Basic workspace boot path smoke test passes

## Phase 1 Gate

- Save-blocking validation for invalid OpenAPI verified
- Single-environment variable substitution verified
- Secure variable annotation and local secret retrieval verified
- Operation execution workflow verified (status/headers/body rendering)
- Manual QA checklist completed on Windows and Linux

## Phase 2 Gate

- Shared schema/header propagation tests pass across multiple APIs
- Multi-environment switching tests pass
- API-aware diff reflects shared resource changes correctly

## Phase 3 Gate

- Performance SLAs achieved at target scale
- Packaging/install/uninstall checks pass
- Regression suite green against release candidate

## SLA Targets (v1)

Test at target scale: up to 25 APIs/workspace and up to 100 endpoints/API.

- Workspace open to interactive tree ready: p95 <= 8s, p50 <= 4s
- Open endpoint editor tab: p95 <= 300ms, p50 <= 120ms
- Save single endpoint change (including validation + write): p95 <= 1.5s, p50 <= 700ms
- Full API validation run (100-endpoint API): p95 <= 5s, p50 <= 2.5s
- API-aware diff generation for one API: p95 <= 2s, p50 <= 1s
- Request execution result first render (network excluded): <= 150ms after response receipt
- Memory footprint steady state with target workspace: <= 1.2 GB RSS on dev-grade machine

## Manual QA Checklist (Phase 1 Minimum)

- Open cloned repo workspace
- Navigate APIs and endpoints in tree
- Open multiple tabs and switch tabs
- Create/update/delete endpoint fields
- Trigger validation failures and confirm blocking behavior
- Save valid edits and verify generated files
- Execute request with variable substitution
- Confirm secrets are not written to Git-tracked files
- Review Git diff and perform commit
