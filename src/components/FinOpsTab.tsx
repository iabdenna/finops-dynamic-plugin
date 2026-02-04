import * as React from 'react';
import {
  usePrometheusPoll,
  PrometheusEndpoint,
  type PrometheusResponse,
} from '@openshift-console/dynamic-plugin-sdk';

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

const buildQueries = (namespace: string) => {
  const limitQuery = `
max by (container, namespace, workload_type, workload) (
  kube_pod_container_resource_limits{resource="memory", namespace="${namespace}", container!=""}
  * on(namespace, pod) group_left(workload, workload_type)
  namespace_workload_pod:kube_pod_owner:relabel{
    namespace="${namespace}",
    workload_type=~"deployment|statefulset|daemonset"
  }
)
`.trim();

  const usageQuery = `
max by (container, namespace, workload_type, workload) (
  max_over_time(
    container_memory_working_set_bytes{
      namespace="${namespace}",
      container!="",
      container!="POD"
    }[7d]
  )
  * on(namespace, pod) group_left(workload, workload_type)
  namespace_workload_pod:kube_pod_owner:relabel{
    namespace="${namespace}",
    workload_type=~"deployment|statefulset|daemonset"
  }
)
`.trim();

  return { limitQuery, usageQuery };
};

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
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

const getRatioColor = (ratio: number | null) => {
  if (ratio === null) return '#6a6e73'; // grey
  if (ratio >= 0.9) return '#c9190b'; // red
  if (ratio >= 0.7) return '#f0ab00'; // orange
  return '#3e8635'; // green
};

const getStatusLabel = (ratio: number | null) => {
  if (ratio === null) return { text: 'N/A', color: '#6a6e73' };
  if (ratio >= 0.9) return { text: 'CRITICAL', color: '#c9190b' };
  if (ratio >= 0.7) return { text: 'WARNING', color: '#f0ab00' };
  return { text: 'OK', color: '#3e8635' };
};

/**
 * Bigger, clearer donut card
 * - Donut shows usage/limit
 * - Center: usage GiB
 * - Badge: percentage
 * - Below: limit GiB + status
 */
const Donut: React.FC<{
  percent: number; // 0..1
  color: string;
  usageGiBText: string;
  limitGiBText: string;
  percentText: string; // e.g. "65%"
  statusText: string;
  statusColor: string;
}> = ({ percent, color, usageGiBText, limitGiBText, percentText, statusText, statusColor }) => {
  const size = 200;   // 👈 larger
  const stroke = 18;  // 👈 thicker
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * clamp01(percent);
  const gap = c - dash;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#d2d2d2"
            strokeWidth={stroke}
          />
          {/* progress */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${gap}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>

        {/* center content */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 800, color: '#151515' }}>
            {usageGiBText}
          </div>

          <div
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              background: '#f5f5f5',
              border: `1px solid ${color}`,
              color,
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            {percentText}
          </div>
        </div>
      </div>

      {/* Bottom details */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div style={{ fontSize: 14, color: '#6a6e73' }}>
          Limit: <span style={{ color: '#151515', fontWeight: 700 }}>{limitGiBText}</span>
        </div>

        <div
          style={{
            padding: '2px 10px',
            borderRadius: 999,
            background: '#ffffff',
            border: `1px solid ${statusColor}`,
            color: statusColor,
            fontWeight: 800,
            fontSize: 12,
            letterSpacing: 0.4,
          }}
        >
          {statusText}
        </div>
      </div>
    </div>
  );
};

const FinOpsTab: React.FC<Props> = ({ obj }) => {
  const namespace = obj?.metadata?.namespace ?? '';
  const deploymentName = obj?.metadata?.name ?? '';

  const { limitQuery, usageQuery } = React.useMemo(() => buildQueries(namespace), [namespace]);

  const [limitResp, limitError, limitLoading] = usePrometheusPoll({
    endpoint: PrometheusEndpoint.QUERY,
    query: limitQuery,
    namespace,
    delay: 60_000,
  });

  const [usageResp, usageError, usageLoading] = usePrometheusPoll({
    endpoint: PrometheusEndpoint.QUERY,
    query: usageQuery,
    namespace,
    delay: 60_000,
  });

  // Filter on current deployment
  const limits = React.useMemo(
    () =>
      parsePrometheus(limitResp).filter(
        (s) => s.workload_type === 'deployment' && s.workload === deploymentName,
      ),
    [limitResp, deploymentName],
  );

  const usage = React.useMemo(
    () =>
      parsePrometheus(usageResp).filter(
        (s) => s.workload_type === 'deployment' && s.workload === deploymentName,
      ),
    [usageResp, deploymentName],
  );

  const rows = React.useMemo(() => {
    const limitBy = new Map<string, number>();
    limits.forEach((l) => limitBy.set(l.container, l.value));

    const usageBy = new Map<string, number>();
    usage.forEach((u) => usageBy.set(u.container, u.value));

    const containers = Array.from(new Set([...limitBy.keys(), ...usageBy.keys()])).sort();

    return containers.map((container) => {
      const limitBytes = limitBy.get(container);
      const usageBytes = usageBy.get(container);

      const limitGiB = limitBytes !== undefined ? bytesToGiB(limitBytes) : null;
      const usageGiB = usageBytes !== undefined ? bytesToGiB(usageBytes) : null;

      const ratio =
        usageGiB !== null && limitGiB !== null && limitGiB > 0 ? usageGiB / limitGiB : null;

      return { container, limitGiB, usageGiB, ratio };
    });
  }, [limits, usage]);

  const loading = limitLoading || usageLoading;
  const hasAnyError = Boolean(limitError || usageError);

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>FinOps</h2>

      <div style={{ color: '#6a6e73', marginBottom: 12 }}>
        Deployment <b>{deploymentName}</b> in namespace <b>{namespace}</b>
      </div>

      {hasAnyError && rows.length === 0 && (
        <div style={{ color: '#c9190b', marginBottom: 12 }}>
          Prometheus query error
        </div>
      )}

      {loading ? (
        <div style={{ padding: 12 }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={{ padding: 12 }}>No data available for this Deployment</div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 24,
            alignItems: 'flex-start',
          }}
        >
          {rows.map((r) => {
            const percent = r.ratio === null ? 0 : clamp01(r.ratio);
            const color = getRatioColor(r.ratio);
            const status = getStatusLabel(r.ratio);

            const usageText = r.usageGiB !== null ? `${r.usageGiB.toFixed(2)} GiB` : 'N/A';
            const limitText = r.limitGiB !== null ? `${r.limitGiB.toFixed(2)} GiB` : 'N/A';
            const pctText = r.ratio !== null ? `${Math.round(r.ratio * 100)}%` : 'N/A';

            return (
              <div
                key={r.container}
                style={{
                  border: '1px solid #d2d2d2',
                  borderRadius: 12,
                  padding: 18,
                  minWidth: 340,       // 👈 bigger card
                  background: '#fff',
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14, color: '#151515' }}>
                  {r.container}
                </div>

                <Donut
                  percent={percent}
                  color={color}
                  usageGiBText={usageText}
                  limitGiBText={limitText}
                  percentText={pctText}
                  statusText={status.text}
                  statusColor={status.color}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FinOpsTab;
