# Contributing to Hermes Hub

Thank you for improving Hermes Hub. The project prioritizes truthful state, local privacy, and recoverability over feature count.

## Development setup

1. Install Node.js 22, pnpm 12, and Git on Windows 10/11 x64.
2. Fork and clone the repository.
3. Run `pnpm install --frozen-lockfile`.
4. Run `pnpm build` and `pnpm test` before opening a pull request.
5. Use `pnpm dev:electron` from `apps/desktop` for the desktop development loop.

## Pull requests

- Keep changes focused and explain the user problem, behavior, and verification.
- Add tests for new logic and regression tests for bugs.
- Never commit credentials, vault files, diagnostics, personal sessions, device identities, live databases, or generated installers.
- Do not add a mock fallback to a production path. Demo data belongs only in explicitly labeled Demo Mode.
- Treat restore, baseline, conflict, repository, and update operations as privileged. Validate IPC inputs and require confirmation for state changes.
- Update README and architecture claims when behavior changes.

By participating, you agree to follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Security issues must follow [SECURITY.md](SECURITY.md), not a public issue.
