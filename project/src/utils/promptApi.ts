const API_URL = '/api';

interface PromptData {
  [key: string]: string;
}

export async function fetchPrompt(stepName: string): Promise<string> {
  try {
    const response = await fetch(`${API_URL}/prompts/${stepName}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch prompt: ${response.status}`);
    }
    const data = await response.json();
    return data.content;
  } catch (error) {
    console.error(`Error fetching prompt for ${stepName}:`, error);
    throw error;
  }
}

export function replacePromptVariables(template: string, data: PromptData): string {
  let result = template;
  
  Object.keys(data).forEach(key => {
    const placeholder = `{{${key}}}`;
    const value = data[key] || '';
    result = result.replace(new RegExp(placeholder, 'g'), value);
  });
  
  return result;
}

export async function getProcessedPrompt(stepName: string, data: PromptData): Promise<string> {
  const template = await fetchPrompt(stepName);
  return replacePromptVariables(template, data);
}
