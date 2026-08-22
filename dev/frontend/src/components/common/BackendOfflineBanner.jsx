import React, { useEffect, useState } from "react";
import { pingBackend, subscribeBackendStatus } from "../../api/backendStatus";

export default function BackendOfflineBanner() {
  const [offline, setOffline] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => subscribeBackendStatus(setOffline), []);

  useEffect(() => {
    pingBackend();
    const timer = setInterval(pingBackend, 15000);
    return () => clearInterval(timer);
  }, []);

  if (!offline) return null;

  const retry = async () => {
    setChecking(true);
    await pingBackend();
    setChecking(false);
  };

  return (
    <div className="backend-offline-banner" role="status" aria-live="polite">
      <i className="ri-wifi-off-line" aria-hidden="true"></i>
      <span>
        Backend server is offline so some services may not be accessible.
      </span>
      <button type="button" className="backend-offline-banner__retry" onClick={retry} disabled={checking}>
        {checking ? "Checking…" : "Retry"}
      </button>
    </div>
  );
}
