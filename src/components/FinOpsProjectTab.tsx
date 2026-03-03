import * as React from 'react';
import { useLocation } from 'react-router-dom';
import { Spinner } from '@patternfly/react-core';

function extractProjectName(pathname: string): string | undefined {
  const match = pathname.match(/\/k8s\/cluster\/projects\/([^/]+)/);
  return match?.[1];
}

const FinOpsProjectTab: React.FC = () => {
  const { pathname } = useLocation();
  const projectName = extractProjectName(pathname);

  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!projectName) return;

    setLoading(true);
    setError(null);

    fetch(
      `/api/proxy/plugin/finops-plugin/finops/api/finops/project?namespace=${encodeURIComponent(
        projectName
      )}`
    )
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [projectName]);

  if (!projectName) {
    return (
      <div style={{ padding: 20 }}>
        Project not detected.
        <div style={{ fontSize: 12, marginTop: 10 }}>
          Path: {pathname}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: 20 }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20, color: 'red' }}>
        Error: {error}
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>FinOps – Project View</h2>

      <div>
        <strong>Project:</strong> {projectName}
      </div>

      <div style={{ marginTop: 20 }}>
        <h3>Custom Prometheus</h3>
        <div>Value: {data?.custom?.value ?? 'N/A'}</div>
      </div>

      <div style={{ marginTop: 20 }}>
        <h3>OpenShift Monitoring</h3>
        <div>Value: {data?.openshift?.value ?? 'N/A'}</div>
      </div>
    </div>
  );
};

export default FinOpsProjectTab;