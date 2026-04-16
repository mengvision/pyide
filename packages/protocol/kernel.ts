export interface KernelRequest {
  id: string;
  method: string;
  params: Record<string, any>;
}

export interface KernelResponse {
  id: string;
  result?: Record<string, any>;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface KernelStream {
  stream: 'stdout' | 'stderr' | 'display_data' | 'execute_result';
  data: Record<string, any>;
  cell_id?: string;
  execution_count?: number;
}

export interface VariableInfo {
  name: string;
  type: string;
  value_preview: string;
  shape?: string;
  size?: number;
}

export interface CellInfo {
  index: number;
  title: string;
  startLine: number;
  endLine: number;
  code: string;
}

export interface OutputData {
  type: 'text' | 'dataframe' | 'chart' | 'error' | 'warning' | 'info';
  data: any;
  timestamp: number;
}

export interface ReplEntry {
  id: string;               // 唯一标识（uuid）
  code: string;             // 执行的代码
  outputs: OutputData[];    // 该次执行的所有输出
  executionCount: number;   // In [n] 编号
  timestamp: number;        // 执行时间戳
}
