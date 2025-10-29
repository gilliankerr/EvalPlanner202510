import type { LabeledScrapeResult } from './scrape';

const API_URL = '/api';

interface PromptData {
  [key: string]: string;
}

export async function fetchPrompt(stepName: string): Promise<string> {
  try {
    const response = await fetch(`${API_URL}/prompts/content/${stepName}`, {
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
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

export interface ContextData {
  organizationName?: string;
  programName?: string;
  aboutProgram?: string;
  scrapedContent?: string;
  labeledScrapedContent?: LabeledScrapeResult[];
  programAnalysis?: string;
  evaluationFramework?: string;
  [key: string]: string | undefined | LabeledScrapeResult[];
}

export function buildPromptWithContext(adminTemplate: string, context: ContextData): string {
  const sections: string[] = [];
  
  if (context.organizationName || context.programName || context.aboutProgram) {
    sections.push('=== PROGRAM INFORMATION ===');
    if (context.organizationName) {
      sections.push(`Organization: ${context.organizationName}`);
    }
    if (context.programName) {
      sections.push(`Program: ${context.programName}`);
    }
    if (context.aboutProgram) {
      sections.push(`Description: ${context.aboutProgram}`);
    }
    sections.push('');
  }
  
  // Use labeled content if available, otherwise fall back to regular scraped content
  if (context.labeledScrapedContent && context.labeledScrapedContent.length > 0) {
    sections.push('=== CONTENT FROM WEBSITES (WITH CONTEXT) ===');
    context.labeledScrapedContent.forEach((item, index) => {
      sections.push(`\n--- ${item.label.toUpperCase()} ---`);
      sections.push(`URL: ${item.url}`);
      if (item.content) {
        sections.push(item.content);
      } else if (item.error) {
        sections.push(`Error: ${item.error}`);
      }
      if (index < context.labeledScrapedContent!.length - 1) {
        sections.push('');
      }
    });
    sections.push('');
  } else if (context.scrapedContent && context.scrapedContent.trim()) {
    sections.push('=== CONTENT FROM WEBSITE ===');
    sections.push(context.scrapedContent);
    sections.push('');
  }
  
  if (context.programAnalysis && context.programAnalysis.trim()) {
    sections.push('=== PREVIOUS ANALYSIS (STEP 3) ===');
    sections.push(context.programAnalysis);
    sections.push('');
  }
  
  if (context.evaluationFramework && context.evaluationFramework.trim()) {
    sections.push('=== EVALUATION FRAMEWORK (STEP 4) ===');
    sections.push(context.evaluationFramework);
    sections.push('');
  }
  
  sections.push('=== YOUR TASK ===');
  sections.push(adminTemplate);
  
  return sections.join('\n');
}
