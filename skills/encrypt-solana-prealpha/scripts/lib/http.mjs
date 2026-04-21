/**
 * Tiny injectable HTTPS JSON client. Production uses `https.get`; tests pass a fake
 * `transport({ url, headers })` returning `{ status, body }`.
 */

import https from "https";

export function httpsJsonDefault(userAgent) {
  return function httpsJson(url, extraHeaders = {}) {
    return new Promise((resolve, reject) => {
      const req = https.get(
        url,
        {
          headers: {
            "User-Agent": userAgent,
            ...extraHeaders,
          },
        },
        (res) => {
          let body = "";
          res.on("data", (c) => (body += c));
          res.on("end", () => {
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`HTTP ${res.statusCode} for ${url}: ${body.slice(0, 400)}`));
              return;
            }
            try {
              resolve(JSON.parse(body));
            } catch (e) {
              reject(new Error(`Invalid JSON from ${url}: ${e.message}`));
            }
          });
        },
      );
      req.on("error", reject);
      req.setTimeout(25_000, () => {
        req.destroy(new Error("Request timeout"));
      });
    });
  };
}

/**
 * Wrap a synchronous/async transport (url, headers) -> { status, body } into
 * the httpsJson-shaped Promise<object> used by the audit script.
 */
export function httpsJsonFromTransport(transport) {
  return async function httpsJson(url, extraHeaders = {}) {
    const { status, body } = await transport({ url, headers: extraHeaders });
    if (status && status >= 400) {
      throw new Error(`HTTP ${status} for ${url}: ${String(body).slice(0, 400)}`);
    }
    try {
      return typeof body === "string" ? JSON.parse(body) : body;
    } catch (e) {
      throw new Error(`Invalid JSON from ${url}: ${e.message}`);
    }
  };
}
