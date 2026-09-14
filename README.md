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

## Usage

```tsx
import { ReportWidget, useReportWidget } from "@pleaseresolve/react";

// Render once, near your app's root — mounts the default floating button.
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

Note the prop is `apiKey`, not `key` — `key` is a reserved React prop name
(used for reconciliation, never passed into `props`), so the core SDK's
`InitOptions.key` field is renamed here. This isn't a style choice; using
`key` would silently receive no API key at all.

`screenshot={false}` disables the built-in form's screenshot capture — see
the core SDK's README for what that does and why it's consent-gated to the
form only, never headless `report()` calls.

## Build

```sh
npm install
npm run build
npm run typecheck
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
