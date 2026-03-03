import express from "express";
import axios from "axios";
import https from "https";
import fs from "fs";

const app = express();

/**
 * We switch the backend to HTTPS so that the OpenShift Console proxy can reach it
 * without failing TLS handshake (which results in 502).
 *
 * The serving cert is injected by OpenShift into a Secret and mounted in the pod:
 *  - /var/run/tls/tls.crt
 *  - /var/run/tls/tls.key
 */

// ---- Ports
const HTTPS_PORT = Number(process.env.HTTPS_PORT || "8443");

// ---- TLS files (serving cert secret mount)
const TLS_CERT_PATH = process.env.TLS_CERT_PATH || "/var/run/tls/tls.crt";
const TLS_KEY_PATH = process.env.TLS_KEY_PATH || "/var/run/tls/tls.key";

// ---- In-cluster Prometheus endpoints (overridable)
const OPENSHIFT_PROM =
  process.env.OPENSHIFT_PROM_URL ||
  "https://thanos-querier.openshift-monitoring.svc:9091";

const CUSTOM_PROM =
  process.env.CUSTOM_PROM_URL ||
  "http://prometheus-operated.custom-monitoring.svc:9090";

function getServiceAccountToken() {
  return fs.readFileSync(
    "/var/run/secrets/kubernetes.io/serviceaccount/token",
    "utf8"
  );
}

// Demo: disable TLS verification for in-cluster reencrypt (Thanos route / service)
const httpsAgent = new https.Agent({
  rejectUnauthorized:
    (process.env.INSECURE_SKIP_TLS_VERIFY || "true").toLowerCase() !== "true",
});

async function queryProm(baseUrl, query, useAuth) {
  const url = `${baseUrl}/api/v1/query`;
  const headers = {};

  if (useAuth) {
    headers.Authorization = `Bearer ${getServiceAccountToken()}`;
  }

  const resp = await axios.get(url, {
    params: { query },
    headers,
    httpsAgent,
    timeout: 10000,
  });

  return resp.data?.data?.result?.[0]?.value?.[1] ?? null;
}

// ✅ Health endpoint for probes (no namespace hardcode)
app.get("/health", (_req, res) => res.status(200).send("ok"));

app.get("/api/finops/project", async (req, res) => {
  try {
    const namespace = String(req.query.namespace || "");
    if (!namespace) return res.status(400).json({ error: "namespace required" });

    // Custom Prometheus: simple query to validate endpoint
    const customQuery = "up";
    const customValue = await queryProm(CUSTOM_PROM, customQuery, false);

    // OpenShift monitoring (Thanos): namespace-scoped metric
    const openshiftQuery = `count(kube_pod_info{namespace="${namespace}"})`;
    const openshiftValue = await queryProm(OPENSHIFT_PROM, openshiftQuery, true);

    return res.json({
      namespace,
      custom: { query: customQuery, value: customValue },
      openshift: { query: openshiftQuery, value: openshiftValue },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
});

/**
 * Start HTTPS server
 */
function startHttps() {
  const cert = fs.readFileSync(TLS_CERT_PATH);
  const key = fs.readFileSync(TLS_KEY_PATH);

  https
    .createServer({ key, cert }, app)
    .listen(HTTPS_PORT, "0.0.0.0", () => {
      console.log(`FinOps backend HTTPS running on :${HTTPS_PORT}`);
    });
}

startHttps();