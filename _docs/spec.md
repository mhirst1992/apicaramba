
# Local-First API Management Tool — Architecture Draft (v0.1)

## Companion Documents

- Implementation plan: `_docs/implementation-plan.md`
- Testing strategy and phase gates: `_docs/testing-strategy.md`

## Overview

A local-first, developer-friendly API management tool designed to:

- Work primarily as a lightweight local executable
- Use Git repositories as the source of persistence and collaboration
- Store API definitions using the OpenAPI Specification (JSON)
- Provide an enhanced developer UX via structured internal representation and metadata

The tool bridges:

- Git-native workflows (branch, commit, push, pull)
- API definition and testing
- Lightweight API editing without reliance on cloud services

## Core Principles

### 1. Local-First

- Fully functional offline
- No required cloud sync or account
- All state stored locally and in Git

### 2. Git-Native

Native support for:
- Branching
- Commit history
- Diffing
- Pull/push
- Repositories act as workspaces

### 3. Open Standard Core

- API definitions stored as: `openapi.json` (OpenAPI 3.x compliant)
- Ensures interoperability with external tools

### 4. Developer Experience First

Internal representation optimized for:
- Navigation
- Editing
- Organization (folders/groups)
- Abstracts away OpenAPI complexity where possible


## Workspace Model

### Repository = Workspace

A single Git repository represents a workspace. A workspace can contain:

- Multiple APIs
- Shared components (schemas, headers, etc.)
- Shared resources are scoped to the workspace only

### Example Structure (Conceptual)

```
/workspace
  /apis
    /payments
    /users
  /shared
    /schemas
    /headers
  openapi.json (or multiple per API, TBD)
  .api-tool/
    metadata.json
    structure.json
```


## API Representation Strategy

### Canonical Format

- `openapi.json` is always present and valid
- Used for:
  - Interoperability
  - External tooling
  - CI/CD pipelines

### Internal Representation

Tool maintains a structured model:
- Endpoints grouped into folders
- Logical separation of components
- Not constrained by OpenAPI layout

### Composition Model (Option C — Dual Representation)

#### Dual Files in Repository

**OpenAPI Document**
- `openapi.json` - Canonical API definition

**Tool Metadata**
- Stored under `.api-tool/` (or similar)
- Contains:
  - Folder/group structure
  - UI state (optional)
  - Variable/environment references
  - Tool-specific enhancements

### Sync Strategy

#### Import (Repo → Tool)

1. Parse `openapi.json`
2. Merge with metadata files
3. Build internal structured model

#### Export (Tool → Repo)

1. Generate `openapi.json` from internal model
2. Preserve semantic equivalence (strictness TBD)
3. Update metadata files

### Round-Trip Guarantees

**Goal:** Deterministic round-trip `OpenAPI → Tool → OpenAPI`

Open questions:
- Byte-level equality vs semantic equality
- Conflict resolution when both files change


## Core Features (Initial Scope)

### API Editing

Create/update:
- Endpoints (GET, POST, PUT, DELETE, etc.)
- Headers
- Request/response bodies (JSON, XML, text)
- Group endpoints into folders

### Variables & Environments

Support environment files:
- Secrets
- Base URLs
- Variable substitution in:
  - Headers
  - URLs
  - Bodies

### Git Integration

Built-in commands:
- Branch
- Commit
- Push/Pull
- Diff awareness (possibly API-aware diffs later)

### Multi-API Support

- Multiple APIs per workspace
- Shared components across APIs


## Open Design Questions

This section is retained for historical context. The following v1 decisions are now confirmed:

1. **Technology Stack (v1)**
  - Electron + TypeScript + React is the selected implementation approach.
  - Packaging target is a desktop installable app with support for generating a single executable/distributable artifact per platform.
  - Auto-updates are explicitly deferred to a later version.

