import * as React from 'react';
import {
  usePrometheusPoll,
  PrometheusEndpoint,
  type PrometheusResponse,
} from '@openshift-console/dynamic-plugin-sdk';

/**
 * Props injectées automatiquement par la console
 */
type K8sObject = {
  metadata?: {
    name?: string;
    namespace?: string;
  };
};

type Props = {
  obj?: K8sObject;
};

type Series = {
  container: string;
  workload: string;
  workload_type: string;
  value: number;
};

/**
 * PromQL queries (basées exactement sur celles que tu as fournies)
 */
const buildQueries = (namespace: string) => {
  const limitQuery = `
max by (container, namespace, workload_type, workload) (
  kube_pod_container_resource_limits{resource="memory", namespace='${namespace}'}
  * on(namespace, pod) group_left(workload, workload_type)
  namespace_workload_pod:kube_pod_owner:relabel{
    namespace='${namespace}',
    workload_type=~'deployment|statefulset|daemonset'
  }
)
`.trim();

  const usageQuery = `
max by (container, namespace, workload_type, workload) (
  max_over_time(
    container_memory_working_set_bytes{
      namespace='${namespace}',
      container!="",
      container!="POD"
    }[7d]
  )
  * on(namespace, pod) group_left(workload, workload_type)
  namespace_workload_pod:kube_pod_owner:relabel{
    namespace='${namespace}',
    workload_type=~'deployment|statefulset|daemonset'
  }
)
`.trim();

  return { limitQuery, usageQuery };
};

/**
 * Parse réponse Prometheus
 */
const parsePrometheus = (resp?: PrometheusResponse): Series[] => {
  const results: any[] = (resp as any)?.data?.result ?? [];

  return results
    .map((r) => {
      const value = Number(r?.value?.[1]);
      if (!Number.isFinite(value)) return null;

      return {
        container: r.metric?.container ?? '',
        workload: r.metric?.workload ?? '',
        workload_type: r.metric?.workload_type ?? '',
        value,
      };
    })
    .filter(Boolean) as Series[];
};

const bytesToGiB = (b: number) => b / (1024 ** 3);

/**
 * FinOps tab component
 */
const FinOpsTab: React.FC<Props> = ({ obj }) => {
  const namespace = obj?.metadata?.namespace ?? '';
  const deploymentName = obj?.metadata?.name ?? '';

  const { limitQuery, usageQuery } = React.useMemo(
    () => buildQueries(namespace),
    [namespace],
  );

  const [limitResp, limitError, limitLoading] = usePrometheusPoll({
    endpoint: PrometheusEndpoint.QUERY,
    query: limitQuery,
    namespace,
    delay: 30_000,
  });

  const [usageResp, usageError, usageLoading] = usePrometheusPoll({
    endpoint: PrometheusEndpoint.QUERY,
    query: usageQuery,
    namespace,
    delay: 30_000,
  });

  /**
   * Filter uniquement sur le Deployment courant
   */
  const limits = React.useMemo(
    () =>
      parsePrometheus(limitResp).filter(
        (s) =>
          s.workload_type === 'deployment' &&
          s.workload === deploymentName,
      ),
    [limitResp, deploymentName],
  );

  const usage = React.useMemo(
    () =>
      parsePrometheus(usageResp).filter(
        (s) =>
          s.workload_type === 'deployment' &&
          s.workload === deploymentName,
      ),
    [usageResp, deploymentName],
  );

  /**
   * Join limit + usage par container
   */
  const rows = React.useMemo(() => {
    const limitByContainer = new Map<string, number>();
    limits.forEach((l) => limitByContainer.set(l.container, l.value));

    const usageByContainer = new Map<string, number>();
    usage.forEach((u) => usageByContainer.set(u.container, u.value));

    const containers = Array.from(
      new Set([
        ...Array.from(limitByContainer.keys()),
        ...Array.from(usageByContainer.keys()),
      ]),
    ).sort();

    return containers.map((container) => ({
      container,
      limitGiB: limitByContainer.has(container)
        ? bytesToGiB(limitByContainer.get(container)!)
        : null,
      usageGiB: usageByContainer.has(container)
        ? bytesToGiB(usageByContainer.get(container)!)
        : null,
    }));
  }, [limits, usage]);

  const loading = limitLoading || usageLoading;
  const error = limitError || usageError;

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>FinOps</h2>

      <div style={{ color: '#6a6e73', marginBottom: 12 }}>
        Deployment <b>{deploymentName}</b> in namespace <b>{namespace}</b>
      </div>

      {error && (
        <div style={{ color: '#c9190b', marginBottom: 12 }}>
          Error querying Prometheus: {String(error)}
        </div>
      )}

      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          border: '1px solid #d2d2d2',
        }}
      >
        <thead style={{ background: '#f5f5f5' }}>
          <tr>
            <th style={{ padding: 8, textAlign: 'left' }}>Container</th>
            <th style={{ padding: 8, textAlign: 'right' }}>
              Max memory limit (GiB)
            </th>
            <th style={{ padding: 8, textAlign: 'right' }}>
              Max memory usage (7d) (GiB)
            </th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={3} style={{ padding: 12 }}>
                Loading…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={3} style={{ padding: 12 }}>
                No data available for this Deployment
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.container}>
                <td style={{ padding: 8, borderTop: '1px solid #eee' }}>
                  {r.container || '(empty)'}
                </td>
                <td
                  style={{
                    padding: 8,
                    borderTop: '1px solid #eee',
                    textAlign: 'right',
                  }}
                >
                  {r.limitGiB !== null
                    ? r.limitGiB.toFixed(2)
                    : 'N/A'}
                </td>
                <td
                  style={{
                    padding: 8,
                    borderTop: '1px solid #eee',
                    textAlign: 'right',
                  }}
                >
                  {r.usageGiB !== null
                    ? r.usageGiB.toFixed(2)
                    : 'N/A'}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default FinOpsTab;
