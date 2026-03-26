## Frontend (React + Vite)

This folder contains the graph UI (React + Vite).

Use the root README for full end-to-end setup (backend + frontend + `.env`).

### Root instructions

See `../README.md`.

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Architecture Overview

- Hooks: Handle logic (graph, chat, streaming)
- Components: UI rendering
- Utils: Shared helpers
- Constants: Configurations

This separation ensures modularity and maintainability.