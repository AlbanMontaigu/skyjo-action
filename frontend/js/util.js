export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

// api.js's request() sets `.status` on every error it throws, so its
// `.message` is always the backend's (French) `detail`. A raw fetch failure
// (network down, backend unreachable) never goes through that path and
// throws the browser's own TypeError instead, whose `.message` ("Failed to
// fetch") is English and not something to show a French-speaking user --
// fall back to `fallback` in that case.
export function errorMessage(err, fallback) {
  return err && typeof err.status === "number" && err.message ? err.message : fallback;
}
