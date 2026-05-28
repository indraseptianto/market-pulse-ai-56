# Contributing to Market Pulse AI-56

Thank you for your interest in contributing! Here's everything you need to know.

## 🧩 Project Overview

**Market Pulse AI-56** is an Indonesian stock market dashboard built with:
- **TanStack Start** (React 19 SSR framework)
- **TypeScript** (strict mode)
- **TailwindCSS v4** + shadcn/ui components
- **DataSectors API** for stock data
- **Supabase** for auth and database

## 🚀 Getting Started

```bash
# 1. Fork and clone
git clone https://github.com/YOUR_USERNAME/market-pulse-ai-56.git
cd market-pulse-ai-56

# 2. Install dependencies
bun install

# 3. Copy env file
cp .env.example .env
# Fill in your API keys (see README for required vars)

# 4. Start dev server
bun dev
```

## 🌳 Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Stable, production-ready code |
| `develop` | Integration branch for features |
| `feat/*` | Feature branches (e.g. `feat/new-chart-type`) |
| `fix/*` | Bug fix branches (e.g. `fix/screener-filter`) |
| `chore/*` | Non-functional changes (e.g. `chore/update-deps`) |

### Workflow

```
1. Create a branch from develop (or main for hotfixes)
2. Make your changes with clear, atomic commits
3. Open a PR to develop
4. Ensure CI passes (lint, typecheck, build)
5. Get at least 1 review
6. Squash and merge
```

## ✅ PR Checklist

Before submitting a PR, make sure:

- [ ] `bun lint` passes
- [ ] `bun typecheck` passes (no new type errors introduced)
- [ ] `bun build` succeeds
- [ ] New features have meaningful error handling
- [ ] No `console.log` left in production code (use `import.meta.env.DEV`)
- [ ] New routes added to `AppSidebar.tsx` if needed
- [ ] New server functions documented in `.env.example`

## 📐 Code Style

- **Formatting:** Prettier (auto-runs on commit via hooks)
- **Linting:** ESLint + TypeScript ESLint (auto-runs on commit)
- **Commits:** Use conventional commits format
  ```
  feat: add new screener filter
  fix: resolve hydration mismatch in sectors page
  chore: update DataSectors SDK version
  docs: update README for new env vars
  refactor: extract chart logic into separate hook
  ```

## 🧪 Testing

Currently the project uses manual testing via `bun dev`. For new components:

1. Test in development mode (`bun dev`)
2. Test responsive layout (mobile + desktop)
3. Test with empty states and loading skeletons
4. Test with error states (API failures, invalid inputs)

## 🐛 Reporting Issues

Please include:
- Steps to reproduce
- Expected vs actual behavior
- Browser/OS version
- Screenshot if applicable

## 📚 Useful Resources

- [TanStack Start Docs](https://tanstack.com/start/latest/docs/framework/react/overview)
- [TanStack Router](https://tanstack.com/router/latest/docs/framework/react/overview)
- [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/overview)
- [shadcn/ui](https://ui.shadcn.com)
- [DataSectors API](https://api.datasectors.com/docs)