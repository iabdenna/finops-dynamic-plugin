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
  value: number;
};

/* ================= Utilities ================= */

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const pct = (x: number) => Math.round(x * 100);

const formatGiB = (gib: number | null) => {
  if (gib === null || !Number.isFinite(gib)) return 'N/A';
  return `${gib.toFixed(2)} GiB`;
};

const formatCpuCoresOrMillicores = (cores: number | null) => {
  if (cores === null || !Number.isFinite(cores)) return 'N/A';
  if (cores < 1) return `${Math.round(cores * 1000)}m`;
  const rounded = Math.round(cores * 100) / 100;
  return `${rounded}`;
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

/* ================= Prometheus Queries (CLIENT STYLE) ================= */
/**
 * Uses namespace_workload_pod:kube_pod_owner:relabel to map pod -> workload precisely
 * Filters by namespace + workload + workload_type (deployment|statefulset|daemonset)
 *
 * NOTE: We aggregate "max by (container)" for donut-per-container display.
 */
const buildQueries = (namespace: string, workloadName: string, workloadType: string) => {
  // -------- RAM (baseline = REQUEST) --------
  // RAM REQUEST (bytes) -> GiB
  const ramRequestQuery = `
max by (container) (
  kube_pod_container_resource_requests{
    resource="memory",
    namespace="${namespace}",
    container!="",
    container!="POD"
  }
  * on(namespace, pod) group_left(workload, workload_type)
    namespace_workload_pod:kube_pod_owner:relabel{
      namespace="${namespace}",
      workload="${workloadName}",
      workload_type="${workloadType}"
    }
) / 1024^3
`.trim();

  // Max RAM usage over 7d (bytes) -> GiB
  const ramMax7dQuery = `
max by (container) (
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
      workload="${workloadName}",
      workload_type="${workloadType}"
    }
) / 1024^3
`.trim();

  // Current RAM usage (bytes) -> GiB
  const ramCurrentQuery = `
max by (container) (
  container_memory_working_set_bytes{
    namespace="${namespace}",
    container!="",
    container!="POD"
  }
  * on(namespace, pod) group_left(workload, workload_type)
    namespace_workload_pod:kube_pod_owner:relabel{
      namespace="${namespace}",
      workload="${workloadName}",
      workload_type="${workloadType}"
    }
) / 1024^3
`.trim();

  // -------- CPU (baseline = REQUEST) --------
  // Max CPU usage over 7d (cores)
  const cpuMax7dCoresQuery = `
max by (container) (
  max_over_time(
    node_namespace_pod_container:container_cpu_usage_seconds_total:sum_irate{
      namespace="${namespace}",
      container!="",
      container!="POD"
    }[7d]
  )
  * on(namespace, pod) group_left(workload, workload_type)
    namespace_workload_pod:kube_pod_owner:relabel{
      namespace="${namespace}",
      workload="${workloadName}",
      workload_type="${workloadType}"
    }
)
`.trim();

  // Current CPU usage (cores)
  const cpuCurrentCoresQuery = `
max by (container) (
  node_namespace_pod_container:container_cpu_usage_seconds_total:sum_irate{
    namespace="${namespace}",
    container!="",
    container!="POD"
  }
  * on(namespace, pod) group_left(workload, workload_type)
    namespace_workload_pod:kube_pod_owner:relabel{
      namespace="${namespace}",
      workload="${workloadName}",
      workload_type="${workloadType}"
    }
)
`.trim();

  // CPU REQUEST (cores)
  const cpuRequestCoresQuery = `
max by (container) (
  kube_pod_container_resource_requests{
    resource="cpu",
    namespace="${namespace}",
    container!="",
    container!="POD"
  }
  * on(namespace, pod) group_left(workload, workload_type)
    namespace_workload_pod:kube_pod_owner:relabel{
      namespace="${namespace}",
      workload="${workloadName}",
      workload_type="${workloadType}"
    }
)
`.trim();

  return {
    // RAM
    ramRequestQuery,
    ramMax7dQuery,
    ramCurrentQuery,
    // CPU
    cpuMax7dCoresQuery,
    cpuCurrentCoresQuery,
    cpuRequestCoresQuery,
  };
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

const DEFAULT_GREEN = '#3E8635';

/* ================= Color Logic (from JSON) ================= */

const getDonutColor = (usedRatio: number | null, enabled: boolean): string => {
  const green = settings?.colors?.green ?? DEFAULT_GREEN;
  const red = settings?.colors?.red ?? '#C9190B';
  const yellow = settings?.colors?.yellow ?? '#F0AB00';

  if (!enabled || usedRatio === null || !Number.isFinite(usedRatio)) return green;

  const r = clamp01(usedRatio);

  const redBelow = settings?.thresholds?.redBelow ?? 0.1;
  const yellowBelow = settings?.thresholds?.yellowBelow ?? 0.5;

  if (r < redBelow) return red;
  if (r < yellowBelow) return yellow;
  return green;
};

/* ================= Shared Donut Model ================= */

type DonutModel = {
  hasBaseline: boolean; // request exists
  ratio: number | null; // max / request (can be > 1)
  ratioClamped: number | null; // 0..1 for ring
  badgeText: string; // "% used" or "No request"
  overReservedText: string; // "xx%" or "N/A"
  color: string;
};

const buildDonutModel = (maxVal: number | null, requestVal: number | null): DonutModel => {
  const hasBaseline = requestVal !== null && Number.isFinite(requestVal) && requestVal > 0;

  const ratio =
    hasBaseline && maxVal !== null && Number.isFinite(maxVal) ? maxVal / requestVal : null;

  const ratioClamped =
    ratio !== null && Number.isFinite(ratio) ? clamp01(ratio) : null;

  const thresholdEnabled = Boolean(settings?.enableThresholdColors);
  const color = getDonutColor(ratio, thresholdEnabled);

  const badgeText =
    hasBaseline && ratio !== null && Number.isFinite(ratio)
      ? `${pct(clamp01(ratio))}% used`
      : 'No request';

  const overReserved =
    hasBaseline && ratio !== null && Number.isFinite(ratio)
      ? Math.max(0, 1 - ratio)
      : null;

  const overReservedText = overReserved !== null ? `${pct(overReserved)}%` : 'N/A';

  return { hasBaseline, ratio, ratioClamped, badgeText, overReservedText, color };
};

/* ================= Donuts ================= */

const DonutBase: React.FC<{
  title: string;
  centerValue: string;
  badgeText: string;
  badgeBorderColor: string;
  ringRatio: number | null; // 0..1
  ringColor: string;
  bottomLines: Array<{ label: string; value: string }>;
}> = ({ title, centerValue, badgeText, badgeBorderColor, ringRatio, ringColor, bottomLines }) => {
  const size = 200;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  const showProgress = ringRatio !== null && Number.isFinite(ringRatio);
  const ratio = showProgress ? clamp01(ringRatio as number) : 0;

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

          {/* dot when 0 */}
          {showProgress && ratio === 0 && (
            <circle cx={size / 2} cy={stroke / 2} r={6} fill={ringColor} />
          )}

          {/* progress */}
          {showProgress && ratio > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={ringColor}
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
          <div style={{ fontSize: 11, fontWeight: 700, color: TOKENS.textSecondary }}>
            {title}
          </div>

          <div style={{ fontSize: 28, fontWeight: 800 }}>{centerValue}</div>

          <div
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              background: TOKENS.badgeBg,
              border: `1px solid ${badgeBorderColor}`,
              color: TOKENS.text,
              fontWeight: 700,
              fontSize: 12,
              minWidth: 95,
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            {badgeText}
          </div>
        </div>
      </div>

      {bottomLines.map((l) => (
        <div key={l.label} style={{ fontSize: 13, color: TOKENS.textSecondary }}>
          {l.label}: <b style={{ color: TOKENS.text }}>{l.value}</b>
        </div>
      ))}
    </div>
  );
};

/**
 * RAM donut (baseline = REQUEST):
 * - Center: Max memory used (7d) GiB
 * - Badge: % used (max/request) or No request
 */
const DonutRAM: React.FC<{
  maxGiB: number | null;
  currentGiB: number | null;
  requestGiB: number | null;
}> = ({ maxGiB, currentGiB, requestGiB }) => {
  const m = buildDonutModel(maxGiB, requestGiB);

  return (
    <DonutBase
      title="Max memory used (7d)"
      centerValue={formatGiB(maxGiB)}
      badgeText={m.badgeText}
      badgeBorderColor={m.hasBaseline ? m.color : TOKENS.border}
      ringRatio={m.hasBaseline ? m.ratioClamped : null}
      ringColor={m.color}
      bottomLines={[
        { label: 'Request', value: formatGiB(requestGiB) },
        { label: 'Current', value: formatGiB(currentGiB) },
        { label: 'Over-reserved', value: m.overReservedText },
      ]}
    />
  );
};

/**
 * CPU donut (baseline = REQUEST):
 * - Title: Max CPU used (7d) ✅ keep
 * - Center: Max CPU over 7d (cores/millicores)
 * - Badge: % used (max/request) or No request
 */
const DonutCPU: React.FC<{
  maxCores: number | null;
  currentCores: number | null;
  requestCores: number | null;
}> = ({ maxCores, currentCores, requestCores }) => {
  const m = buildDonutModel(maxCores, requestCores);

  return (
    <DonutBase
      title="Max CPU used (7d)"
      centerValue={formatCpuCoresOrMillicores(maxCores)}
      badgeText={m.badgeText}
      badgeBorderColor={m.hasBaseline ? m.color : TOKENS.border}
      ringRatio={m.hasBaseline ? m.ratioClamped : null}
      ringColor={m.color}
      bottomLines={[
        { label: 'CPU request', value: formatCpuCoresOrMillicores(requestCores) },
        { label: 'Current CPU', value: formatCpuCoresOrMillicores(currentCores) },
        { label: 'Over-reserved', value: m.overReservedText },
      ]}
    />
  );
};

/* ================= Main Component ================= */

const FinOpsTab: React.FC<Props> = ({ obj }) => {
  const namespace = obj?.metadata?.namespace ?? '';
  const workloadName = obj?.metadata?.name ?? '';
  const kind = obj?.kind ?? 'Workload';

  const workloadType =
    kind.toLowerCase() === 'deployment'
      ? 'deployment'
      : kind.toLowerCase() === 'statefulset'
        ? 'statefulset'
        : kind.toLowerCase() === 'daemonset'
          ? 'daemonset'
          : 'workload';

  const {
    ramRequestQuery,
    ramMax7dQuery,
    ramCurrentQuery,
    cpuMax7dCoresQuery,
    cpuCurrentCoresQuery,
    cpuRequestCoresQuery,
  } = React.useMemo(
    () => buildQueries(namespace, workloadName, workloadType),
    [namespace, workloadName, workloadType],
  );

  // RAM polls
  const [ramRequestResp, ramRequestError, ramRequestLoading] = usePrometheusPoll({
    endpoint: PrometheusEndpoint.QUERY,
    query: ramRequestQuery,
    namespace,
    delay: 60_000,
  });

  const [ramMaxResp, ramMaxError, ramMaxLoading] = usePrometheusPoll({
    endpoint: PrometheusEndpoint.QUERY,
    query: ramMax7dQuery,
    namespace,
    delay: 60_000,
  });

  const [ramCurrentResp, ramCurrentError, ramCurrentLoading] = usePrometheusPoll({
    endpoint: PrometheusEndpoint.QUERY,
    query: ramCurrentQuery,
    namespace,
    delay: 60_000,
  });

  // CPU polls
  const [cpuReqResp, cpuReqError, cpuReqLoading] = usePrometheusPoll({
    endpoint: PrometheusEndpoint.QUERY,
    query: cpuRequestCoresQuery,
    namespace,
    delay: 60_000,
  });

  const [cpuMaxResp, cpuMaxError, cpuMaxLoading] = usePrometheusPoll({
    endpoint: PrometheusEndpoint.QUERY,
    query: cpuMax7dCoresQuery,
    namespace,
    delay: 60_000,
  });

  const [cpuCurrentResp, cpuCurrentError, cpuCurrentLoading] = usePrometheusPoll({
    endpoint: PrometheusEndpoint.QUERY,
    query: cpuCurrentCoresQuery,
    namespace,
    delay: 60_000,
  });

  // Parse
  const ramRequests = React.useMemo(() => parsePrometheus(ramRequestResp), [ramRequestResp]);
  const ramMax7d = React.useMemo(() => parsePrometheus(ramMaxResp), [ramMaxResp]);
  const ramCurrent = React.useMemo(() => parsePrometheus(ramCurrentResp), [ramCurrentResp]);

  const cpuRequests = React.useMemo(() => parsePrometheus(cpuReqResp), [cpuReqResp]);
  const cpuMax7d = React.useMemo(() => parsePrometheus(cpuMaxResp), [cpuMaxResp]);
  const cpuCurrent = React.useMemo(() => parsePrometheus(cpuCurrentResp), [cpuCurrentResp]);

  const rows = React.useMemo(() => {
    const mapFrom = (arr: Series[]) => {
      const m = new Map<string, number>();
      arr.forEach((s) => m.set(s.container, s.value));
      return m;
    };

    const ramReqBy = mapFrom(ramRequests);
    const ramMaxBy = mapFrom(ramMax7d);
    const ramCurBy = mapFrom(ramCurrent);

    const cpuReqBy = mapFrom(cpuRequests);
    const cpuMaxBy = mapFrom(cpuMax7d);
    const cpuCurBy = mapFrom(cpuCurrent);

    // Avoid "ghost containers": show if any metric exists
    const containers = Array.from(
      new Set([
        ...Array.from(ramCurBy.keys()),
        ...Array.from(cpuCurBy.keys()),
        ...Array.from(ramMaxBy.entries())
          .filter(([, v]) => Number.isFinite(v) && v > 0)
          .map(([c]) => c),
        ...Array.from(cpuMaxBy.entries())
          .filter(([, v]) => Number.isFinite(v) && v > 0)
          .map(([c]) => c),
        ...Array.from(ramReqBy.entries())
          .filter(([, v]) => Number.isFinite(v) && v > 0)
          .map(([c]) => c),
        ...Array.from(cpuReqBy.entries())
          .filter(([, v]) => Number.isFinite(v) && v > 0)
          .map(([c]) => c),
      ]),
    )
      .filter((c) => c && c !== 'POD')
      .sort();

    return containers.map((container) => ({
      container,

      ramRequestGiB: ramReqBy.get(container) ?? null,
      ramMaxGiB: ramMaxBy.get(container) ?? null,
      ramCurrentGiB: ramCurBy.get(container) ?? null,

      cpuRequestCores: cpuReqBy.get(container) ?? null,
      cpuMaxCores: cpuMaxBy.get(container) ?? null,
      cpuCurrentCores: cpuCurBy.get(container) ?? null,
    }));
  }, [ramRequests, ramMax7d, ramCurrent, cpuRequests, cpuMax7d, cpuCurrent]);

  const loading =
    ramRequestLoading ||
    ramMaxLoading ||
    ramCurrentLoading ||
    cpuReqLoading ||
    cpuMaxLoading ||
    cpuCurrentLoading;

  const hasAnyError = Boolean(
    ramRequestError || ramMaxError || ramCurrentError || cpuReqError || cpuMaxError || cpuCurrentError,
  );

  return (
    <div style={{ padding: 16, color: TOKENS.text }}>
      <h2 style={{ marginTop: 0, color: TOKENS.text }}>FinOps</h2>

      <div style={{ color: TOKENS.textSecondary, marginBottom: 16 }}>
        {kind} <b style={{ color: TOKENS.text }}>{workloadName}</b> in namespace{' '}
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
          No data available for this workload
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
              </div>

              {/* ===== RAM ===== */}
              <div style={{ fontWeight: 700, color: TOKENS.text, marginBottom: 10 }}>Memory (RAM)</div>

              <DonutRAM
                maxGiB={r.ramMaxGiB}
                currentGiB={r.ramCurrentGiB}
                requestGiB={r.ramRequestGiB}
              />

              {/* ===== Divider ===== */}
              <div
                style={{
                  height: 1,
                  background: TOKENS.border,
                  margin: '16px 0',
                  opacity: 0.9,
                }}
              />

              {/* ===== CPU ===== */}
              <div style={{ fontWeight: 700, color: TOKENS.text, marginBottom: 10 }}>CPU</div>

              <DonutCPU
                maxCores={r.cpuMaxCores}
                currentCores={r.cpuCurrentCores}
                requestCores={r.cpuRequestCores}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FinOpsTab;