2. **Git Integration**
  - Git remains the source of truth for collaboration workflows.
  - v1 standard adapter: `simple-git` (shells out to system Git).
  - System Git installation is a runtime prerequisite for v1.
  - v1 will use standard Git workflows and expose Git operations in-app where practical.
  - Git conflicts are resolved through normal Git conflict resolution.

3. **Feature Scope by Phase**
  - API execution is in Phase 1.
  - Shared components/editing workflows beyond baseline support are Phase 2.
  - v1 starts with a single environment profile.

4. **Validation Depth**
  - v1 targets complete structural OpenAPI validation (OpenAPI 3.x) before save/export.

5. **Manual External Edits / Import Behaviour**
  - Manual edits outside the tool are discouraged.
  - If detected (or when importing existing OpenAPI specs), operations with no metadata mapping are placed at workspace/API root (default ungrouped node) so users can reorganize and regenerate metadata.

6. **Secrets Handling**
  - Users explicitly annotate secure variables at creation time.
  - Secret distribution/sharing is out of scope for v1.

7. **Platform Priorities**
  - Primary test and support targets for v1 are Windows and Linux.
  - macOS support remains desirable but is not a primary validation target due to current hardware constraints.

8. **Workspace Model in UI Runtime**
  - App assumes repositories are already cloned locally.
  - One workspace per running application instance.
  - Multiple tabs within that workspace are supported (endpoints/files).

9. **Scale Targets**
  - Up to 25 APIs per workspace.
  - Up to 100 endpoints per API.


## Execution Model

### Decision

- **Primary Model (v1)**
  - Desktop-first, lightweight local application.
  - Runs as a standalone executable on the developer’s machine.
  - Preserves the core principles of being:
    - **Local-first** (fully functional offline, no required cloud account).
    - **Git-native** (operates directly on local Git repositories as workspaces).  

- **Supported Platforms (v1)**
  - Primary validation platforms:
    - Windows
    - Linux
  - Secondary platform target:
    - macOS (best effort in v1, full validation deferred until hardware and CI coverage are available)

- **Relationship to CLI**
  - v1 focuses on the desktop UI as the primary interaction surface.
  - The core engine (OpenAPI model, metadata handling, Git integration, validation, etc.) is intended to be **headless and reusable**, so that:
    - A CLI interface can be built in future as an additional client over the same core.
  - CLI support is considered a **future extension**, to be implemented where strong use-cases are identified (e.g. automation, CI-friendly operations).

- **Technology Choice (v1)**
  - UI/runtime stack: Electron + TypeScript + React.
  - Packaging: desktop distributables with no mandatory cloud dependency.
  - Auto-update pipeline is deferred to a post-v1 phase.

- **Non-Goals (v1)**
  - No always-on background daemon or service is required.
  - The tool does not depend on any external cloud backend; it works purely with local files and Git repositories.

### API Execution Layer

- **Scope (v1)**
  - The tool provides **lightweight request execution** capabilities bound directly to OpenAPI operations.
  - Primary focus remains on **definition management**; execution is designed to support, not replace, dedicated API clients.

- **Request Execution Model**
  - Each defined operation in `openapi.json` can be **invoked directly** from the desktop UI.
  - The request editor is **derived from the OpenAPI definition**:
    - HTTP method, path, and base URL (from the selected environment).
    - Path/query/header/cookie parameters.
    - Request body schema (JSON, XML, text, where applicable).
  - Users can:
    - Select the active environment profile (single profile in v1; multi-environment support in later phases).
    - Override parameter values and headers at execution time.
    - Inject variables from environment files into:
      - URLs
      - Headers
      - Bodies

- **Response Handling**
  - For each executed request, the tool displays:
    - HTTP status code
    - Response headers
    - Response body (with basic formatting for JSON)
  - A minimal history of recent executions (per operation) may be retained in tool metadata (non-mandatory to commit).

- **Out of Scope (v1)**
  - No complex test scripting (e.g. JavaScript-based tests).
  - No workflow/collection runner beyond invoking individual operations.
  - No advanced mocking framework; only basic request execution against real endpoints.
  - No requirement for cloud-based sync or remote execution services.

