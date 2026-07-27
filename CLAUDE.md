# CLAUDE.md — Ignition Portal

Hackathon application portal: React 19 + Vite SPA (`frontend/`), Express 5 +
Mongoose 8 API (`backend/`), backend test suite (`tests/`), docs (`docs/`).
Three independent npm packages — install/run each in its own folder.

## Required workflow — follow this for EVERY task (feature / fix / chore)

1. **Create a new branch** — never work directly on `main`
   (`git checkout main && git pull && git checkout -b <type>/<short-name>`).
2. **Read the docs** — start with `docs/README.md` / `docs/codebase-guide.md`,
   then the docs relevant to the area you're touching (`api-reference.md`,
   `database-models.md`, `authentication.md`, …). The docs are kept accurate —
   trust but verify against the code.
3. **Plan** the feature/fix/chore before writing code — what changes, which
   files, what could break, edge cases.
4. **TDD** — write the test cases for the new behavior first
   (backend: `tests/integration/` or `tests/unit/`; frontend: co-located
   `*.test.jsx` with Vitest + React Testing Library).
5. **Implement** the feature until the new tests pass.
6. **Run new AND old test cases** — the full suites must be green:
   ```bash
   cd tests    && npm test        # backend (in-memory MongoDB)
   cd frontend && npm test        # frontend components
   cd frontend && npm run lint && npm run build   # frontend "done" gate
   ```
   (Windows note: a trailing `ERR_IPC_CHANNEL_CLOSED` after all files pass is a
   known vitest teardown flake — re-run; it is not a test failure.)
7. **Update the docs** — every doc affected by the change (`api-reference.md`,
   `database-models.md`, `authentication.md`, `testing.md` incl. the test count,
   `environment-variables.md` for new env vars, etc.).
8. **Update `docs/manual-qa.md`** — add/adjust the manual test cases for the
   change (every table has a rightmost **Passed** column; leave it empty for
   the tester). Anything only verifiable by hand (real emails, real devices)
   goes in sections 7–8.

## Git rules (standing, from the project owner)

- **Never commit directly to `main`.** Always a branch.
- **Do not commit / push / merge unless explicitly asked** — leave changes in
  the working tree for review. When asked to push, push the branch only.
- **Never merge into `main` without explicit approval.**

## Gotchas worth knowing
