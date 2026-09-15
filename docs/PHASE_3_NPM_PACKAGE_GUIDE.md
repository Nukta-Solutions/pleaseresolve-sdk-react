# Phase 3 — npm Package & React

Programmatic, typed access to the same widget as the script tag — for apps already using a
bundler (Vite, webpack, Next.js, Remix, CRA), with first-class React bindings on top.

> Companion docs: [Phase 1 — Public API](../../pleaseresolve-backend/docs/PHASE_1_PUBLIC_API_GUIDE.md)
> (what this talks to under the hood) and
> [Phase 2 — Script Tag](../../pleaseresolve-sdk/docs/PHASE_2_SCRIPT_TAG_GUIDE.md)
> (zero-build alternative). Full engineering plan: `CLIENT_INTEGRATIONS_PLAN.md` in
> `pleaseresolve-backend`.

## Use cases

- **A React app** (or Next.js, Remix, etc.) — use `@pleaseresolve/react`'s `<ReportWidget />` and
  skip writing any DOM/script-tag glue yourself.
- **Any other bundled JS/TS app** (Vue, Svelte, vanilla TS) — use `@pleaseresolve/sdk` directly;
  it's framework-agnostic.
- **You want type safety and IDE autocomplete** on the config/payload shapes, which the raw script
  tag obviously can't give you.
- **You want the widget's code to live in your own build/deploy pipeline** rather than pulled from
  an external CDN at runtime.