### Environments & Variables

- **Environment Definitions**
  - v1 supports a single environment profile by default.
  - Multi-environment support (e.g. `local`, `dev`, `staging`, `prod`) is planned for a later phase.
  - For each environment, the following **non-sensitive** configuration is defined:
    - Base URL
    - Descriptive name/label
    - Optional non-secret defaults (e.g. default headers without credentials)
  - These environment definitions are stored as part of the workspace’s tool metadata (e.g. under `.api-tool/`), alongside other tool-specific enhancements such as folder/group structure.  

- **Variable Substitution**
  - Environment variables can be referenced in:
    - URLs (including base URL + path)
    - Headers
    - Request bodies
  - At execution time, the tool resolves variables using the selected environment and any user-specific secret values that are available locally.  

### Secrets & Credentials

- **Non-Commitment of Secrets**
  - Secrets (tokens, passwords, API keys, client secrets, etc.) are **never stored in Git-tracked files**.
  - Workspace-level configuration stored in the repository is explicitly limited to non-sensitive values.  

- **Local Secret Storage**
  - Secret values are stored in a **local, user-specific encrypted store** on the developer’s machine (corresponding to the “encrypted local store” option considered in the design).  
  - Users explicitly mark variables as secret during variable creation/editing.
  - The desktop application loads these secrets at runtime and merges them with the Git-based environment configuration when executing requests.

- **Out of Scope (v1)**
  - The tool does **not** provide features for securely sharing secrets between users.
  - Teams are expected to use existing, dedicated secret-management solutions to distribute credentials; this tool only consumes locally-available secrets at execution time.

### File Organisation & API Layout

- **Repository = Workspace**
  - A single Git repository represents a workspace.
  - A workspace can contain:
    - Multiple APIs
    - Shared components (schemas, headers, etc.)
    - Tool metadata (structure, environments, etc.)  

- **Per-API OpenAPI Documents**
  - Each API has its own canonical OpenAPI document:
    - Location: `/apis/<api-name>/openapi.json`
    - Format: OpenAPI 3.x compliant JSON.
  - This document is the **single source of truth** for that API’s definition and is used by:
    - External tools (generators, validators, CI/CD)
    - Other consumers of the repo.  

- **Shared Resources (Workspace-Scoped)**
  - A workspace supports shared resources that can be reused across multiple APIs:
    - Shared schemas (data models)
    - Shared headers
    - Other reusable fragments referenced from API definitions.  
  - Shared resources are scoped to the workspace and organised under a shared area, for example:
    - `/shared/schemas/...`
    - `/shared/headers/...`  

- **Representation of Shared Resources**
  - Shared resources are maintained primarily via the tool’s internal model and metadata (e.g. under `.api-tool/`), which:
    - Tracks which APIs consume which shared components.
    - Provides a logical, navigable view of shared items across the workspace.  
  - When exporting to `openapi.json` for each API:
    - Shared components are represented as standard OpenAPI components within that API’s document (e.g. `components.schemas`, `components.headers`).
    - The tool ensures that updates to shared resources are propagated to all consuming APIs on export, maintaining semantic consistency across `openapi.json` files.

- **Git & Diff Implications**
  - By using one `openapi.json` per API:
    - Git diffs remain focused at the API level.
    - Teams can evolve APIs independently while still benefitting from shared components.
  - Changes to shared resources will surface as changes to the relevant `openapi.json` files plus any corresponding metadata under `.api-tool/`.

### Tool Metadata & Local Application State

#### Git-Tracked Tool Metadata (`.api-tool/`)

