import React, { useEffect, useState } from 'react';
import { FileOutput, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import type { ProgramData } from '../App';
import { fetchPrompt, buildPromptWithContext } from '../utils/promptApi';

// TODO: Convert this component from Tailwind CSS to CSS Modules
// This component currently uses ~80 Tailwind utility classes (grid, gap-*, bg-*, hover:*, animate-*, etc.)
// When next modifying this component, follow the "Systematic Pre-Styling Verification Checklist"
// in replit.md to convert to CSS Modules pattern. See StepSix.tsx and StepSix.module.css as reference.

// Utility functions for handling code fences in AI responses
const stripCodeFences = (content: string): string => {
  if (!content) return content;
  
  // Remove opening and closing triple backticks at start and end of content
  // This handles cases where AI wraps the entire response in code fences
  const trimmed = content.trim();
  
  // Check for code block wrapping (```markdown or just ``` at start)
  const codeBlockStart = /^```(?:markdown|md|text)?\s*\n/i;
  const codeBlockEnd = /\n\s*```\s*$/;
  
  let processed = trimmed;
  
  // Strip opening code fence
  if (codeBlockStart.test(processed)) {
    processed = processed.replace(codeBlockStart, '');
  }
  
  // Strip closing code fence
  if (codeBlockEnd.test(processed)) {
    processed = processed.replace(codeBlockEnd, '');
  }
  
  return processed.trim();
};

const containsCodeFences = (content: string): boolean => {
  if (!content) return false;
  
  // Check for remaining code fences that could interfere with markdown rendering
  const codeFencePattern = /```/g;
  const matches = content.match(codeFencePattern);
  
  // If we find code fences, check if they are balanced pairs (even number)
  // Unbalanced code fences are problematic for markdown rendering
  if (matches) {
    return matches.length % 2 !== 0; // Odd number means unbalanced
  }
  
  return false;
};

// Post-processing function to ensure canonical hyperlinks are always present
const ensureCanonicalLinks = (content: string): string => {
  if (!content) return content;
  
  // Define the canonical links that must be present
  const canonicalLinks = {
    'LogicalOutcomes Evaluation Planning Handbook': {
      url: 'https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4815131',
      markdown: '[LogicalOutcomes Evaluation Planning Handbook](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4815131)'
    },
    'Undermind': {
      url: 'https://www.undermind.ai/',
      markdown: '[Undermind](https://www.undermind.ai/)'
    },
    'FutureHouse Falcon': {
      url: 'https://platform.futurehouse.org/',
      markdown: '[FutureHouse Falcon](https://platform.futurehouse.org/)'
    },
    'Consensus': {
      url: 'https://consensus.app/',
      markdown: '[Consensus](https://consensus.app/)'
    }
  };
  
  let processedContent = content;
  
  // For each canonical link, handle various formatting patterns
  Object.entries(canonicalLinks).forEach(([text, linkInfo]) => {
    const escapedText = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedUrl = linkInfo.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Pattern 1: Text followed by URL in parentheses - e.g., "Consensus (https://consensus.app/)"
    const textWithParenUrlRegex = new RegExp(`\\b${escapedText}\\s*\\(\\s*${escapedUrl}\\s*\\)`, 'g');
    processedContent = processedContent.replace(textWithParenUrlRegex, linkInfo.markdown);
    
    // Pattern 2: Text followed by URL with various separators - e.g., "Consensus: https://consensus.app/" or "Consensus - https://consensus.app/"
    const textWithSeparatorUrlRegex = new RegExp(`\\b${escapedText}\\s*[\\:\\-\\u2013]?\\s*${escapedUrl}`, 'g');
    processedContent = processedContent.replace(textWithSeparatorUrlRegex, linkInfo.markdown);
    
    // Pattern 3: Bare canonical URL conversion - convert standalone URLs to branded links
    const bareUrlRegex = new RegExp(escapedUrl, 'g');
    processedContent = processedContent.replace(bareUrlRegex, (match, offset, fullString) => {
      // Check if this URL is already part of a markdown link by examining context
      const contextStart = Math.max(0, offset - 10);
      const contextEnd = Math.min(fullString.length, offset + match.length + 5);
      const beforeContext = fullString.substring(contextStart, offset);
      const afterContext = fullString.substring(offset + match.length, contextEnd);
      
      // If it's already inside markdown link syntax, don't replace
      if (beforeContext.includes('](') || afterContext.startsWith(')')) {
        return match;
      }
      
      return linkInfo.markdown;
    });
    
    // Pattern 4: Plain text that's not already in markdown link format (case-sensitive for brand names)
    const plainTextRegex = new RegExp(`\\b${escapedText}\\b`, 'g');
    processedContent = processedContent.replace(plainTextRegex, (match, offset, fullString) => {
      // Check context around the actual match position
      const contextStart = Math.max(0, offset - 10);
      const contextEnd = Math.min(fullString.length, offset + match.length + 10);
      const beforeContext = fullString.substring(contextStart, offset);
      const afterContext = fullString.substring(offset + match.length, contextEnd);
      
      // If it's already part of a markdown link, don't replace
      if (beforeContext.includes('[') && !beforeContext.includes(']') ||
          afterContext.startsWith('](') ||
          beforeContext.endsWith('[')) {
        return match;
      }
      
      // Also check if this text is immediately followed by the URL pattern (already handled above)
      if (afterContext.match(/^\s*[\:\-\u2013]?\s*https?:\/\//) || 
          afterContext.match(/^\s*[\:\-\u2013]?\s*\[[^\]]+\]\(/)) {
        return match;
      }
      
      return linkInfo.markdown;
    });
  });
  
  return processedContent;
};

interface ReportTemplateProps {
  programData: ProgramData;
  updateProgramData: (data: Partial<ProgramData>) => void;
  onComplete: () => void;
  setIsProcessing: (processing: boolean) => void;
}

const ReportTemplate: React.FC<ReportTemplateProps> = ({ programData, updateProgramData, onComplete, setIsProcessing }) => {
  const [planStatus, setPlanStatus] = useState<'idle' | 'generating' | 'complete' | 'error'>('idle');
  const [planResult, setPlanResult] = useState<string>('');

  useEffect(() => {
    generateEvaluationPlan();
  }, []);

  const generateEvaluationPlan = async () => {
    setIsProcessing(true);
    setPlanStatus('generating');

    try {
      // Fetch admin template from database
      // Note: Uses 'report_template' as database identifier
      const adminTemplate = await fetchPrompt('report_template');
      
      // Automatically inject all program data + previous steps before admin template
      const planPrompt = buildPromptWithContext(adminTemplate, {
        organizationName: programData.organizationName,
        programName: programData.programName,
        aboutProgram: programData.aboutProgram,
        scrapedContent: programData.scrapedContent,
        labeledScrapedContent: programData.labeledScrapedContent,
        programAnalysis: programData.programAnalysis,
        evaluationFramework: programData.evaluationFramework
      });

      // Make API call through backend proxy (secure - API key never exposed to frontend)
      const requestBody: any = {
        messages: [
          {
            role: 'user',
            content: planPrompt
          }
        ],
        max_tokens: 100000,
        step: 'report_template'  // Backend uses this to determine model/temperature from config
      };
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 300000); // 5 minute timeout to match backend
      
      const response = await fetch('/api/openrouter/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      
      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        throw new Error(`API request failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      let evaluationPlan = data.choices[0].message.content;

      // Strip code fences if present (prevents markdown from being treated as code block)
      evaluationPlan = stripCodeFences(evaluationPlan);

      // Ensure canonical hyperlinks are always present (fixes AI inconsistency with link preservation)
      evaluationPlan = ensureCanonicalLinks(evaluationPlan);

      // Validate that the response doesn't contain code fences after stripping
      if (containsCodeFences(evaluationPlan)) {
        console.warn('AI response still contains code fences after stripping. This may affect markdown rendering.');
        // Could implement retry logic here if needed
      }

      setPlanResult(evaluationPlan);
      updateProgramData({ evaluationPlan: evaluationPlan });
      setPlanStatus('complete');

      // Auto-advance after a brief delay
      setTimeout(() => {
        setIsProcessing(false);
        onComplete();
      }, 2000);

    } catch (error) {
      console.error('Error generating evaluation plan:', error);
      setPlanStatus('error');
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 rounded-lg" style={{backgroundColor: '#e6f3ff'}}>
            <FileOutput className="h-6 w-6" style={{color: '#0085ca'}} />
          </div>
          <div>
            <h2 className="text-2xl font-bold" style={{color: '#30302f'}}>Evaluation Plan Generation</h2>
            <p className="text-gray-600">Creating comprehensive evaluation plan using LogicalOutcomes template</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Status Card */}
        <div 
          className="p-6 rounded-lg border"
          style={{
            backgroundColor: planStatus === 'generating' ? '#e6f3ff' :
                           planStatus === 'complete' ? '#f0f9ff' :
                           planStatus === 'error' ? '#fef2f2' :
                           '#f8fafc',
            borderColor: planStatus === 'generating' ? '#0085ca' :
                        planStatus === 'complete' ? '#10b981' :
                        planStatus === 'error' ? '#ef4444' :
                        '#e2e8f0'
          }}
        >
          <div className="flex items-center space-x-3">
            {planStatus === 'generating' && <Loader2 className="h-6 w-6 animate-spin" style={{color: '#0085ca'}} />}
            {planStatus === 'complete' && <CheckCircle className="h-6 w-6 text-green-600" />}
            {planStatus === 'error' && <AlertCircle className="h-6 w-6 text-red-600" />}
            
            <div>
              <h3 className="text-lg font-semibold" style={{color: '#30302f'}}>
                {planStatus === 'generating' && 'Generating Evaluation Plan...'}
                {planStatus === 'complete' && 'Evaluation Plan Complete'}
                {planStatus === 'error' && 'Plan Generation Failed'}
                {planStatus === 'idle' && 'Preparing Plan Generation...'}
              </h3>
              <p className="text-gray-600">
                {planStatus === 'generating' && 'Customizing LogicalOutcomes evaluation plan template with program-specific analysis'}
                {planStatus === 'complete' && 'Complete evaluation plan generated following LogicalOutcomes methodology'}
                {planStatus === 'error' && 'An error occurred during plan generation'}
                {planStatus === 'idle' && 'Setting up plan generation parameters'}
              </p>
            </div>
          </div>
        </div>

        {/* Error Recovery Options */}
        {planStatus === 'error' && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800 mb-3">
                The evaluation plan generation encountered an issue. This could be due to API connectivity or rate limits. You can:
              </p>
              <div className="flex gap-3">
                <button
                  onClick={generateEvaluationPlan}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Retry Generation
                </button>
                <button
                  onClick={() => {
                    updateProgramData({ 
                      evaluationPlan: 'Plan generation skipped by user due to error. Please contact support or try again later.'
                    });
                    setIsProcessing(false);
                    onComplete();
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Skip and Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Generation Progress */}
        {planStatus === 'generating' && (
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{backgroundColor: '#ed8b00'}}></div>
              <span className="text-sm text-gray-600">Following LogicalOutcomes template structure</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{backgroundColor: '#ed8b00', animationDelay: '0.5s'}}></div>
              <span className="text-sm text-gray-600">Customizing program summary and analysis section</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{backgroundColor: '#ed8b00', animationDelay: '1s'}}></div>
              <span className="text-sm text-gray-600">Creating program-specific logic model and evaluation framework</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{backgroundColor: '#ed8b00', animationDelay: '1.5s'}}></div>
              <span className="text-sm text-gray-600">Including standard implementation phases and roles</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{backgroundColor: '#ed8b00', animationDelay: '2s'}}></div>
              <span className="text-sm text-gray-600">Finalizing comprehensive evaluation plan</span>
            </div>
          </div>
        )}

        {/* Plan Statistics */}
        {planResult && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <div className="text-2xl font-bold text-slate-900">{Math.ceil(planResult.length / 5000)}</div>
              <div className="text-sm text-slate-600">Pages (est.)</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <div className="text-2xl font-bold text-slate-900">{planResult.split('##').length - 1}</div>
              <div className="text-sm text-slate-600">Sections</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <div className="text-2xl font-bold text-slate-900">{planResult.split('|').length > 10 ? 'Yes' : 'No'}</div>
              <div className="text-sm text-slate-600">Tables Included</div>
            </div>
          </div>
        )}

        {/* Results Preview */}
        {planResult && (
          <div className="mt-8">
            <h4 className="text-lg font-semibold text-slate-900 mb-4">Evaluation Plan Preview</h4>
            <div className="bg-slate-50 rounded-lg p-6 max-h-96 overflow-y-auto border border-slate-200">
              <div className="prose prose-sm max-w-none">
                <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans">
                  {planResult.substring(0, 2000)}...
                  
                  {planResult.length > 2000 && (
                    <span className="text-blue-600 font-medium">
                      [Preview truncated - Full plan will be displayed in final HTML report]
                    </span>
                  )}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Technical Details */}
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <h4 className="text-sm font-medium text-slate-700 mb-2">Plan Generation Details</h4>
          <div className="text-xs text-slate-600 space-y-1">
            <div>• Method: LogicalOutcomes Evaluation Planning Template</div>
            <div>• Program: {programData.programName}</div>
            <div>• Organization: {programData.organizationName}</div>
            <div>• Generated: {new Date().toLocaleString()}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportTemplate;