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
  value: number; // GiB
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const pct = (x: number) => Math.round(x * 100);

const formatGiB = (gib: number | null) => {
  if (gib === null || !Number.isFinite(gib)) return 'N/A';
  return `${gib.toFixed(2)} GiB`;
};

const parsePrometheus = (resp?: PrometheusResponse): Series[] => {
  const results: any[] = (resp as any)?.data?.result ?? [];
  return results
    .map((r) => {
      const value = Number(r?.value?.[1]);
      if (!Number.isFinite(value)) return null;

      const container = r.metric?.container ?? '';
      if (!container || container === 'POD') return null;

      return { container, value };
    })
    .filter(Boolean) as Series[];
};

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Queries filtered to the current Deployment only (pod regex: <deployment>-.*).
 * Values returned in GiB.
 */
const buildQueries = (namespace: string, deploymentName: string) => {
  const podRegex = `${escapeRegex(deploymentName)}-.*`;

  const max7dQuery = `
max by (container) (
  max_over_time(
    container_memory_working_set_bytes{
      namespace="${namespace}",
      pod=~"${podRegex}",
      container!="",
      container!="POD"
    }[7d]
  )
) / 1024^3
`.trim();

  const currentQuery = `
max by (container) (
  container_memory_working_set_bytes{
    namespace="${namespace}",
    pod=~"${podRegex}",
    container!="",
    container!="POD"
  }
) / 1024^3
`.trim();

  const limitQuery = `
max by (container) (
  kube_pod_container_resource_limits{
    namespace="${namespace}",
    pod=~"${podRegex}",
    resource="memory",
    container!="",
    container!="POD"
  }
) / 1024^3
`.trim();

  return { max7dQuery, currentQuery, limitQuery };
};

/**
 * Donut:
 * - Center shows Max memory used (7d)
 * - Badge shows % used (max7d/limit) if limit exists
 * - Green dot when ratio is 0 and limit exists
 * - Bottom: Limit, Current, Over-reserved
 */
const Donut: React.FC<{
  usedRatio: number | null; // max7d/limit
  maxText: string;
  currentText: string;
  limitText: string;
  overReservedText: string;
  hasLimit: boolean;
}> = ({ usedRatio, maxText, currentText, limitText, overReservedText, hasLimit }) => {
  const size = 200;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  const GREEN = '#3E8635';

  const showProgress = hasLimit && usedRatio !== null && Number.isFinite(usedRatio);
  const ratio = showProgress ? clamp01(usedRatio as number) : 0;

  const dash = c * ratio;
  const gap = c - dash;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
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

          {/* green dot for 0 consumption (only meaningful when limit exists) */}
          {showProgress && ratio === 0 && <circle cx={size / 2} cy={stroke / 2} r={6} fill={GREEN} />}

          {/* progress (green) */}
          {showProgress && ratio > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={GREEN}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${gap}`}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          )}
        </svg>

        {/* center */}
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
            Max memory used (7d)
          </div>

          <div style={{ fontSize: 28, fontWeight: 800, color: '#151515', lineHeight: 1 }}>
            {maxText}
          </div>

          <div
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              background: '#f5f5f5',
              border: hasLimit ? `1px solid ${GREEN}` : '1px solid #d2d2d2',
              color: '#151515',
              fontWeight: 700,
              fontSize: 12,
              minWidth: 90,
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            {hasLimit && usedRatio !== null ? `${pct(clamp01(usedRatio))}% used` : 'No limit'}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 13, color: '#6a6e73' }}>
        Limit: <span style={{ color: '#151515', fontWeight: 700 }}>{limitText}</span>
      </div>

      <div style={{ fontSize: 13, color: '#6a6e73' }}>
        Current: <span style={{ color: '#151515', fontWeight: 700 }}>{currentText}</span>
      </div>

      <div style={{ marginTop: 2, fontSize: 13, color: '#6a6e73' }}>
        Over-reserved:{' '}
        <span style={{ fontWeight: 800, color: '#151515' }}>{overReservedText}</span>
      </div>
    </div>
  );
};

const FinOpsTab: React.FC<Props> = ({ obj }) => {
  const namespace = obj?.metadata?.namespace ?? '';
  const deploymentName = obj?.metadata?.name ?? '';

  const { max7dQuery, currentQuery, limitQuery } = React.useMemo(
    () => buildQueries(namespace, deploymentName),
    [namespace, deploymentName],
  );

  const [limitResp, limitError, limitLoading] = usePrometheusPoll({
    endpoint: PrometheusEndpoint.QUERY,
    query: limitQuery,
    namespace,
    delay: 60_000,
  });

  const [maxResp, maxError, maxLoading] = usePrometheusPoll({
    endpoint: PrometheusEndpoint.QUERY,
    query: max7dQuery,
    namespace,
    delay: 60_000,
  });

  const [currentResp, currentError, currentLoading] = usePrometheusPoll({
    endpoint: PrometheusEndpoint.QUERY,
    query: currentQuery,
    namespace,
    delay: 60_000,
  });

  const limits = React.useMemo(() => parsePrometheus(limitResp), [limitResp]);
  const max7d = React.useMemo(() => parsePrometheus(maxResp), [maxResp]);
  const current = React.useMemo(() => parsePrometheus(currentResp), [currentResp]);

  const rows = React.useMemo(() => {
    const limitBy = new Map<string, number>();
    limits.forEach((s) => limitBy.set(s.container, s.value));

    const maxBy = new Map<string, number>();
    max7d.forEach((s) => maxBy.set(s.container, s.value));

    const currentBy = new Map<string, number>();
    current.forEach((s) => currentBy.set(s.container, s.value));

    // ✅ Show a container if it has real usage metrics (current OR max7d),
    // even if usage is 0. This keeps running sidecars at 0.00 GiB.
    // Containers that never ran (no usage metrics) will not be shown.
    const containers = Array.from(new Set([...maxBy.keys(), ...currentBy.keys()]))
      .filter((c) => c && c !== 'POD')
      .sort();

    return containers.map((container) => {
      const limitGiB = limitBy.get(container) ?? null;
      const maxGiB = maxBy.get(container) ?? null;
      const currentGiB = currentBy.get(container) ?? null;

      const hasLimit = limitGiB !== null && limitGiB > 0;
      const usedRatio = hasLimit && maxGiB !== null ? maxGiB / (limitGiB as number) : null;

      const overReservedRatio =
        usedRatio !== null && Number.isFinite(usedRatio) ? Math.max(0, 1 - usedRatio) : null;

      const overReservedText =
        overReservedRatio !== null ? `${pct(overReservedRatio)}% over-reserved` : 'N/A';

      return {
        container,
        limitGiB,
        maxGiB,
        currentGiB,
        hasLimit,
        usedRatio,
        overReservedText,
      };
    });
  }, [limits, max7d, current]);

  const loading = limitLoading || maxLoading || currentLoading;
  const hasAnyError = Boolean(limitError || maxError || currentError);

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
          {rows.map((r) => (
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
                {!r.hasLimit && (
                  <span style={{ marginLeft: 8, fontSize: 12, color: '#6a6e73', fontWeight: 600 }}>
                    (No limit set)
                  </span>
                )}
              </div>

              <Donut
                usedRatio={r.usedRatio}
                hasLimit={r.hasLimit}
                maxText={formatGiB(r.maxGiB)}
                currentText={formatGiB(r.currentGiB)}
                limitText={formatGiB(r.limitGiB)}
                overReservedText={r.overReservedText}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FinOpsTab;
