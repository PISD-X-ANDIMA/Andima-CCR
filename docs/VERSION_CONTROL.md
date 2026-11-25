# Version Control & Code Quality Standards

## 1. Branching Strategy

The repository follows a Trunk-Based / Feature-Branch workflow designed for continuous integration and safe releases.

### Branch Types & Naming Conventions
- `main`: Production-ready branch. Direct pushes to `main` are restricted.
- `feat/<module>-<description>`: New features or major enhancements (e.g., `feat/C1-sales-overview-chart`, `feat/customer-analytics-filters`).
- `fix/<module>-<description>`: Bug fixes and issue remediations (e.g., `fix/overdue-aging-sorting`, `fix/upload-mime-check`).
- `chore/<description>`: Maintenance, dependency updates, and configuration tasks (e.g., `chore/cleanup-dead-tables`).
- `docs/<description>`: Documentation, FR/TR specifications, and architecture records (e.g., `docs/version-control-standards`).

### Branch Lifecycle
1. Branch off the latest `main` (or designated upstream integration branch).
2. Keep branches small and focused on a single requirement or ticket.
3. Rebase onto `main` before submitting a Pull Request to maintain a clean linear commit history.
4. Delete feature branches after successful merging.

---

## 2. Commit Message Standards

All commits must follow the **Conventional Commits 1.0.0** specification:

```text
<type>(<scope>): <short description in imperative mood>

[optional body explaining WHY the change was made, trade-offs, and edge cases]

[optional footer(s) for issue references or breaking change notices]
```

### Types
- `feat`: A new user-facing capability or API feature.
- `fix`: A bug fix or defect correction.
- `docs`: Documentation changes only (e.g., Markdown files, docstrings).
- `style`: Formatting, whitespace, semicolon changes (no production logic change).
- `refactor`: Code changes that neither fix a bug nor add a feature.
- `perf`: Performance improvements.
- `test`: Adding missing tests or correcting existing tests.
- `chore`: Build tooling, dependency upgrades, release tasks.

### Good vs. Bad Commit Examples

```text
# GOOD
feat(sales-overview): add trailing period quick filters and chart popover
fix(overdue-alerts): remove pic assignment filter for staff role
docs(vcs): add version control and anti-slop code quality guide

# BAD
Fixed stuff
Update SalesOverview.tsx
WIP bugfix
ai generated code changes
```

---

## 3. Pull Request & Review Workflow

### Pull Request Checklist
Before opening a Pull Request (PR), ensure all quality gates pass locally:
1. `pnpm run typecheck` passes with zero TypeScript errors.
2. `pnpm run lint` passes without warnings or errors.
3. `pnpm test` runs and passes 100% of test suites.
4. Database migrations (if any) are reversible and tested with Supabase.

### Review Principles
- PRs must receive at least one peer approval before merging.
- PR descriptions must state:
  - **Summary**: Concise bullet points of what changed.
  - **Rationale**: Why this approach was selected.
  - **Verification**: Exact steps and commands executed to test the changes.
  - **Screenshots / Logs**: Visual proof of UI or CLI validation where applicable.

---

## 4. Release Notes & Versioning Standards

### Semantic Versioning (SemVer 2.0.0)
Releases use standard `vMAJOR.MINOR.PATCH` format:
- `MAJOR`: Incompatible API or database schema breaks.
- `MINOR`: New backwards-compatible functionality added.
- `PATCH`: Backwards-compatible bug fixes and security patches.

### Release Cadence
- Sprint releases tag a minor or patch version (e.g., `v1.2.0`).
- Each release must publish a markdown entry in `docs/RELEASE_NOTES.md` documenting:
  - Added features.
  - Changed behaviors.
  - Deprecated or removed functions.
  - Fixed issues.

---

## 5. Anti-Slop Code Quality Standards

Applied per the `anti-slop` engineering rules (`antislop-code`, `antislop-ui`, `antislop-human`):

### Code Comments
- **Explain WHY, not WHAT**: Avoid echoing standard syntax (e.g., do not write `// iterate through array` before `array.map(...)`).
- **No Decorative Banners**: Do not use ASCII divider banners (e.g., `// ==========================`).
- **No Step Narration**: Avoid pseudo-methodical commentary like `// Step 1: Initialize variable`, `// Step 2: Call fetch`.
- **Preserve Domain Context**: Retain business logic warnings, SLA calculations, and currency/tax rounding explanations.

### Interface & Design Quality
- **High Visual Contrast**: Ensure all text elements satisfy WCAG AA contrast (minimum 4.5:1 for body copy).
- **Subtle Elevation & Crisp Borders**: Avoid heavy blurry shadows or saturated gradient backgrounds. Use soft border lines (`border-slate-200`) and clean matte surfaces (`bg-slate-50`).
- **Accessible Focus States**: All buttons, links, and inputs must feature visible focus rings (`focus:ring-2 focus:ring-blue-100 focus:border-blue-400`).
- **Human Error Messages**: Never present raw stack traces or internal database column keys to end users. Translate errors into actionable, plain-language guidance.

