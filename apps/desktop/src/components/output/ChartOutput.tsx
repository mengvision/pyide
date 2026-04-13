import { useCallback } from 'react';
import Plot from 'react-plotly.js';
import styles from './ChartOutput.module.css';

interface PlotlyData {
  _type: 'plotly';
  figure: {
    data: Plotly.Data[];
    layout: Partial<Plotly.Layout>;
  };
}

interface ChartOutputProps {
  data: PlotlyData;
}

export function ChartOutput({ data }: ChartOutputProps) {
  const figure = data.figure ?? { data: [], layout: {} };

  const layout: Partial<Plotly.Layout> = {
    ...figure.layout,
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'var(--bg-primary)',
    font: { color: 'var(--text-primary)' },
    margin: { t: 40, r: 20, b: 40, l: 50 },
  };

  const handleDownloadPng = useCallback(() => {
    // Trigger download via Plotly's built-in toImage
    const plotEl = document.querySelector('.js-plotly-plot') as HTMLElement & { _fullLayout?: any };
    if (!plotEl) return;
    (window as any).Plotly?.downloadImage(plotEl, {
      format: 'png',
      filename: 'chart',
    });
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <button className={styles.btn} onClick={handleDownloadPng} title="Download PNG">
          ⬇️ PNG
        </button>
      </div>
      <div className={styles.plotWrapper}>
        <Plot
          data={figure.data}
          layout={layout}
          config={{ responsive: true, displayModeBar: true }}
          useResizeHandler
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  );
}
