import * as React from 'react';
import {
  usePrometheusPoll,
  PrometheusEndpoint,
  type PrometheusResponse,
} from '@openshift-console/dynamic-plugin-sdk';

import settings from '../finops-settings.json';

type K8sObject = {
  kind?: string;
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

/* ================= Utilities ================= */

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

/* ================= Prometheus Queries ================= */

const buildQueries = (namespace: string, workloadName: string) => {
  const podRegex = `${escapeRegex(workloadName)}-.*`;

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

/* ================= Theme Tokens ================= */

const TOKENS = {
  bgCard: 'var(--pf-v5-global--BackgroundColor--100)',
  border: 'var(--pf-v5-global--BorderColor--100)',
  text: 'var(--pf-v5-global--Color--100)',
  textSecondary: 'var(--pf-v5-global--Color--200)',
  badgeBg: 'var(--pf-v5-global--BackgroundColor--200)',
  track: 'var(--pf-v5-global--BorderColor--200)',
};

/* ================= Color Logic (from JSON) ================= */

const getDonutColor = (
  usedRatio: number | null,
  hasRequest: boolean,
): string => {
  if (!hasRequest || usedRatio === null || !Number.isFinite(usedRatio)) {
    return settings.colors.green;
  }

  if (!settings.enableThresholdColors) {
    return settings.colors.green;
  }

  const r = clamp01(usedRatio);

  if (r < settings.thresholds.redBelow) return settings.colors.red;
  if (r < settings.thresholds.yellowBelow) return settings.colors.yellow;
  return settings.colors.green;
};

/* ================= Donut Component ================= */

const Donut: React.FC<{
  usedRatio: number | null;
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

  const donutColor = getDonutColor(usedRatio, hasRequest);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={TOKENS.track}
            strokeWidth={stroke}
          />

          {showProgress && ratio === 0 && (
            <circle cx={size / 2} cy={stroke / 2} r={6} fill={donutColor} />
          )}

          {showProgress && ratio > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={donutColor}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${gap}`}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          )}
        </svg>

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
          <div style={{ fontSize: 11, fontWeight: 700, color: TOKENS.textSecondary }}>
            Max memory used (7d)
          </div>

          <div style={{ fontSize: 28, fontWeight: 800 }}>
            {maxText}
          </div>

          <div
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              background: TOKENS.badgeBg,
              border: hasRequest
                ? `1px solid ${donutColor}`
                : `1px solid ${TOKENS.border}`,
              fontWeight: 700,
              fontSize: 12,
              minWidth: 95,
            }}
          >
            {hasRequest && usedRatio !== null
              ? `${pct(clamp01(usedRatio))}% used`
              : 'No request'}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 13, color: TOKENS.textSecondary }}>
        Request: <b style={{ color: TOKENS.text }}>{requestText}</b>
      </div>

      <div style={{ fontSize: 13, color: TOKENS.textSecondary }}>
        Current: <b style={{ color: TOKENS.text }}>{currentText}</b>
      </div>

      <div style={{ fontSize: 13, color: TOKENS.textSecondary }}>
        Over-reserved:{' '}
        <b style={{ color: TOKENS.text }}>{overReservedText}</b>
      </div>
    </div>
  );
};

/* ================= Main Component ================= */

const FinOpsTab: React.FC<Props> = ({ obj }) => {
  const namespace = obj?.metadata?.namespace ?? '';
  const workloadName = obj?.metadata?.name ?? '';
  const kind = obj?.kind ?? 'Workload';

  const { max7dQuery, currentQuery, requestQuery } = React.useMemo(
    () => buildQueries(namespace, workloadName),
    [namespace, workloadName],
  );

  const [requestResp] = usePrometheusPoll({
    endpoint: PrometheusEndpoint.QUERY,
    query: requestQuery,
    namespace,
    delay: 60000,
  });

  const [maxResp] = usePrometheusPoll({
    endpoint: PrometheusEndpoint.QUERY,
    query: max7dQuery,
    namespace,
    delay: 60000,
  });

  const [currentResp] = usePrometheusPoll({
    endpoint: PrometheusEndpoint.QUERY,
    query: currentQuery,
    namespace,
    delay: 60000,
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

    const containers = Array.from(
      new Set([
        ...Array.from(currentBy.keys()),
        ...Array.from(maxBy.entries())
          .filter(([, v]) => v > 0)
          .map(([c]) => c),
      ]),
    ).sort();

    return containers.map((container) => {
      const requestGiB = requestBy.get(container) ?? null;
      const maxGiB = maxBy.get(container) ?? null;
      const currentGiB = currentBy.get(container) ?? null;

      const hasRequest = requestGiB !== null && requestGiB > 0;
      const usedRatio =
        hasRequest && maxGiB !== null ? maxGiB / requestGiB : null;

      const overReservedRatio =
        usedRatio !== null ? Math.max(0, 1 - usedRatio) : null;

      const overReservedText =
        overReservedRatio !== null
          ? `${pct(overReservedRatio)}%`
          : 'N/A';

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

  return (
    <div style={{ padding: 16 }}>
      <h2>FinOps</h2>

      <div style={{ color: TOKENS.textSecondary, marginBottom: 16 }}>
        {kind} <b>{workloadName}</b> in namespace <b>{namespace}</b>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
        {rows.map((r) => (
          <div
            key={r.container}
            style={{
              border: `1px solid ${TOKENS.border}`,
              borderRadius: 12,
              padding: 18,
              width: 380,
              background: TOKENS.bgCard,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 12 }}>
              Container: {r.container}
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
    </div>
  );
};

export default FinOpsTab;
