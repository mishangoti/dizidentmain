import React from "react";
import ReactDOM from "react-dom/client";
import { AuthProvider } from "react-oidc-context";
import App from "./App.jsx";
import "./assets/css/clinic-overrides.css";
import { AUTHENTIK_ENABLED, oidcSettings } from "./auth/authFlags";

const root = ReactDOM.createRoot(document.getElementById("root"));

const app = (
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if (AUTHENTIK_ENABLED) {
  root.render(
    <AuthProvider
      {...oidcSettings}
      onSigninCallback={() => {
        window.history.replaceState({}, document.title, window.location.pathname);
      }}
    >
      {app}
    </AuthProvider>
  );
} else {
  root.render(app);
}
