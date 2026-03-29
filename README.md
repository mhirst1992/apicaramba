<p align="center">
  <img src="apps/desktop/resources/wordmark.svg" alt="api:caramba — > {api:caramba}" width="420" />
</p>

<p align="center">
  <strong>Git-native API management. Your definitions, your machine, your workflow.</strong>
</p>

<p align="center">
  API definitions live in Git. Secrets stay off the network. The tool gets out of your way.
</p>

<br />

---

## What is it?

api:caramba is a local-first desktop application for authoring and managing OpenAPI 3.x definitions. It pairs a structured editor with a built-in request runner, wrapping everything in the Git workflow you already use.

No cloud account. No sync fees. No lock-in.

- **Local-first** — fully functional offline; all state lives in your repository
- **Git-native** — workspaces are Git repositories; branch, commit, and diff as normal
- **OpenAPI 3.x** — canonical format ensures compatibility with any external tooling
- **Structured editor** — folder-organised endpoint tree with inline schema management
- **Run view** — execute requests directly from the operation context, with a mini JSON editor pre-populated from the request schema

---

## Current Status

Phase 1 is well underway. The editor and run view are functional for day-to-day API work.

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 0 | ✅ Complete | Monorepo scaffold, domain types, deterministic JSON writer, desktop shell |
| Phase 1 | 🔄 In progress | Editing, validation, request execution, Git UI, environments, secrets |
| Phase 2 | 🔜 Planned | Shared resource management, multi-environment support |
| Phase 3 | 🔜 Planned | Packaging, installers, hardening, release pipeline |

### Phase 1 — What's done

- **Workspace** — create or open a local Git repository as a workspace; recent workspaces remembered
- **API management** — create multiple APIs per workspace, each backed by its own `openapi.json`
- **OpenAPI import** — discover and parse OpenAPI documents from any `.json` or `.yaml` file in the repo
- **Endpoint tree** — folder-organised sidebar with drag-and-drop reordering; folders support inline rename and delete
- **Operation editor** — edit method, path, summary, tags, and request/response schema assignments inline
- **Schema editor** — create and manage named schemas with property definitions and usage tagging (Request / Response / Both)
- **Save pipeline** — writes back to the canonical `openapi.json` on every save; new operations and schema changes are round-tripped correctly
- **Run view** — execute operations with a full request builder: URL, headers, method, and a syntax-highlighted JSON body editor with live validation, line numbers, and schema-driven body prefill
- **Environment profile** — single environment config with base URL and variable support
- **Brand & UX** — frameless window, custom title bar, themed scrollbars, and method colour coding

### Phase 1 — What's remaining

- Save-blocking OpenAPI structural validation (validation package is in place; UI gate pending)
- Secure variable annotation and OS credential store integration (`keytar`)
- In-app Git panel: status, diff preview, and commit flow

---

## Tech Stack

| Concern | Choice |
|---------|--------|
| Desktop runtime | Electron |
| UI | React + TypeScript |
| Build | electron-vite + Vite |
| Styling | Tailwind CSS v4 |
| Monorepo | pnpm workspaces |
| Tests | Vitest |
| Git integration | simple-git (requires system Git) |
| HTTP execution | undici |
| Secret storage | keytar (OS credential store) |
| OpenAPI validation | @apidevtools/swagger-parser |

---

## Project Structure

```
apps/
  desktop/            Electron host + React renderer
packages/
  shared-types/       Domain model contracts shared across all packages
  core-model/         In-memory model built from openapi.json + .api-tool metadata
  import-export/      OpenAPI parse/import/export and deterministic JSON writer
  validation/         OpenAPI 3.x structural validator
  git-adapter/        simple-git facade for workspace Git operations
  request-execution/  HTTP execution engine for operation-level invocation
  secrets/            OS credential store abstraction (keytar)
_docs/                Architecture spec, implementation plan, testing strategy
```

---

## Prerequisites

- Node.js >= 20
- pnpm >= 9
- Git (system installation — used at runtime by the app)

---

## Development

```bash
# Install dependencies
pnpm install

# Start the desktop app in development mode
pnpm dev

# Run all tests
pnpm test

# Type check all packages
pnpm typecheck

# Lint
pnpm lint
```

---

## Architecture

- Spec: [_docs/spec.md](./_docs/spec.md)
- Implementation plan: [_docs/implementation-plan.md](./_docs/implementation-plan.md)
- Testing strategy: [_docs/testing-strategy.md](./_docs/testing-strategy.md)

---

## Contributing

Branch from `dev`, open a PR back to `dev`. Squash merge. See `_docs/` for the full plan and phase gates.

---

## License

TBD — intended to be open source.
