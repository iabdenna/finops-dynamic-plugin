## Backend deployment (Project FinOps tab)

This backend is used **only for the FinOps tab in the Project view**.

It queries **two monitoring endpoints**:
- the **OpenShift monitoring stack** (Thanos / cluster monitoring)
- a **custom Prometheus endpoint**, often exposed through an **OAuth proxy**

This makes it possible to build a single dashboard mixing **OpenShift metrics** and **custom metrics**.

### High-level flow

```text
+----------------------+
|   User Browser       |
|  (OpenShift Console) |
+----------+-----------+
           |
           | Console plugin API request
           v
+----------------------+
| OpenShift Console    |
| ConsolePlugin Proxy  |
+----------+-----------+
           |
           | internal cluster request
           v
+----------------------+
|  FinOps Backend      |
|  (Express service)   |
+----------+-----------+
           |
           | Prometheus API queries
           |
     +-----+--------------------+
     |                          |
     v                          v
+-------------+          +----------------+
| OpenShift   |          | Custom         |
| Monitoring  |          | Prometheus     |
| (Thanos)    |          | (via OAuth)    |
+-------------+          +----------------+

```

## Configure endpoints
Endpoints are configured through a ConfigMap so they can be updated without touching the code.

*05-finops-backend-config.yaml*
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: finops-backend-config
  namespace: finops-plugin
data:
  OPENSHIFT_PROM_URL: "https://thanos-querier.openshift-monitoring.svc:9091"
  CUSTOM_PROM_URL: "https://prom-oauth-proxy.custom-monitoring.svc:9091"
  INSECURE_SKIP_TLS_VERIFY: "true"
  HTTPS_PORT: "8443"
  TLS_CERT_PATH: "/var/run/tls/tls.crt"
  TLS_KEY_PATH: "/var/run/tls/tls.key"

```

INSECURE_SKIP_TLS_VERIFY=true is common when endpoints use an internal CA (reencrypt/service-serving certs).

Set it to "false" if your CA chain is trusted and correctly configured.

## Build & push the backend image


```bash
oc -n finops-plugin start-build finops-backend --follow
````

## Deploy backend

### 1) Apply ConfigMap + Service + Deployment
Apply the manifests in order:

```
oc apply -f 01-imagestream.yaml	
oc apply -f 02-buildconfig.yaml
oc apply -f 03-finops-backend.yaml	
oc apply -f 04-svc-finops-backend-https.yaml	
oc apply -f 05-finops-backend-config.yaml

```

## Updating endpoint variables (ConfigMap update)
```bash 
#Edit and apply
oc -n finops-plugin edit configmap finops-backend-config
# or update local file then:
oc apply -f configmap.yaml
#Then restart pods to pick up env changes:
oc -n finops-plugin rollout restart deploy/finops-backend
oc -n finops-plugin rollout status deploy/finops-backend

```

## Deploy the FinOPS Plugin 
Once the backend is running, redeploy the FinOps console plugin (see the main project README).