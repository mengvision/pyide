import { checkAutoTriggers, checkErrorAutoTrigger } from '../services/SkillService/conditionalTrigger';

export interface RoutedOutput {
  type: 'text' | 'dataframe' | 'chart' | 'error' | 'warning' | 'info';
  data: any;
  timestamp: number;
}

function classifyStderrLevel(text: string): 'error' | 'warning' | 'info' {
  // 检查是否是真正的异常/错误（有 Traceback 或 Error/Exception 关键字）
  if (/Traceback \(most recent call last\)/i.test(text) ||
      /^\w+(Error|Exception):/m.test(text) ||
      /^ERROR[:\s]/im.test(text) ||
      /logging\.error/i.test(text)) {
    return 'error';
  }

  // 检查是否是警告
  if (/Warning[:\s]/i.test(text) ||
      /^WARNING[:\s]/im.test(text) ||
      /warnings\.warn/i.test(text) ||
      /DeprecationWarning/i.test(text) ||
      /FutureWarning/i.test(text) ||
      /UserWarning/i.test(text) ||
      /RuntimeWarning/i.test(text)) {
    return 'warning';
  }

  // 其余 stderr 内容当作 info（如 logging.info 输出到 stderr、pip 安装信息等）
  return 'info';
}

export function routeStreamMessage(streamMsg: { stream: string; data: Record<string, any> }): RoutedOutput {
  const timestamp = Date.now();

  if (streamMsg.stream === 'stderr') {
    const text = streamMsg.data['text/plain'] || '';
    const level = classifyStderrLevel(text);

    if (level === 'error') {
      checkErrorAutoTrigger(text);
    }

    return {
      type: level,
      data: { text },
      timestamp,
    };
  }

  const jsonData = streamMsg.data['application/json'];
  if (jsonData) {
    if (jsonData._type === 'dataframe') {
      // Auto-trigger EDA skill on DataFrame
      if (jsonData.variable_name && jsonData.variable_type) {
        checkAutoTriggers(jsonData.variable_name, jsonData.variable_type);
      }
      return { type: 'dataframe', data: jsonData, timestamp };
    }
    if (jsonData._type === 'plotly') {
      return { type: 'chart', data: jsonData, timestamp };
    }
  }

  return {
    type: 'text',
    data: { text: streamMsg.data['text/plain'] || JSON.stringify(streamMsg.data) },
    timestamp,
  };
}
