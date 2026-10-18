import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import VaultPanel from "./components/vault/VaultPanel";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <VaultPanel />
  </React.StrictMode>,
);
