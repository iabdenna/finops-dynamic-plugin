import express from "express";
import axios from "axios";
import https from "https";
import fs from "fs";

const app = express();

/**
 * HTTPS server for OpenShift ConsolePlugin proxy
 * - OpenShift serving cert mounted at /var/run/tls/tls.{crt,key}
 * - Backend listens on 8443 (HTTPS)
 */

// ---- HTTPS listener
const HTTPS_PORT = Number(process.env.HTTPS_PORT || "8443");
const TLS_CERT_PATH = process.env.TLS_CERT_PATH || "/var/run/tls/tls.crt";
const TLS_KEY_PATH = process.env.TLS_KEY_PATH || "/var/run/tls/tls.key";

// ---- Prom endpoints (should point to oauth-proxy frontends when applicable)
const OPENSHIFT_PROM =
  process.env.OPENSHIFT_PROM_URL ||
  "https://thanos-querier.openshift-monitoring.svc:9091";

const CUSTOM_PROM =
  process.env.CUSTOM_PROM_URL ||
  "https://custom-prom-oauth-proxy.custom-monitoring.svc:9091";

// ---- TLS verify for upstream Prom endpoints (often reencrypt/internal CA)
const INSECURE_SKIP_TLS_VERIFY =
  (process.env.INSECURE_SKIP_TLS_VERIFY || "true").toLowerCase() === "true";

const httpsAgent = new https.Agent({
  rejectUnauthorized: !INSECURE_SKIP_TLS_VERIFY,
});

/**
 * Extract Bearer token forwarded by the Console (user identity).
 * With oauth-proxy in front of Prom/Thanos, we forward the same token.
 */
function getBearerToken(req) {
  const h = req.headers["authorization"] || req.headers["Authorization"];
  if (!h) return null;
  const s = String(h);
  return s.toLowerCase().startsWith("bearer ") ? s.slice(7).trim() : null;
}

/**
 * Prometheus instant query helper.
 * If bearerToken is provided => send Authorization: Bearer <token>
 */
async function queryProm(baseUrl, query, bearerToken) {
  const url = `${baseUrl}/api/v1/query`;
  const headers = {};

  if (bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`;
  }

  const resp = await axios.get(url, {
    params: { query },
    headers,
    httpsAgent,
    timeout: 10000,
  });

  return resp.data?.data?.result?.[0]?.value?.[1] ?? null;
}

// ---- Health for probes and proxy checks
app.get("/health", (_req, res) => res.status(200).send("ok"));

/**
 * FinOps Project endpoint
 * - requires user Bearer token (because customer oauth-proxy expects it)
 * - queries:
 *    custom prom: up
 *    openshift/thanos: count(kube_pod_info{namespace="X"})
 */
app.get("/api/finops/project", async (req, res) => {
  try {
    const namespace = String(req.query.namespace || "");
    if (!namespace) return res.status(400).json({ error: "namespace required" });

    const userToken = getBearerToken(req);
    if (!userToken) {
      return res.status(401).json({ error: "missing bearer token" });
    }

    // Custom endpoint (oauth-proxy in front): needs Bearer
    const customQuery = "up";
    const customValue = await queryProm(CUSTOM_PROM, customQuery, userToken);

    // Thanos querier (if also behind oauth-proxy): use same Bearer
    const openshiftQuery = `count(kube_pod_info{namespace="${namespace}"})`;
    const openshiftValue = await queryProm(
      OPENSHIFT_PROM,
      openshiftQuery,
      userToken
    );

    return res.json({
      namespace,
      custom: { query: customQuery, value: customValue },
      openshift: { query: openshiftQuery, value: openshiftValue },
    });
  } catch (e) {
    console.error("Error in /api/finops/project:", e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
});

// ---- Start HTTPS server
function startHttps() {
  const cert = fs.readFileSync(TLS_CERT_PATH);
  const key = fs.readFileSync(TLS_KEY_PATH);

  https
    .createServer({ key, cert }, app)
    .listen(HTTPS_PORT, "0.0.0.0", () => {
      console.log(`FinOps backend HTTPS running on :${HTTPS_PORT}`);
      console.log(`OPENSHIFT_PROM_URL=${OPENSHIFT_PROM}`);
      console.log(`CUSTOM_PROM_URL=${CUSTOM_PROM}`);
      console.log(`INSECURE_SKIP_TLS_VERIFY=${INSECURE_SKIP_TLS_VERIFY}`);
    });
}

startHttps();