# APICaramba v1 Implementation Plan

## Purpose

This document defines an implementation sequence for v1 with explicit phase outcomes, dependencies, and exit criteria.

## Delivery Principles

- Vertical increments: each phase must produce a usable capability.
- Deterministic outputs: file generation and metadata updates must be stable.
- Validation-first save path: invalid artifacts must not be written to canonical OpenAPI files.
- Git-native behavior: all collaboration concerns are handled through standard Git workflows.

## Target Stack

- Desktop runtime: Electron
- UI: React + TypeScript
- Core domain engine: TypeScript packages, UI-agnostic
- Packaging: platform distributables for Windows and Linux (macOS best effort)

## Proposed Repository Layout (Implementation)

```text
/apps
  /desktop                 # Electron host + React renderer
/packages
  /core-model              # OpenAPI + metadata domain model
  /import-export           # Parse/import/export + round-trip logic
  /validation              # OpenAPI validators + rule adapters
  /git-adapter             # Git integration facade
  /request-execution       # HTTP execution engine
  /secrets                 # secret store abstraction + OS adapters
  /shared-types            # common types/contracts
/docs
  /adr                     # architecture decision records
```

## Phase Plan

## Phase 0: Foundation and Architecture Baseline

### Scope

- Monorepo/workspace setup for Electron + React + TypeScript
- Core package boundaries and dependency rules
- Domain model skeleton for:
  - API workspace
  - API document references
  - metadata projections (`.api-tool/*`)
- File IO abstraction and deterministic JSON writer
- CI baseline for lint, typecheck, unit tests

### Deliverables

- Buildable desktop shell with placeholder workspace screen
- Initial package structure and test runner setup
- Draft JSON schemas for `.api-tool/metadata.json`, `.api-tool/structure.json`, `.api-tool/environments.json`

### Exit Criteria

- Project builds in CI
- Unit test pipeline green
- JSON write utility is deterministic across repeated writes

## Phase 1: Core v1 Functional Slice (Editing + Validation + Execution)

### Scope

- Workspace open flow (assume local cloned repo)
- Per-API `openapi.json` load and parse
- Metadata import/rebuild behavior with fallback to root/ungrouped
- Endpoint tree + tabbed editor UX (single workspace instance)
- Save pipeline with blocking structural OpenAPI validation
- Single environment profile support
- Secure variable annotation in UI and local secret storage integration
- Request execution panel for operation-level invocation
- In-app Git status, diff preview, and commit flow (conflicts resolved via Git)

### Deliverables

- End-to-end usable v1 on Windows and Linux
- Ability to edit endpoints and save valid OpenAPI
- Ability to execute requests from operation context

### Exit Criteria

- Round-trip semantic test suite passes
- Save-blocking validation works for invalid definitions
- Manual QA scenarios for endpoint editing and execution pass

## Phase 2: Shared Resources and Team-Scale Enhancements

### Scope

- Shared schema/header management workflows
- Propagation of shared changes into consuming API OpenAPI outputs
- API-aware diff enhancements for shared changes
- Multi-environment support (`local`/`dev`/`staging`/`prod`)

### Deliverables

- Shared component authoring + impact visibility
- Multi-environment runtime selection

### Exit Criteria

- Cross-API shared update tests pass
- No regression in Phase 1 semantic round-trip tests

## Phase 3: Hardening, Packaging, and Operability

### Scope

- Performance optimization against max-scale target
- Installer/distributable hardening
- Crash diagnostics and telemetry hooks (local-first compatible)
- Documentation hardening and release process

### Deliverables

- Release candidates for Windows and Linux
- Repeatable release pipeline

### Exit Criteria

- SLA targets achieved
- Release checklist complete

## Suggested NPM Libraries

- Git integration:
  - `simple-git` (official v1 adapter; shells out to system Git)
- OpenAPI validation:
  - `@apidevtools/swagger-parser`
  - `spectral` (rules-based linting, optional strictness layer)
- HTTP execution:
  - `undici` or `axios`
- Schema validation/types:
  - `zod` or `ajv`
- Secret handling:
  - `keytar` (OS credential store integration)

## Non-Goals for v1

- Auto-update system
- Plugin marketplace / extension API
- Team secret sharing
- Always-on background daemon