- **Scope (v1)**
  - Only metadata that is required for **correct operation** of the tool and collaboration across developers is stored in Git:
    - Logical folder / group hierarchy for endpoints within each API.
    - Stable internal identifiers and mappings needed by the engine to relate:
      - Operations to their definitions in `/apis/<api-name>/openapi.json`
      - APIs to workspace-level shared resources (e.g. `/shared/schemas`, `/shared/headers`).  
    - Environment definitions containing **non-sensitive** configuration (e.g. base URLs, labels).  
  - This metadata lives under a tool-specific directory in the repository (e.g.:
    - `.api-tool/metadata.json`
    - `.api-tool/structure.json`
    - `.api-tool/environments.json`
  - All files under `.api-tool/` are **committed to Git** so that:
    - The workspace is reproducible for any developer who clones the repo.
    - Structural changes (e.g. regrouping endpoints, new shared components) are visible in code review.

- **Characteristics**
  - Designed to **round-trip deterministically** together with each API’s `openapi.json`.  
  - Does **not** store any user-specific UX preferences or secrets.
  - Kept intentionally minimal in v1 to reduce merge complexity and keep Git diffs focused on structural/semantic changes.

#### Local-Only Application State (Not Stored in Git)

- **Scope (v1)**
  - UX and per-user state is stored locally on the developer’s machine and is **never committed**:
    - Window and panel layout, including sidebar widths and panel positions.
    - Theme and other display preferences.
    - Recently opened workspaces/APIs/endpoints.
    - Per-user filters and sorting preferences.
    - Local request history and other ephemeral execution artefacts.
  - This data is stored in a platform-appropriate user configuration directory (e.g. OS app data) under a tool-specific path, outside any Git workspace.

- **Characteristics**
  - Local-only: not shared via Git, and not expected to be reproducible between developers.
  - Safe to freely mutate without impacting collaboration or causing merge conflicts.
  - May be reset or cleared without affecting the underlying API definitions or shared metadata.

#### Future Behavioural Configurations (Tests, Mocking, Plugins)

- **Not in Scope for v1**
  - Formal test definitions, mocking configurations, and plugin-related configuration are not introduced in the initial version.  

- **Expected Storage Model (Forward-Looking)**
  - When these features are added in a future version, the default expectation is:
    - Behavioural configurations (tests, mocks, plugin wiring) will be **stored in Git** alongside the workspace so that:
      - They are versioned and reviewable.
      - CI/CD can execute them.
      - Teams share a consistent behaviour model for each API.
  - The exact on-disk format and location (e.g. subdirectories under `.api-tool/`) will be defined in a later version of the specification.

### Conflict Resolution & Round-Trip Behaviour

- **Canonical Source of Truth**
  - For each API, `/apis/<api-name>/openapi.json` is treated as the **canonical source of truth** for the API’s semantics and structure.   
  - Git-tracked tool metadata under `.api-tool/` is considered **derivative** of the OpenAPI documents:
    - It exists to support navigation, grouping, shared-resource mapping, and environment definitions.
    - It does not introduce additional API semantics beyond what is represented in `openapi.json`.   

- **Import Behaviour (Repo → Tool)**
  - On opening a workspace or an API, the tool:
    1. Parses the API’s `openapi.json` file.
    2. Loads any existing metadata from `.api-tool/`.
    3. Detects whether metadata is consistent with the current OpenAPI definition.
  - If inconsistencies are detected (e.g. endpoints added/removed/renamed directly in `openapi.json`):
    - The tool **automatically rebuilds or updates** its internal metadata model based on the current `openapi.json`.
    - Where possible, existing grouping/folder structure is preserved when operations can be matched unambiguously.
    - In ambiguous cases, operations fall back to a default grouping at root (e.g. "Ungrouped") rather than blocking the user. This applies both to external manual edits and first-time imports of existing OpenAPI specs with no prior metadata.

- **Export Behaviour (Tool → Repo)**
  - When exporting/saving changes made via the tool:
    - The internal structured model is rendered back to `openapi.json`, maintaining **semantic equivalence** with the internal state.   
    - Corresponding `.api-tool/` files are regenerated or updated to reflect the current internal structure (folders, shared component mappings, environments, etc.).   

- **Conflict Resolution Strategy (v1)**
  - The tool does **not** implement an interactive conflict resolution UI between `openapi.json` and `.api-tool/`.
  - Instead, it follows a simple rule:
    - **OpenAPI wins**: when discrepancies exist, the OpenAPI file is treated as the authoritative source and metadata is automatically adjusted to match it.
  - Any issues that arise from concurrent modification of the same files across branches are expected to surface as **standard Git conflicts** during merge/pull:
    - Developers resolve text conflicts in `openapi.json` and `.api-tool/` files using their usual Git workflows.
    - After conflicts are resolved and the workspace is reopened, the tool re-imports the resolved `openapi.json` and rebuilds metadata as needed.   

- **Round-Trip Guarantees (v1)**
  - The primary guarantee is **semantic round-trip**:
    - OpenAPI → Tool → OpenAPI preserves the meaning and behaviour of the API, even if formatting and ordering change.
  - For v1, semantic equivalence includes preserving:
    - Effective endpoint surface (path + method combinations)
    - Parameter meaning and location (path/query/header/cookie)
    - Request/response schema meaning, including required vs optional fields
    - Security requirements and server/base URL behavior
  - For v1, semantic equivalence explicitly allows:
    - Key reordering
    - Normalized formatting/whitespace
    - Deterministic component/path sorting
  - Byte-level equality of `openapi.json` is **not guaranteed**:
    - The tool may normalise or reorder elements upon export (e.g. sorting paths or components).
    - Teams should avoid relying on raw file formatting and instead focus on semantic diffs.   

### Validation Strategy

- **Validation Scope**
  - The tool validates the internal API model against:
    - OpenAPI 3.x structural rules (where applicable).
    - Basic semantic constraints enforced by the tool (e.g. required fields, uniqueness of operation IDs, well-formed paths).  

- **Edit-Time Behaviour**
  - Users are allowed to freely edit and experiment with API definitions in the UI without continuous validation warnings.
  - The tool may perform lightweight background checks for internal consistency, but:
    - It does **not** block users from entering intermediate, invalid states.
    - It does **not** display persistent error/warning banners while the user is still editing.  

- **Save-Time Validation (Primary Trigger)**
  - Validation is run when the user:
    - Saves changes to an endpoint/operation.
    - Saves/exports changes that affect `openapi.json` for an API.  
  - If the validation detects **invalid or incomplete definitions** (e.g. missing required fields, structurally invalid OpenAPI snippets):
    - The tool surfaces **clear, targeted error messages** associated with the specific endpoint/field.
    - The user is informed that the endpoint or API cannot be saved in its current form.
  - Non-critical issues may be surfaced as warnings, but the primary behaviour is:
    - **Blocking save/export for structurally invalid OpenAPI** that would result in a broken `openapi.json` file.  

- **Workspace-Level Validation**
  - A workspace-level validation can be invoked (explicitly via a “Validate API/Workspace” action) to:
    - Validate all operations within a specific API.
    - Optionally validate all APIs in the workspace.  
  - Results are presented as a list of issues grouped by API and endpoint.

- **Git & CI/CD Alignment**
  - Since `openapi.json` is the canonical artefact for external tooling and CI/CD, the validation ensures that:
    - Any exported `openapi.json` is at least structurally valid according to OpenAPI 3.x.  
  - Teams may still run independent validators in CI/CD pipelines, but the tool aims to catch structural issues **at save time** to minimise broken files being committed.

### Diffing Strategy (v1)

- **Git Diff (Primary Source)**
  - All commits use Git’s native diff for actual version control operations.
  - Users can view the raw textual diff for `openapi.json` and `.api-tool/*`.

- **API-Aware Read-Only Diff (v1)**
  - The tool provides a structured, semantic diff view derived from the internal model:
    - Added/removed/modified endpoints
    - Changes to request/response schemas
    - Changes to shared components
    - Changes to environment definitions (non-secret fields only)
  - This view is **read-only** and supplements, rather than replaces, Git’s own diff.

- **Commit Message Generation (v1 or later)**
  - Because the tool understands semantic changes, it can generate suggested commit messages based on API-aware diffs.
  - This may initially be rule-based, with the option to introduce AI-enhanced commit‑message generation in a future version.

### Extensibility & Plugins

- **Extensibility in v1**
  - v1 does **not** expose a public plugin or extension API.
  - No third-party plugins are supported for:
    - Request execution
    - Code generation
    - Validation
    - UI extensions or custom panels   

- **Internal Modularity (Forward-Looking)**
  - While a formal plugin system is out of scope for v1, the internal architecture should remain modular enough that:
    - Future versions could introduce extension points (e.g. custom validators, code generators, AI-assisted tooling) without major redesign of the core engine.
  - Any future extensibility model will be defined in a separate version of the specification and is intentionally not committed to in this document.

### Performance & Scale

- **Target Scale for v1 (MVP/POC)**
  - Workspaces are expected to contain:
    - Up to **25 APIs** in one workspace.
    - Up to **100 endpoints** per API.
  - The MVP/POC implementation is optimised and tested primarily against this scale.

- **Behaviour Under Larger Loads**
  - Although v1 focuses on smaller workspaces, the architecture and implementation must:
    - Avoid pathological behaviour when the number of APIs or endpoints increases.
    - Continue to function correctly (no crashes or unusable latency) when:
      - The number of APIs in a workspace grows beyond the “handful”.
      - Individual `openapi.json` files contain significantly more endpoints than the v1 target.
  - High‑volume scenarios (large monolith APIs or very large numbers of APIs per workspace) are not explicitly optimised for in v1, but the tool **must not collapse at the first sign of volume**.

- **Future Scale Considerations (Post‑v1)**
  - Future versions may introduce:
    - Performance optimisations for:
      - Very large OpenAPI documents.
      - Workspaces with many APIs.
    - Additional UX and data‑loading strategies tailored for high‑volume environments.
  - These enhancements build on the same local‑first, Git‑native architecture defined in this document.   

### Desktop UI & Interaction Model (v1)

- **Overall Philosophy**
  - The UI follows an IDE-like experience, reflecting the tool’s focus on:
    - Navigation
    - Editing
    - Organization through folders/groups
  - This aligns with the internal structured representation already defined for the tool.  
  - One running app instance manages one workspace.
  - Within that workspace, users can open multiple endpoint/file tabs.

- **Primary Layout**
  - **Left Sidebar (Tree Navigation)**
    - Displays the workspace as a hierarchical tree:
      - Workspace
        - APIs
          - API folders/groups (as defined in metadata)
            - Endpoints
        - Shared components  
          - Schemas  
          - Headers  
        - Environments (non-sensitive definitions only)
    - Supports expand/collapse behaviour consistent with IDE project explorers.

  - **Main Editor Panel**
    - Shows the selected item:
      - Endpoint editor (method, path, parameters, request/response bodies)
      - Shared schema editor
      - Environment editor (non-sensitive)
      - API overview
    - Editor panels are structured, form-based, and optimised for clarity.

  - **Tabs / Subpanels Within Editor**
    - Request definition  
    - Response definitions  
    - Examples  
    - API-aware diff (read-only)  
    - Execution panel for sending requests (using environment selection)

- **Secondary Panels**
  - **Bottom Panel (Optional)**
    - Shows validation messages (triggered on save)
    - Shows request execution results (status, headers, body)
  - **Right Panel (Optional)**
    - Context-sensitive metadata or documentation

- **Behaviour & UX Notes**
  - Users can freely navigate and edit without interruption.
  - Validation only appears as blocking UI on save for invalid definitions.
  - Drag-and-drop support for rearranging endpoint groups is permitted.
  - IDE-like keyboard shortcuts (rename, search, navigate) should be supported in later iterations.

