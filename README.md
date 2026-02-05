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

## Prometheus Metrics Used

The dashboard relies on the following Prometheus metrics:
- kube_pod_container_resource_limits
- container_memory_working_set_bytes

Memory usage is calculated as the maximum value over the last 7 days.

---

## Prerequisites

Before deploying the plugin, you must have:
- Node.js installed
- Yarn installed
- Access to an OpenShift cluster
- oc CLI installed and logged into the cluster
- Permissions to create ImageStream, BuildConfig, Helm releases and ConsolePlugin resources

You must be logged into the cluster using oc login.

---

## Project Structure

src/components/FinOpsTab.tsx contains the FinOps dashboard implementation  
dist contains the built frontend assets  
Dockerfile is used to build the plugin image  
package.json defines the plugin metadata and version  
helm/openshift-console-plugin contains the Helm chart used for deployment  

---

## Initial Deployment

First, install dependencies and build the frontend assets using Yarn.

Run: yarn install  
Then run: yarn build  

This generates the frontend bundle in the dist directory.

Next, configure an ImageStream named finops-console-plugin in the namespace finops-plugin.

Then configure a BuildConfig using a binary source and the Dockerfile. The BuildConfig outputs the image to the ImageStream tag finops-console-plugin:latest.

Once the ImageStream and BuildConfig are created, build and push the image to the internal OpenShift registry by running:

oc -n finops-plugin start-build finops-console-plugin --from-dir=. --follow

After the image is built, deploy the plugin using Helm:

helm upgrade -i finops-plugin helm/openshift-console-plugin -n finops-plugin --create-namespace --set plugin.image=image-registry.openshift-image-registry.svc:5000/finops-plugin/finops-console-plugin:latest

Then enable the plugin in the OpenShift Console by editing the Console Operator configuration:

oc edit console.operator.openshift.io cluster

Under spec.plugins, add finops-plugin.

Save and exit.

---

## Verification

Open the OpenShift Console and navigate to:

Workloads → Deployments → select a Deployment → FinOps tab

The FinOps dashboard should now be visible.

---

## Updating the FinOps Dashboard

OpenShift Console plugins are heavily cached. To update the dashboard, all the following steps are mandatory.

First, modify the dashboard code in src/components/FinOpsTab.tsx.

After any frontend change, update the plugin version in package.json. Both the top-level version and consolePlugin.version must be updated. For example, change the version from 0.0.1 to 0.0.2.

Next, rebuild the frontend assets by running yarn build.

Then rebuild the image using the existing BuildConfig:

oc -n finops-plugin start-build finops-console-plugin --from-dir=. --follow

After the build completes, tag the image with the new version to force OpenShift to detect a new image:

oc -n finops-plugin tag finops-console-plugin:latest finops-console-plugin:0.0.2

Deploy the new image using Helm, referencing the new tag:

helm upgrade finops-plugin helm/openshift-console-plugin -n finops-plugin --set plugin.image=image-registry.openshift-image-registry.svc:5000/finops-plugin/finops-console-plugin:0.0.2

Finally, force the OpenShift Console to reload by doing a hard refresh (Ctrl + Shift + R) or opening the console in a private or incognito browser window.

---

## Validation After Update

In the OpenShift Console, go to ConsolePlugins, select finops-plugin, and check the Plugin manifest. The version displayed must match the updated version (for example, 0.0.2).

---

## Common Pitfalls

Rebuilding the image without updating the plugin version will result in the old plugin still being loaded.  
Reusing the same image tag without forcing a rollout will prevent the console from picking up changes.  
Browser cache must be cleared or bypassed to load the new frontend bundle.

---

## Deployment Summary

To deploy or update the FinOps plugin:
1. Modify the frontend code
2. Update the plugin version in package.json
3. Run yarn build
4. Run oc start-build
5. Tag the image with a new version
6. Deploy with helm upgrade
7. Reload the OpenShift Console

---

## License

Internal / Proof of Concept
