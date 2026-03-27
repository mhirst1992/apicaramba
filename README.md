# APICaramba

> A local-first API management tool for teams that live in Git.

## What is it?

APICaramba is a desktop application for managing OpenAPI definitions alongside your code. API definitions live in Git, secrets stay off the network, and the tool gets out of your way.

- **Local-first** — fully functional offline, no cloud account required
- **Git-native** — workspaces are Git repositories; branching, diffing, and committing are built in
- **OpenAPI 3.x** — canonical format for interoperability with any external tooling
- **Request execution** — invoke operations directly from the definition

## Status

> 🚧 **Phase 0 — Foundation** — Core scaffolding in place. Not yet ready for use.

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 0 | ✅ In progress | Monorepo scaffold, domain types, JSON writer, desktop shell |
| Phase 1 | 🔜 | Full editing, validation, request execution, Git UI |
| Phase 2 | 🔜 | Shared resources, multi-environment |
| Phase 3 | 🔜 | Hardening, packaging, release |

## Tech Stack

- **Desktop:** Electron + React + TypeScript
- **Monorepo:** pnpm workspaces
- **Build:** electron-vite + Vite
- **Styling:** Tailwind CSS v4
- **Tests:** Vitest
- **Git integration:** simple-git (requires system Git)

## Project Structure

```
apps/
  desktop/          Electron + React application
packages/
  shared-types/     Domain model types (shared across all packages)
  core-model/       In-memory model built from openapi.json + metadata
  import-export/    Parse, import, export, and deterministic JSON writer
  validation/       OpenAPI 3.x structural validator
  git-adapter/      simple-git facade for workspace Git operations
  request-execution HTTP execution engine for OpenAPI operations
  secrets/          OS credential store integration (keytar)
_docs/              Architecture and planning documentation
```

## Prerequisites

- Node.js >= 20
- pnpm >= 9
- Git (system installation — used at runtime by the app)

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

## Architecture

See [_docs/spec.md](./_docs/spec.md) and [_docs/implementation-plan.md](./_docs/implementation-plan.md).

## Contributing

Standard Gitflow. Branch from `dev`, open a PR back to `dev`. See `_docs/` for the full implementation plan.

## License

TBD — intended to be open source.
