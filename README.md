# FinOps OpenShift Console Plugin

## Overview
This project provides a custom OpenShift Console dynamic plugin that adds a FinOps tab to the Deployment details page.

The FinOps tab helps visualize memory efficiency by comparing configured memory limits with actual memory usage (maximum over the last 7 days).

The information is displayed using a donut visualization (usage vs limit) with clear FinOps status indicators:
- OK: usage below 70%
- WARNING: usage greater than or equal to 70%
- CRITICAL: usage greater than or equal to 90%

The plugin is built using the OpenShift Dynamic Plugin SDK and is deployed natively on OpenShift using BuildConfig, ImageStream, Helm and ConsolePlugin.

---

## Plugin Added

### FinOps tab on Deployment details

The plugin adds a new FinOps tab available at:

Workloads → Deployments → <deployment> → FinOps

For each container in the Deployment, the tab displays:
- Memory usage in GiB
- Memory limit in GiB
- Usage percentage
- Status (OK / WARNING / CRITICAL)
- A donut visualization showing usage versus limit

---


## Prerequisites

Before deploying the plugin, you must have:
- Node.js installed
- **Yarn** installed

```bash
  node --version
  yarn --version
 ```
- Access to an OpenShift cluster
- **oc CLI** installed and logged into the cluster
- Permissions to create ImageStream, BuildConfig, Helm releases and ConsolePlugin resources

You must be logged into the cluster using oc login.

---

## Initial Deployment

1. Install dependencies and build the frontend assets using Yarn.

```bash
yarn install  
yarn build  
```
This generates the frontend bundle in the dist directory.

2. Configure an ImageStream named finops-console-plugin in **the namespace finops-plugin**.

 ```bash
oc apply -f buildconfig/buildconfig.yaml
oc apply -f buildconfig/imagestream.yaml
 ```


3. Once the ImageStream and BuildConfig are created, build and push the image to the internal OpenShift registry by running:
 ```bash
oc -n finops-plugin start-build finops-console-plugin --from-dir=. --follow
 ```

4. Deploy the plugin using Helm:

 ```bash
helm upgrade finops-plugin charts/openshift-console-plugin \
  -n finops-plugin \
  --set plugin.image=image-registry.openshift-image-registry.svc:5000/finops-plugin/finops-console-plugin:0.0.2
 ```

---

## Verification

Open the OpenShift Console and navigate to:

Workloads → Deployments → select a Deployment → FinOps tab

The FinOps dashboard should now be visible.

---

## Updating the FinOps Dashboard

OpenShift Console plugins are heavily cached. To update the dashboard, all the following steps are mandatory.

1. Modify the dashboard code in src/components/FinOpsTab.tsx

2. Update the plugin version in package.json. Example
```json
{
  "version": "0.0.2",
  "consolePlugin": {
    "name": "finops-plugin",
    "version": "0.0.2"
  }
}
```

3. Rebuild the frontend assets by running 

 ```bash
yarn build
 ```

4. Rebuild the image using the existing BuildConfig:
 ```bash
oc -n finops-plugin start-build finops-console-plugin --from-dir=. --follow
 ```

5. Tag the image with the new version to force OpenShift to detect a new image:

 ```bash
oc -n finops-plugin tag finops-console-plugin:latest finops-console-plugin:0.0.2
 ```

6. Deploy the new image using Helm, referencing the new tag:

 ```bash
helm upgrade finops-plugin charts/openshift-console-plugin \
  -n finops-plugin \
  --set plugin.image=image-registry.openshift-image-registry.svc:5000/finops-plugin/finops-console-plugin:0.0.2
 ```

7. force the OpenShift Console to reload by doing a hard refresh (Ctrl + Shift + R).

---

## Validation After Update

In the OpenShift Console, go to ConsolePlugins, select finops-plugin, and check the Plugin manifest. The version displayed must match the updated version (for example, 0.0.2).

---

## Common Pitfalls

Rebuilding the image without updating the plugin version will result in the old plugin still being loaded.  
Reusing the same image tag without forcing a rollout will prevent the console from picking up changes.  
Browser cache must be cleared or bypassed to load the new frontend bundle.

---

## Maintainer

**Ikram Abdennadher**  
OpenShift Consultant – Red Hat  
Email: iabdenna@redhat.com

