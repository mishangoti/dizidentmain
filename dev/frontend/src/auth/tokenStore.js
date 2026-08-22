let accessToken = null;

export function setAccessToken(token) {
  accessToken = token || null;
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem("hms_access_token", token);
  } else {
    localStorage.removeItem("hms_access_token");
  }
}

export function getAccessToken() {
  if (accessToken) return accessToken;
  if (typeof window === "undefined") return null;
  return localStorage.getItem("hms_access_token");
}

export function clearAccessToken() {
  setAccessToken(null);
}
