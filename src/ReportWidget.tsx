import { useEffect } from "react";
import { destroy, init, type InitOptions } from "@pleaseresolve/sdk";

export type ReportWidgetProps = Omit<InitOptions, "widget" | "key"> & {
  /**
   * The core SDK calls this field `key` (`InitOptions.key`) — renamed here
   * because `key` is a reserved React prop name. React intercepts it for
   * reconciliation and never passes it into `props` at all, so
   * `<ReportWidget key="pk_live_...">` would silently receive no API key
   * whatsoever; this isn't optional naming, it's the only name that works.
   */
  apiKey: string;
};

/**
 * Mounts the widget for the lifetime of this component — render it once
 * near your app's root (it renders nothing itself; the core SDK injects the
 * floating button/form directly into `document.body`). Unmounting calls
 * `destroy()`, so it's safe in dev-mode double-invoke and on route changes
 * that remove it.
 *
 * This always mounts the default floating button (that's this component's
 * whole job). For a fully custom trigger with no floating button at all,
 * skip `<ReportWidget />` and call `@pleaseresolve/sdk`'s own
 * `init({ widget: false })` directly — `useReportWidget()` below still
 * works either way, since it just proxies the core SDK's functions.
 */
export function ReportWidget({ apiKey, ...rest }: ReportWidgetProps) {
  useEffect(() => {
    init({ ...rest, key: apiKey, widget: true });
    return () => destroy();
    // Re-initializes only when identity-relevant config changes — matches
    // the core SDK's own re-init semantics (`init()` called again just
    // updates key/projectId/apiBaseUrl on the existing widget rather than
    // mounting a second one), so this doesn't need every prop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, rest.projectId, rest.apiBaseUrl, rest.screenshot]);

  return null;
}
