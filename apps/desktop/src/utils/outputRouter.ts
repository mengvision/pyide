import { checkAutoTriggers, checkErrorAutoTrigger } from '../services/SkillService/autoTrigger';

export interface RoutedOutput {
  type: 'text' | 'dataframe' | 'chart' | 'error';
  data: any;
  timestamp: number;
}

export function routeStreamMessage(streamMsg: { stream: string; data: Record<string, any> }): RoutedOutput {
  const timestamp = Date.now();

  if (streamMsg.stream === 'stderr') {
    const errorText = streamMsg.data['text/plain'] || '';
    
    // Auto-trigger debug skill on errors
    checkErrorAutoTrigger(errorText);
    
    return {
      type: 'error',
      data: { text: errorText },
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
