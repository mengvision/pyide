import { useRef, useCallback, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { GridApi, ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { useSettingsStore } from '../../stores/settingsStore';
import styles from './DataFrameOutput.module.css';

interface DataFrameData {
  _type: 'dataframe';
  columns: string[];
  data: any[][];
  shape: [number, number];
}

interface DataFrameOutputProps {
  data: DataFrameData;
}

export function DataFrameOutput({ data }: DataFrameOutputProps) {
  const gridApiRef = useRef<GridApi | null>(null);
  const theme = useSettingsStore((s) => s.theme);

  const themeClass = theme === 'light' ? 'ag-theme-alpine' : 'ag-theme-alpine-dark';

  const columnDefs: ColDef[] = useMemo(() => {
    return (data.columns ?? []).map((col) => ({
      field: col,
      headerName: col,
      sortable: true,
      filter: true,
      resizable: true,
    }));
  }, [data.columns]);

  const rowData = useMemo(() => {
    return (data.data ?? []).map((row) => {
      const obj: Record<string, any> = {};
      (data.columns ?? []).forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj;
    });
  }, [data.data, data.columns]);

  const handleGridReady = useCallback((params: { api: GridApi }) => {
    gridApiRef.current = params.api;
  }, []);

  const handleExportCsv = useCallback(() => {
    gridApiRef.current?.exportDataAsCsv();
  }, []);

  const shape = data.shape ?? [rowData.length, columnDefs.length];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.label}>
          DataFrame ({shape[0]} rows × {shape[1]} cols)
        </span>
        <button className={styles.btn} onClick={handleExportCsv} title="Export as CSV">
          ⬇️ CSV
        </button>
      </div>
      <div className={`${themeClass} ${styles.grid}`}>
        <AgGridReact
          columnDefs={columnDefs}
          rowData={rowData}
          defaultColDef={{ sortable: true, filter: true, resizable: true }}
          domLayout="normal"
          onGridReady={handleGridReady}
        />
      </div>
    </div>
  );
}
