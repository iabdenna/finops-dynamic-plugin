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

  // ✅ REQUEST (memory) instead of LIMIT (memory)
  const requestQuery = `
max by (container) (
  kube_pod_container_resource_requests{
    namespace="${namespace}",
    pod=~"${podRegex}",
    resource="memory",
    container!="",
    container!="POD"
  }
) / 1024^3
`.trim();

  return { max7dQuery, currentQuery, requestQuery };
};

// PatternFly / OpenShift console theme tokens (work in light + dark)
const TOKENS = {
  bgCard: 'var(--pf-v5-global--BackgroundColor--100)',
  border: 'var(--pf-v5-global--BorderColor--100)',
  text: 'var(--pf-v5-global--Color--100)',
  textSecondary: 'var(--pf-v5-global--Color--200)',
  badgeBg: 'var(--pf-v5-global--BackgroundColor--200)',
  track: 'var(--pf-v5-global--BorderColor--200)',
};

const GREEN = '#3E8635';

/**
 * Donut:
 * - Center shows Max memory used (7d)
 * - Badge shows % used (max7d/request) if request exists, else "No request"
 * - Green dot when ratio is 0 and request exists
 * - Bottom: Request, Current, Over-reserved
 */
const Donut: React.FC<{
  usedRatio: number | null; // max7d/request
  maxText: string;
  currentText: string;
  requestText: string;
  overReservedText: string;
  hasRequest: boolean;
}> = ({ usedRatio, maxText, currentText, requestText, overReservedText, hasRequest }) => {
  const size = 200;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  const showProgress = hasRequest && usedRatio !== null && Number.isFinite(usedRatio);
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
            stroke={TOKENS.track}
            strokeWidth={stroke}
          />

          {/* green dot for 0 consumption (only meaningful when request exists) */}
          {showProgress && ratio === 0 && (
            <circle cx={size / 2} cy={stroke / 2} r={6} fill={GREEN} />
          )}

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
            color: TOKENS.text,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: TOKENS.textSecondary, letterSpacing: 0.2 }}>
            Max memory used (7d)
          </div>

          <div style={{ fontSize: 28, fontWeight: 800, color: TOKENS.text, lineHeight: 1 }}>
            {maxText}
          </div>

          <div
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              background: TOKENS.badgeBg,
              border: hasRequest ? `1px solid ${GREEN}` : `1px solid ${TOKENS.border}`,
              color: TOKENS.text,
              fontWeight: 700,
              fontSize: 12,
              minWidth: 95,
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            {hasRequest && usedRatio !== null ? `${pct(clamp01(usedRatio))}% used` : 'No request'}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 13, color: TOKENS.textSecondary }}>
        Request: <span style={{ color: TOKENS.text, fontWeight: 700 }}>{requestText}</span>
      </div>

      <div style={{ fontSize: 13, color: TOKENS.textSecondary }}>
        Current: <span style={{ color: TOKENS.text, fontWeight: 700 }}>{currentText}</span>
      </div>

      <div style={{ marginTop: 2, fontSize: 13, color: TOKENS.textSecondary }}>
        Over-reserved:{' '}
        <span style={{ fontWeight: 800, color: TOKENS.text }}>{overReservedText}</span>
      </div>
    </div>
  );
};

const FinOpsTab: React.FC<Props> = ({ obj }) => {
  const namespace = obj?.metadata?.namespace ?? '';
  const deploymentName = obj?.metadata?.name ?? '';

  const { max7dQuery, currentQuery, requestQuery } = React.useMemo(
    () => buildQueries(namespace, deploymentName),
    [namespace, deploymentName],
  );

  const [requestResp, requestError, requestLoading] = usePrometheusPoll({
    endpoint: PrometheusEndpoint.QUERY,
    query: requestQuery,
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

  const requests = React.useMemo(() => parsePrometheus(requestResp), [requestResp]);
  const max7d = React.useMemo(() => parsePrometheus(maxResp), [maxResp]);
  const current = React.useMemo(() => parsePrometheus(currentResp), [currentResp]);

  const rows = React.useMemo(() => {
    const requestBy = new Map<string, number>();
    requests.forEach((s) => requestBy.set(s.container, s.value));

    const maxBy = new Map<string, number>();
    max7d.forEach((s) => maxBy.set(s.container, s.value));

    const currentBy = new Map<string, number>();
    current.forEach((s) => currentBy.set(s.container, s.value));

    /**
     * Display rule:
     * - show if CURRENT exists (even 0.00 GiB)
     * - OR show if MAX7D > 0.00 GiB
     */
    const containers = Array.from(
      new Set([
        ...Array.from(currentBy.keys()),
        ...Array.from(maxBy.entries())
          .filter(([, v]) => Number.isFinite(v) && v > 0)
          .map(([c]) => c),
      ]),
    )
      .filter((c) => c && c !== 'POD')
      .sort();

    return containers.map((container) => {
      const requestGiB = requestBy.get(container) ?? null;
      const maxGiB = maxBy.get(container) ?? null;
      const currentGiB = currentBy.get(container) ?? null;

      const hasRequest = requestGiB !== null && requestGiB > 0;
      const usedRatio = hasRequest && maxGiB !== null ? maxGiB / (requestGiB as number) : null;

      const overReservedRatio =
        usedRatio !== null && Number.isFinite(usedRatio) ? Math.max(0, 1 - usedRatio) : null;

      const overReservedText =
        overReservedRatio !== null ? `${pct(overReservedRatio)}% over-reserved` : 'N/A';

      return {
        container,
        requestGiB,
        maxGiB,
        currentGiB,
        hasRequest,
        usedRatio,
        overReservedText,
      };
    });
  }, [requests, max7d, current]);

  const loading = requestLoading || maxLoading || currentLoading;
  const hasAnyError = Boolean(requestError || maxError || currentError);

  return (
    <div style={{ padding: 16, color: TOKENS.text }}>
      <h2 style={{ marginTop: 0, color: TOKENS.text }}>FinOps</h2>

      <div style={{ color: TOKENS.textSecondary, marginBottom: 12 }}>
        Deployment <b style={{ color: TOKENS.text }}>{deploymentName}</b> in namespace{' '}
        <b style={{ color: TOKENS.text }}>{namespace}</b>
      </div>

      {hasAnyError && rows.length === 0 && (
        <div style={{ color: 'var(--pf-v5-global--danger-color--100)', marginBottom: 12 }}>
          Prometheus query error
        </div>
      )}

      {loading ? (
        <div style={{ padding: 12, color: TOKENS.textSecondary }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={{ padding: 12, color: TOKENS.textSecondary }}>
          No data available for this Deployment
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
          {rows.map((r) => (
            <div
              key={r.container}
              style={{
                border: `1px solid ${TOKENS.border}`,
                borderRadius: 12,
                padding: 18,
                width: 380,
                background: TOKENS.bgCard,
                color: TOKENS.text,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14, color: TOKENS.text }}>
                Container: {r.container}
                {!r.hasRequest && (
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 12,
                      color: TOKENS.textSecondary,
                      fontWeight: 600,
                    }}
                  >
                    (No request set)
                  </span>
                )}
              </div>

              <Donut
                usedRatio={r.usedRatio}
                hasRequest={r.hasRequest}
                maxText={formatGiB(r.maxGiB)}
                currentText={formatGiB(r.currentGiB)}
                requestText={formatGiB(r.requestGiB)}
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
