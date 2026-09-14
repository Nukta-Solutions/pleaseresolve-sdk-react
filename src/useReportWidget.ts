import { close, identify, open, report, setMetadata } from "@pleaseresolve/sdk";

/**
 * Proxies the core SDK's functions — `open`/`report`/`identify`/
 * `setMetadata` are already stable module-level references, so this adds
 * no state of its own. Requires `<ReportWidget />` (or a manual `init()`
 * call) to have run somewhere first; calling any of these before that
 * throws the same clear error the core SDK throws directly.
 */
export function useReportWidget() {
  return { open, close, report, identify, setMetadata };
}
