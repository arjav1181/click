/*
 * Small, deliberate stealth surface. It only removes the obvious automation
 * markers; it does not pretend to be a specific browser build or forge a
 * logged-in identity. A dedicated account is still required for signed-in
 * joins.
 */
(() => {
  try {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  } catch {}
  try {
    Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
  } catch {}
  try {
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
  } catch {}
  try {
    if (!window.chrome) window.chrome = {};
    if (!window.chrome.runtime) window.chrome.runtime = {};
  } catch {}
  try {
    const query = navigator.permissions && navigator.permissions.query;
    if (query) {
      navigator.permissions.query = (parameters) =>
        parameters && parameters.name === "notifications"
          ? Promise.resolve({ state: Notification.permission })
          : query.call(navigator.permissions, parameters);
    }
  } catch {}
  try {
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function (parameter) {
      if (parameter === 37445) return "Intel Inc.";
      if (parameter === 37446) return "Intel Iris OpenGL Engine";
      return getParameter.call(this, parameter);
    };
  } catch {}
})();
