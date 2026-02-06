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
  pod: string; // 👈 NEW (for tooltip)
  workload: string;
  workload_type: string;
  value: number;
};

const buildQueries = (namespace: string) => {
  // Max memory limit per container/workload in namespace (bytes)
  const limitQuery = `
max by (container, namespace, workload_type, workload) (
  kube_pod_container_resource_limits{
    resource="memory",
    namespace="${namespace}",
    container!="",
    container!="POD"
  }
  * on(namespace, pod) group_left(workload, workload_type)
  namespace_workload_pod:kube_pod_owner:relabel{
    namespace="${namespace}",
    workload_type=~"deployment|statefulset|daemonset"
  }
)
`.trim();

  // Max memory usage over 7 days per container/workload in namespace (GiB),
  // AND keep the "winner pod" label per (container,workload) group.
  //
  // IMPORTANT: `topk by (...) (1, <vector>)` returns the top1 series per group,
  // preserving the original labels of that winning series (including `pod`).
  const usageQuery = `
topk by (container, namespace, workload_type, workload) (1,
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
) / 1024^3
`.trim();

  return { limitQuery, usageQuery };
};

const parsePrometheus = (resp?: PrometheusResponse): Series[] => {
  const results: any[] = (resp as any)?.data?.result ?? [];
  return results
    .map((r) => {
      const value = Number(r?.value?.[1]);
      if (!Number.isFinite(value)) return null;

      const container = r.metric?.container ?? '';
      const pod = r.metric?.pod ?? '';

      // extra safety: avoid empty / POD containers
      if (!container || container === 'POD') return null;

      return {
        container,
        pod,
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
 * Donut card
 * - Center label: "Max memory used (7d)"
 * - Center value: usage (GiB) OR N/A
 * - Percentage shown only when usage + limit exist
 * - Progress arc hidden when ratio not available (avoids the "dot" effect)
 * - Tooltip shows winner pod name (ultra clean)
 */
const Donut: React.FC<{
  percent: number; // 0..1
  showProgress: boolean;
  color: string;
  subtitleText: string;
  valueText: string;
  percentText: string;
  limitText: string;
  statusText: string;
  statusColor: string;
  tooltip: string; // 👈 NEW
}> = ({
  percent,
  showProgress,
  color,
  subtitleText,
  valueText,
  percentText,
  limitText,
  statusText,
  statusColor,
  tooltip,
}) => {
  const size = 200;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * clamp01(percent);
  const gap = c - dash;

  return (
    <div
      title={tooltip}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}
    >
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
          {showProgress && percent > 0 && (
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
          )}
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
            gap: 6,
            textAlign: 'center',
            padding: '0 12px',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6a6e73', letterSpacing: 0.2 }}>
            {subtitleText}
          </div>

          <div style={{ fontSize: 28, fontWeight: 800, color: '#151515', lineHeight: 1 }}>
            {valueText}
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
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 44,
            }}
          >
            {percentText}
          </div>
        </div>
      </div>

      {/* Bottom details */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div style={{ fontSize: 14, color: '#6a6e73' }}>
          Limit: <span style={{ color: '#151515', fontWeight: 700 }}>{limitText}</span>
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
  const limits = React.useMemo(() => {
    return parsePrometheus(limitResp).filter(
      (s) => s.workload_type === 'deployment' && s.workload === deploymentName,
    );
  }, [limitResp, deploymentName]);

  const usage = React.useMemo(() => {
    return parsePrometheus(usageResp).filter(
      (s) => s.workload_type === 'deployment' && s.workload === deploymentName,
    );
  }, [usageResp, deploymentName]);

  const rows = React.useMemo(() => {
    // limits: bytes
    const limitBy = new Map<string, number>();
    limits.forEach((l) => limitBy.set(l.container, l.value));

    // usage: GiB (query already / 1024^3) + pod label
    const usageBy = new Map<string, { gib: number; pod: string }>();
    usage.forEach((u) => usageBy.set(u.container, { gib: u.value, pod: u.pod }));

    const containers = Array.from(new Set([...limitBy.keys(), ...usageBy.keys()]))
      .filter((c) => c && c !== 'POD')
      .sort();

    return containers.map((container) => {
      const limitBytes = limitBy.get(container);
      const usageEntry = usageBy.get(container);

      const limitGiB = limitBytes !== undefined ? bytesToGiB(limitBytes) : null;
      const usageGiB = usageEntry ? usageEntry.gib : null;
      const pod = usageEntry?.pod ?? '';

      const ratio =
        usageGiB !== null && limitGiB !== null && limitGiB > 0 ? usageGiB / limitGiB : null;

      return { container, limitGiB, usageGiB, ratio, pod };
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
        <div style={{ color: '#c9190b', marginBottom: 12 }}>Prometheus query error</div>
      )}

      {loading ? (
        <div style={{ padding: 12 }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={{ padding: 12 }}>No data available for this Deployment</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
          {rows.map((r) => {
            const noUsage = r.usageGiB === null;
            const noLimit = r.limitGiB === null;

            const subtitle =
              noUsage
                ? 'No usage data (7d)'
                : noLimit
                  ? 'Max memory used (7d) • No limit set'
                  : 'Max memory used (7d)';

            const canComputeRatio = !noUsage && !noLimit && r.ratio !== null;

            const percent = canComputeRatio ? clamp01(r.ratio as number) : 0;
            const color = getRatioColor(canComputeRatio ? (r.ratio as number) : null);
            const status = getStatusLabel(canComputeRatio ? (r.ratio as number) : null);

            const valueText = !noUsage ? `${(r.usageGiB as number).toFixed(2)} GiB` : 'N/A';
            const limitText = !noLimit ? `${(r.limitGiB as number).toFixed(2)} GiB` : 'N/A';
            const percentText = canComputeRatio ? `${Math.round((r.ratio as number) * 100)}%` : 'N/A';

            const tooltipLines: string[] = [];
            tooltipLines.push('Max memory used over last 7 days');
            tooltipLines.push(`Container: ${r.container}`);
            if (r.pod) tooltipLines.push(`Pod: ${r.pod}`);
            if (!r.pod && !noUsage) tooltipLines.push('Pod: (not available)');
            const tooltip = tooltipLines.join('\n');

            return (
              <div
                key={r.container}
                style={{
                  border: '1px solid #d2d2d2',
                  borderRadius: 12,
                  padding: 18,
                  minWidth: 340,
                  background: '#fff',
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14, color: '#151515' }}>
                  {r.container}
                </div>

                <Donut
                  percent={percent}
                  showProgress={canComputeRatio}
                  color={color}
                  subtitleText={subtitle}
                  valueText={valueText}
                  percentText={percentText}
                  limitText={limitText}
                  statusText={status.text}
                  statusColor={status.color}
                  tooltip={tooltip}
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
