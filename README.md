# @pleaseresolve/react

React bindings for [`@pleaseresolve/sdk`](../pleaseresolve-sdk) — a
`<ReportWidget />` component and a `useReportWidget()` hook. Phase 3 of
`CLIENT_INTEGRATIONS_PLAN.md` (see that doc in `pleaseresolve-backend`).

## Install

Not published yet (both this package and `@pleaseresolve/sdk` are still
`"private": true` — see `CLIENT_INTEGRATIONS_PLAN.md` §10). Locally, this
package depends on `@pleaseresolve/sdk` via `file:../pleaseresolve-sdk`, so
building it requires that sibling directory to exist and have been built
(`npm run build` there first).

## Usage — zero config in your code

```
# .env
NEXT_PUBLIC_PLEASERESOLVE_KEY=pk_live_...
NEXT_PUBLIC_PLEASERESOLVE_PROJECT_ID=...   # optional — only if your key covers more than one project
```

```tsx
import { ReportWidget } from "@pleaseresolve/react";

function App() {
  return (
    <>
      <ReportWidget /> {/* no props — reads NEXT_PUBLIC_PLEASERESOLVE_KEY/PROJECT_ID */}
      {/* the rest of your app */}
    </>
  );
}
```

You still render `<ReportWidget />` once, near your app's root — a package can't insert itself
into your React tree with zero references to it anywhere in your code (nothing would import it, so
a real build would tree-shake it out entirely). This is as close as that gets: one line with no
config on it, credentials entirely from your `.env`. Rendering `<ReportWidget />` with no key
configured logs a console warning and mounts nothing — safe to leave in before `.env` is filled in.

## Usage — explicit props

```tsx
import { ReportWidget, useReportWidget } from "@pleaseresolve/react";

function App() {
  return (
    <>
      <ReportWidget apiKey="pk_live_..." projectId="..." />
      {/* the rest of your app */}
    </>
  );
}

// From anywhere else in the tree, drive it with your own UI:
function SupportMenu() {
  const { open, report, identify } = useReportWidget();
  return <button onClick={() => open()}>Report a problem</button>;
}
```

An explicit prop always wins over the matching env var. Note the prop is `apiKey`, not `key` —
`key` is a reserved React prop name (used for reconciliation, never passed into `props`), so the
core SDK's `InitOptions.key` field is renamed here. This isn't a style choice; using `key` would
silently receive no API key at all.

`screenshot={false}` disables the built-in form's screenshot capture — see
the core SDK's README for what that does and why it's consent-gated to the
form only, never headless `report()` calls.

## Build

```sh
npm install
npm run build
npm run typecheck
```

**Local-dev gotcha**: this package depends on `@pleaseresolve/sdk` via `file:../pleaseresolve-sdk`,
and npm's `file:` protocol copies the dependency in at install time rather than symlinking it —
`npm install` alone does **not** pick up changes made to the core SDK afterward. After rebuilding
`pleaseresolve-sdk`, refresh this package's copy of it before rebuilding here:

```sh
rm -rf node_modules/@pleaseresolve && npm install
```

## Testing

```sh
npm run build
node test-e2e.mjs
```

Requires a local `pleaseresolve-backend` on `:5000` and
`pleaseresolve-sdk`'s own `dist/` already built. This test specifically
covers the React glue layer — `<ReportWidget />` calling `init()`/`destroy()`
on mount/unmount, and `useReportWidget()`'s `open()` reaching the core
widget via a custom trigger — not the widget UI itself (form fields,
screenshot capture, submission), which `pleaseresolve-sdk`'s own
`test-e2e.mjs` already covers in full.

```sh
node test-auto-init.mjs
```

A second test proving the zero-props path specifically: a real React app bundled with esbuild
(Next.js-equivalent `process.env.NEXT_PUBLIC_...` substitution), rendering `<ReportWidget />` with
no props whatsoever, confirmed to mount and complete a real submission anyway.

## License

**Proprietary — not open source.** This package is publicly installable so Please Resolve
clients can `npm install` it and audit exactly what they're embedding, but it may only be used to
integrate with the Please Resolve platform under an active Please Resolve account. See
[LICENSE](./LICENSE) for the full terms — no rights to copy, modify, redistribute, or reuse this
package independently of the Service are granted.