If your site has no build step at all, [Phase 2's script tag](../../pleaseresolve-sdk/docs/PHASE_2_SCRIPT_TAG_GUIDE.md)
is simpler. If you're integrating server-side (CI, a backend, a webhook relay), you want
[Phase 1's raw API](../../pleaseresolve-backend/docs/PHASE_1_PUBLIC_API_GUIDE.md) instead — none
of this needs a browser.

## Before you start

Same as the script tag: get a **`public`-type** API key from Settings → API Keys, with your app's
origin(s) in `allowedOrigins`. This key still ends up in a browser bundle someone could inspect —
bundling it with npm instead of a raw `<script>` tag doesn't change that; it's still meant to be
public, still locked to `report:create` only. See
[Phase 1's security section](../../pleaseresolve-backend/docs/PHASE_1_PUBLIC_API_GUIDE.md#security).

> **Not published to npm yet.** Both `@pleaseresolve/sdk` and `@pleaseresolve/react` are built,
> typed, and tested, but still `"private": true` pending a naming/publishing decision (plan doc
> §10). Until published, install from a local build or a git dependency.

## Plain JS/TS — `@pleaseresolve/sdk`

**Zero config in your code**: set `.env` (`NEXT_PUBLIC_PLEASERESOLVE_KEY=pk_live_...`, optionally
`NEXT_PUBLIC_PLEASERESOLVE_PROJECT_ID`), then `import "@pleaseresolve/sdk/auto";` once, anywhere in
your app's entry point — no `init()` call anywhere. Works because your own bundler (Next.js, CRA)
inlines `NEXT_PUBLIC_...` env vars at build time; see the package README for exactly which
frameworks this covers.

Or configure explicitly instead:

```ts
import { init, report, identify, setMetadata, open, close } from "@pleaseresolve/sdk";

init({
  key: "pk_live_...",
  projectId: "...", // omit if your key covers exactly one project
  widget: true,      // default — mounts the floating button + form
});

// Pre-fill identity for a logged-in user:
identify({ name: currentUser.name, email: currentUser.email });
setMetadata({ plan: currentUser.plan });

// Headless — your own trigger, no floating button:
init({ key: "pk_live_...", widget: false });
myButton.addEventListener("click", () => open());

// Or skip the UI entirely and submit programmatically:
await report({ title: "...", description: "...", priority: "high" });
```

Full API surface, including `destroy()` (tear down the widget — mainly relevant if you're managing
its lifecycle manually rather than through `@pleaseresolve/react`), is documented in
`@pleaseresolve/sdk`'s own README.

## React — `@pleaseresolve/react`

Same env vars as above, plus `<ReportWidget />` with no props:

```tsx
import { ReportWidget } from "@pleaseresolve/react";

function App() {
  return (
    <>
      <ReportWidget /> {/* reads NEXT_PUBLIC_PLEASERESOLVE_KEY/PROJECT_ID */}
      {/* rest of your app */}
    </>
  );
}
```

Or pass props explicitly (always wins over the env var):

```tsx
import { ReportWidget, useReportWidget } from "@pleaseresolve/react";

function App() {
  return (
    <>
      <ReportWidget apiKey="pk_live_..." projectId="..." />
      {/* rest of your app */}
    </>
  );
}
```

> **Prop is `apiKey`, not `key`.** `key` is a reserved React prop — React intercepts it for
> reconciliation and it never reaches your component's props at all. This isn't a style choice;
> using `key` here would silently pass no API key whatsoever. `@pleaseresolve/react`'s type
> signature enforces this for you (`apiKey` is the only field that accepts it).

`<ReportWidget />` mounts on render and tears itself down (`destroy()`) on unmount — safe with
React 18 Strict Mode's double-invoke in dev, and with route changes that remove it entirely.

### Your own trigger button

```tsx
import { useReportWidget } from "@pleaseresolve/react";

function SupportMenu() {
  const { open, report, identify } = useReportWidget();
  return <button onClick={() => open()}>Report a problem</button>;
}
```

Works from anywhere in the tree, as long as `<ReportWidget />` (or a manual `init()` call) has run
somewhere first — `useReportWidget()` just proxies the same core functions, it holds no state of
its own.

### Props reference (`<ReportWidget />`)

| Prop | Required | Notes |
|---|---|---|
| `apiKey` | **yes** | Your `public`-type API key. (Not `key` — see above.) |
| `projectId` | only if your key covers more than one project | |
| `apiBaseUrl` | no | Override the API origin — local/staging testing. |
| `screenshot` | no | Default `true`. Set `false` to disable the built-in form's screenshot capture entirely. |

`widget` is not a prop here — `<ReportWidget />`'s whole job is mounting the default floating
button. For a fully custom trigger with **no** floating button anywhere, skip this component and
call `@pleaseresolve/sdk`'s own `init({ widget: false })` directly; `useReportWidget()` still works
either way.

## Screenshot capture

On by default (`screenshot={true}` / `init({ screenshot: true })`). The built-in form captures a
screenshot the moment it opens and shows the reporter a preview with a checkbox — this is the
consent point, which is why it's wired up for the form only. Headless `report()` calls **never**
auto-attach a screenshot, on purpose — there's no UI moment for anyone to see and opt out of it.

Implementation note, if you're curious why your network tab shows a request to `cdnjs.cloudflare.com`:
the capture library (`html2canvas`, ~200KB) isn't bundled into your app — it's lazy-loaded from a
CDN the first time a screenshot is actually captured, so it costs nothing until someone opens the
report form. See the plan doc's §4.3 for the full reasoning (this was a real correction made after
discovering the bundled size blew the widget's own size budget by 7x).

## Local development (before either package is published)

```sh
# 1. Build the core SDK
cd pleaseresolve-sdk
npm install && npm run build

# 2. Build the React wrapper (depends on the core SDK via a local file: dependency)
cd ../pleaseresolve-sdk-react
npm install && npm run build
```

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `<ReportWidget key="pk_...">` doesn't work | You used `key` instead of `apiKey` — see above. Check your editor isn't auto-suggesting `key` from React's own JSX intrinsics. |
| `Error: PleaseResolve.init() must be called before using the SDK` | `useReportWidget()`'s functions called before `<ReportWidget />` (or a manual `init()`) ever rendered/ran. |
| Two widgets/buttons appear | `init()` (or `<ReportWidget />`) mounted twice without an intervening `destroy()` — check you're not rendering it in more than one place, or remounting without unmounting the old one first. |
| `403 Origin not allowed for this API key` | Your app's dev/prod origin isn't in the key's `allowedOrigins`. Add `http://localhost:<port>` for local dev, your real domain for prod — as separate entries, not a wildcard. |
| TypeScript can't find `@pleaseresolve/sdk` types | Make sure the core package was built (`npm run build`) before the React package, since it's a local `file:` dependency during this pre-publish phase. |
