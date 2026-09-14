import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ReportWidget, useReportWidget } from "@pleaseresolve/react";

function CustomTrigger() {
  const { open } = useReportWidget();
  return React.createElement(
    "button",
    { id: "custom-trigger", onClick: () => open() },
    "Open report form",
  );
}

function App() {
  const [mounted, setMounted] = useState(true);
  return React.createElement(
    React.Fragment,
    null,
    mounted &&
      React.createElement(ReportWidget, {
        apiKey: "__API_KEY__",
        projectId: "__PROJECT_ID__",
        apiBaseUrl: "__API_BASE_URL__",
        screenshot: false,
      }),
    React.createElement(CustomTrigger, null),
    React.createElement(
      "button",
      { id: "unmount-btn", onClick: () => setMounted(false) },
      "Unmount",
    ),
  );
}

createRoot(document.getElementById("root")).render(React.createElement(App));
