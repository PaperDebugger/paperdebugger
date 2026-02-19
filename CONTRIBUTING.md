# Contributing to PaperDebugger

## Getting Started

**Prerequisites:** Go 1.24+, MongoDB, Node.js

```bash
make deps                    # install dev tooling (linters, protoc, buf, wire, frontend deps)
cp .env.example .env         # configure environment variables
docker run -d --name mongodb -p 27017:27017 mongo:latest  # start MongoDB
make build && ./dist/pd.exe  # build and run
```

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for detailed setup instructions.

## Branch Structure & Naming

| Branch | Purpose | Version Bump | Protection |
|--------|---------|-------------|------------|
| `main` | Production — every commit must be deployable | Minor (`2.1.x` → `2.2.0`) | Fully protected |
| `staging` | Pre-production checkpoint, always aligned with or following `main` | Patch (`2.1.9` → `2.1.10`) | PR required, review optional |
| `development` | Sandbox for rapid iteration and prod-env simulation | None | No restrictions |
| `feat/*`, `fix/*` | Working branches for features and bug fixes | — | — |

Branch names are kept simple — use `feat/*` for new functionality and `fix/*` for bug fixes. The semantic distinction (docs, chore, refactor, etc.) is carried by the PR title instead (see [Pull Request Guidelines](#pull-request-guidelines)).

## Merge Workflow

### Standard Flow (substantial changes)

```
feat/* or fix/*  →  staging  →  main
                      ↓          ↓
                 integration   production
                   testing      release
```

1. Create `feat/*` or `fix/*` branch from `staging`
2. Develop and test locally
3. PR to `staging` — merge for integration testing on the staging endpoint
4. Once no defects are found, PR from `staging` to `main`

### Fast-track Flow (small, isolated changes)

```
feat/* or fix/*  →  main
```

For small, well-tested changes (typo fixes, minor refactors) that don't need integration testing. PR review is still required.

> **Note:** Fast-track merges to `main` will cause `staging` to drift behind. This is fine — `staging` does not need to be in sync at all times. Sync `staging` with `main` before starting a new round of integration testing (e.g., merge `main` into `staging`).

### When to Use Which

| Use `staging` | Go direct to `main` |
|---------------|---------------------|
| Changes touch multiple components | Small, isolated changes |
| Needs integration testing with recent changes | Confident in local testing |
| Uncertain about production impact | Low-risk (typos, minor refactors) |
| Want to verify on a prod-like environment first | — |

**Important:** Keep `staging` clean. It is the last gate before production — take care not to leave it in a broken state.

## Branch Protection

**`main`**
- Pull request required (no direct pushes)
- At least 1 approving review required
- All status checks must pass
- Linear history enforced (no merge commits)
- Force pushes and deletions blocked

**`staging`**
- Pull request required
- Review optional, but **strongly recommended** for complex changes
- All status checks must pass
- Force pushes allowed (for rebasing)

**`development`**
- No restrictions — free to push / merge without PR review
- Useful for simulating production environment behavior

## Pull Request Guidelines

PR titles **must** follow [Conventional Commits](https://www.conventionalcommits.org/) format (enforced by CI). While branch names use simple `feat/*` or `fix/*` prefixes, the PR title carries the semantic meaning:

```
feat: add tab completion support
fix: resolve token expiration bug
chore: update dependencies
docs: improve setup instructions
refactor: simplify chat service
test: add citation parsing tests
ci: add staging deploy workflow
```

**Merge strategy:**
- PR to `staging` — **merge commit** (retain full commit history for clarity and debugging during integration testing)
- PR to `main` — **squash and merge** (one atomic, deployable commit per PR to keep history clean)

**Two-layer review process:**
- PR to `staging` — first review layer, catches mistakes early (review optional but recommended)
- PR to `main` — second review layer, always requires approval

## Version Numbering

We follow semantic versioning (`MAJOR.MINOR.PATCH`):

| Component | When | How |
|-----------|------|-----|
| **Major** (`X.0.0`) | Breaking changes | Manual |
| **Minor** (`0.X.0`) | Merge to `main` | Auto-increment |
| **Patch** (`0.0.X`) | Merge to `staging` | Auto-increment |

Example: `feat/new-feature` → staging (`2.1.9` → `2.1.10`) → main (`2.1.10` → `2.2.0`)

## Code Quality

Run these before submitting a PR:

```bash
make fmt     # format Go, proto, and frontend code
make lint    # lint Go (golangci-lint), proto (buf lint), and frontend (eslint)
make test    # run all tests with coverage (requires MongoDB on localhost:27017)
```

All `make` commands and their details can be inspected in the [Makefile](Makefile).

**Code stability guarantee:** Every commit on `main` must:
- Compile without errors
- Pass all tests
- Be deployable to production
- Have no known breaking bugs

## Proto / API Changes

When modifying `.proto` files in `proto/`:

```bash
make gen     # regenerate Go + gRPC + gateway + TypeScript bindings
```

Commit the generated files in `pkg/gen/` alongside your proto changes.
