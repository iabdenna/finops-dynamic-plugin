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

  // Max memory usage over 7 days per container/workload (GiB)
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
      if (!container || container === 'POD') return null;

      return {
        container,
        workload: r.metric?.workload ?? '',
        workload_type: r.metric?.workload_type ?? '',
        value,
      };
    })
    .filter(Boolean) as Series[];
};

const bytesToGiB = (b: number) => b / (1024 ** 3);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

const GiB_TO_MiB = 1024;

const formatGiBOrMiB = (gib: number) => {
  if (!Number.isFinite(gib)) return 'N/A';
  const mib = gib * GiB_TO_MiB;

  if (mib > 0 && mib < 1) return '<1 MiB';
  if (gib < 0.01) return `${Math.round(mib)} MiB`;
  return `${gib.toFixed(2)} GiB`;
};

/**
 * FinOps sizing label (focus: over-reservation)
 * usageRatio = usage/limit
 */
const getSizingLabelFinOps = (usageRatio: number | null) => {
  if (usageRatio === null) return { text: 'N/A', color: '#6a6e73' };

  if (usageRatio < 0.2) return { text: 'Heavily over-reserved', color: '#004080' };
  if (usageRatio < 0.4) return { text: 'Over-reserved', color: '#f0ab00' };
  if (usageRatio < 0.8) return { text: 'Well sized', color: '#3e8635' };
  return { text: 'At risk (close to limit)', color: '#c9190b' };
};

/**
 * Donut card
 * - Center: Max memory used (7d)
 * - Badge: % used (usage/limit)
 * - Below: Limit
 */
const Donut: React.FC<{
  percent: number; // 0..1 used
  showProgress: boolean;
  color: string;
  subtitleText: string;
  valueText: string;
  percentText: string;
  limitText: string;
}> = ({ percent, showProgress, color, subtitleText, valueText, percentText, limitText }) => {
  const size = 200;
  const stroke = 18;
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
              minWidth: 64,
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            {percentText}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 14, color: '#6a6e73' }}>
        Limit: <span style={{ color: '#151515', fontWeight: 700 }}>{limitText}</span>
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

    // usage: GiB
    const usageBy = new Map<string, number>();
    usage.forEach((u) => usageBy.set(u.container, u.value));

    const containers = Array.from(new Set([...limitBy.keys(), ...usageBy.keys()]))
      .filter((c) => c && c !== 'POD')
      .sort();

    return containers.map((container) => {
      const limitBytes = limitBy.get(container);
      const usageGiBFromQuery = usageBy.get(container);

      const limitGiB = limitBytes !== undefined ? bytesToGiB(limitBytes) : null;
      const usageGiB = usageGiBFromQuery !== undefined ? usageGiBFromQuery : null;

      const usageRatio =
        usageGiB !== null && limitGiB !== null && limitGiB > 0 ? usageGiB / limitGiB : null;

      const overReserved = usageRatio !== null ? Math.max(0, 1 - usageRatio) : null;

      return { container, limitGiB, usageGiB, usageRatio, overReserved };
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

            const canComputeRatio = !noUsage && !noLimit && r.usageRatio !== null;

            const percentUsed = canComputeRatio ? clamp01(r.usageRatio as number) : 0;

            const donutColor = canComputeRatio
              ? (r.usageRatio as number) >= 0.9
                ? '#c9190b'
                : (r.usageRatio as number) >= 0.7
                  ? '#f0ab00'
                  : '#3e8635'
              : '#6a6e73';

            const sizing = getSizingLabelFinOps(canComputeRatio ? (r.usageRatio as number) : null);

            const valueText = !noUsage ? formatGiBOrMiB(r.usageGiB as number) : 'N/A';
            const limitText = !noLimit ? formatGiBOrMiB(r.limitGiB as number) : 'N/A';

            const usedPctText = canComputeRatio
              ? `${Math.round((r.usageRatio as number) * 100)}% used`
              : 'N/A';

            const overReservedText =
              canComputeRatio && r.overReserved !== null
                ? `${Math.round(r.overReserved * 100)}% over-reserved`
                : 'Over-reserved: N/A';

            return (
              <div
                key={r.container}
                style={{
                  border: '1px solid #d2d2d2',
                  borderRadius: 12,
                  padding: 18,
                  width: 380,
                  background: '#fff',
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14, color: '#151515' }}>
                  Container: {r.container}
                </div>

                <Donut
                  percent={percentUsed}
                  showProgress={canComputeRatio}
                  color={donutColor}
                  subtitleText={subtitle}
                  valueText={valueText}
                  percentText={usedPctText}
                  limitText={limitText}
                />

                {/* FinOps focus */}
                <div
                  style={{
                    marginTop: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    alignItems: 'center',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      padding: '2px 10px',
                      borderRadius: 999,
                      background: '#ffffff',
                      border: `1px solid ${sizing.color}`,
                      color: sizing.color,
                      fontWeight: 800,
                      fontSize: 12,
                      letterSpacing: 0.2,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {sizing.text}
                  </div>

                  <div style={{ fontSize: 13, color: '#6a6e73' }}>{overReservedText}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FinOpsTab;
