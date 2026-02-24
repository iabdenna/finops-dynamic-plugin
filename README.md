# OpenShift FinOps Dynamic Plugin

A custom OpenShift Console dynamic plugin that provides FinOps visibility at workload level (Deployment, StatefulSet, DaemonSet).

The plugin introduces a dedicated FinOps tab that assesses resource efficiency by comparing configured **resource requests** against the **peak usage observed over the past 7 days**.

This financial-first approach enables:

- Clear detection of over-reserved capacity

- Identification of cost optimization opportunities

- Data-driven right-sizing strategies

- Improved infrastructure cost governance



## Finops Analytics

For each container:

- Max memory & CPU used (7d) → real peaks detected by Prometheus

- Current memory & CPU usage

- Memory request & CPU request

- Over-reserved percentage

- Visual donuts representing:
Max (7d) / Request


## Configurable Threshold Colors
This allows non-developers to enable/disable donut coloring and modify threshold.

The donut color logic is externally configurable via:
```bash
src/finops-settings.json

```
Example:

```json

{
  "enableThresholdColors": true,
  "thresholds": {
    "redBelow": 0.1,
    "yellowBelow": 0.5
  },
  "colors": {
    "green": "#3E8635",
    "yellow": "#F0AB00",
    "red": "#C9190B"
  }
}


```
**Behavior**

If enabled:

🔴 Red → usage < 10%

🟡 Yellow → usage < 50%

🟢 Green → usage ≥ 50%


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



## Verification

Open the OpenShift Console and navigate to:

Workloads → Deployments → select a Deployment → FinOps tab

The FinOps dashboard should now be visible.


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

7. Force the OpenShift Console to reload by doing a hard refresh (Ctrl + Shift + R).



## Validation After Update

In the OpenShift Console, go to ConsolePlugins, select finops-plugin, and check the Plugin manifest. The version displayed must match the updated version (for example, 0.0.2).

---

## Notes

Rebuilding the image without updating the plugin version will result in the old plugin still being loaded.  
Reusing the same image tag without forcing a rollout will prevent the console from picking up changes.  
Browser cache must be cleared or bypassed to load the new frontend bundle.

---

## Maintainer

**Ikram Abdennadher**  
OpenShift Consultant – Red Hat  
Email: iabdenna@redhat.com

