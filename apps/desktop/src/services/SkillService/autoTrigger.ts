/**
 * Auto-Trigger Logic for Skills
 * Automatically activates skills based on context (DataFrame load, errors, etc.)
 */

import { useSkillStore } from './index';

// Simple notification helper (can be replaced with proper toast/notification system)
function showNotification(message: string) {
  console.log('[Skill Auto-Trigger]', message);
  // TODO: Integrate with proper notification system
}

/**
 * Check if a skill should be auto-triggered based on variable inspection
 */
export function checkAutoTriggers(variableName: string, variableType: string) {
  const { skills, activateSkill, isSkillActive } = useSkillStore.getState();
  
  // Auto-trigger EDA skill on DataFrame load
  if (variableType.includes('DataFrame') || variableType.includes('pd.DataFrame')) {
    const edaSkill = skills.find(s => s.name === 'eda');
    if (edaSkill && !isSkillActive(edaSkill.id)) {
      activateSkill(edaSkill.id);
      showNotification(`EDA skill activated for ${variableName}`);
    }
  }
  
  // Auto-trigger visualization skill for numeric data
  if (variableType.includes('ndarray') || variableType.includes('Series')) {
    const vizSkill = skills.find(s => s.name === 'viz');
    if (vizSkill && !isSkillActive(vizSkill.id)) {
      activateSkill(vizSkill.id);
      showNotification(`Visualization skill activated for ${variableName}`);
    }
  }
}

/**
 * Check if debug skill should be auto-triggered on errors
 */
export function checkErrorAutoTrigger(errorMessage: string) {
  const { skills, activateSkill, isSkillActive } = useSkillStore.getState();
  
  // Auto-trigger debug skill on errors
  if (errorMessage.includes('Error') || errorMessage.includes('Exception') || errorMessage.includes('Traceback')) {
    const debugSkill = skills.find(s => s.name === 'debug');
    if (debugSkill && !isSkillActive(debugSkill.id)) {
      activateSkill(debugSkill.id);
      showNotification('Debug skill activated for error analysis');
    }
  }
}

/**
 * Check if cleaning skill should be suggested based on data quality issues
 */
export function checkDataQualityTriggers(variableName: string, sample: any) {
  const { skills, activateSkill, isSkillActive } = useSkillStore.getState();
  
  // Check for missing values
  if (sample && typeof sample === 'object') {
    const hasMissingValues = Object.values(sample).some(val => val === null || val === undefined);
    
    if (hasMissingValues) {
      const cleanSkill = skills.find(s => s.name === 'clean');
      if (cleanSkill && !isSkillActive(cleanSkill.id)) {
        // Don't auto-activate, just suggest
        showNotification(`Data quality issues detected in ${variableName}. Consider using /clean skill.`);
      }
    }
  }
}
