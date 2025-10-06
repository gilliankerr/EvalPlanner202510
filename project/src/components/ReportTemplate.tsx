import React, { useEffect, useState } from 'react';
import { FileOutput, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import type { ProgramData } from '../App';
import { fetchPrompt, buildPromptWithContext } from '../utils/promptApi';
import styles from './ReportTemplate.module.css';

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
  const [jobId, setJobId] = useState<number | null>(null);

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

      const jobData = {
        job_type: 'report_template',
        input_data: {
          messages: [
            {
              role: 'user',
              content: planPrompt
            }
          ],
          max_tokens: 20000,
          metadata: {
            organizationName: programData.organizationName,
            programName: programData.programName
          }
        },
        email: programData.userEmail
      };
      
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(jobData)
      });

      if (!response.ok) {
        throw new Error(`Job creation failed: ${response.status}`);
      }

      const data = await response.json();
      const createdJobId = data.job_id;
      setJobId(createdJobId);
      
      console.log(`Job ${createdJobId} created, polling for results...`);
      
      pollJobStatus(createdJobId);

    } catch (error) {
      console.error('Error creating job:', error);
      setPlanStatus('error');
      setIsProcessing(false);
    }
  };

  const pollJobStatus = async (jobId: number) => {
    const maxAttempts = 200;
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch(`/api/jobs/${jobId}`);
        
        if (!response.ok) {
          throw new Error(`Job status check failed: ${response.status}`);
        }

        const job = await response.json();
        
        if (job.status === 'completed') {
          let evaluationPlan = job.result;

          // Strip code fences if present (prevents markdown from being treated as code block)
          evaluationPlan = stripCodeFences(evaluationPlan);

          // Ensure canonical hyperlinks are always present (fixes AI inconsistency with link preservation)
          evaluationPlan = ensureCanonicalLinks(evaluationPlan);

          // Validate that the response doesn't contain code fences after stripping
          if (containsCodeFences(evaluationPlan)) {
            console.warn('AI response still contains code fences after stripping. This may affect markdown rendering.');
          }

          setPlanResult(evaluationPlan);
          updateProgramData({ evaluationPlan: evaluationPlan });
          setPlanStatus('complete');

          setTimeout(() => {
            setIsProcessing(false);
            onComplete();
          }, 2000);
          
        } else if (job.status === 'failed') {
          throw new Error(job.error || 'Job processing failed');
        } else if (job.status === 'pending' || job.status === 'processing') {
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(poll, 3000);
          } else {
            throw new Error('Job timeout - processing took too long');
          }
        }
      } catch (error) {
        console.error('Error polling job status:', error);
        setPlanStatus('error');
        setIsProcessing(false);
      }
    };

    poll();
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.iconWrapper}>
            <FileOutput className={styles.icon} />
          </div>
          <div className={styles.headerContent}>
            <h2>Evaluation Plan Generation</h2>
            <p>Creating comprehensive evaluation plan using LogicalOutcomes template</p>
          </div>
        </div>
      </div>

      <div className={styles.content}>
        {/* Status Card */}
        <div 
          className={`${styles.statusCard} ${
            planStatus === 'generating' ? styles.statusCardGenerating :
            planStatus === 'complete' ? styles.statusCardComplete :
            planStatus === 'error' ? styles.statusCardError :
            styles.statusCardIdle
          }`}
        >
          <div className={styles.statusHeader}>
            {planStatus === 'generating' && <Loader2 className={styles.iconSpinning} />}
            {planStatus === 'complete' && <CheckCircle className={styles.iconGreen} />}
            {planStatus === 'error' && <AlertCircle className={styles.iconRed} />}
            
            <div>
              <h3 className={styles.statusTitle}>
                {planStatus === 'generating' && 'Generating Evaluation Plan...'}
                {planStatus === 'complete' && 'Evaluation Plan Complete'}
                {planStatus === 'error' && 'Plan Generation Failed'}
                {planStatus === 'idle' && 'Preparing Plan Generation...'}
              </h3>
              <p className={styles.statusDescription}>
                {planStatus === 'generating' && jobId && (
                  <>
                    Processing... Please keep this window open until complete. Results will be emailed to {programData.userEmail}
                    <span className={styles.jobIdText}>Job ID: {jobId}</span>
                  </>
                )}
                {planStatus === 'generating' && !jobId && 'Customizing LogicalOutcomes evaluation plan template with program-specific analysis'}
                {planStatus === 'complete' && 'Complete evaluation plan generated following LogicalOutcomes methodology'}
                {planStatus === 'error' && 'An error occurred during plan generation'}
                {planStatus === 'idle' && 'Setting up plan generation parameters'}
              </p>
            </div>
          </div>
        </div>

        {/* Error Recovery Options */}
        {planStatus === 'error' && (
          <div className={styles.errorRecovery}>
            <div className={styles.errorBox}>
              <p className={styles.errorText}>
                The evaluation plan generation encountered an issue. This could be due to API connectivity or rate limits. You can:
              </p>
              <div className={styles.errorButtons}>
                <button
                  onClick={generateEvaluationPlan}
                  className={styles.retryButton}
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
                  className={styles.skipButton}
                >
                  Skip and Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Generation Progress */}
        {planStatus === 'generating' && (
          <div className={styles.progressList}>
            <div className={styles.progressItem}>
              <div className={styles.progressDot}></div>
              <span className={styles.progressText}>Following LogicalOutcomes template structure</span>
            </div>
            <div className={styles.progressItem}>
              <div className={styles.progressDot}></div>
              <span className={styles.progressText}>Customizing program summary and analysis section</span>
            </div>
            <div className={styles.progressItem}>
              <div className={styles.progressDot}></div>
              <span className={styles.progressText}>Creating program-specific logic model and evaluation framework</span>
            </div>
            <div className={styles.progressItem}>
              <div className={styles.progressDot}></div>
              <span className={styles.progressText}>Including standard implementation phases and roles</span>
            </div>
            <div className={styles.progressItem}>
              <div className={styles.progressDot}></div>
              <span className={styles.progressText}>Finalizing comprehensive evaluation plan</span>
            </div>
          </div>
        )}

        {/* Plan Statistics */}
        {planResult && (
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{Math.ceil(planResult.length / 5000)}</div>
              <div className={styles.statLabel}>Pages (est.)</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{planResult.split('##').length - 1}</div>
              <div className={styles.statLabel}>Sections</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{planResult.split('|').length > 10 ? 'Yes' : 'No'}</div>
              <div className={styles.statLabel}>Tables Included</div>
            </div>
          </div>
        )}

        {/* Results Preview */}
        {planResult && (
          <div className={styles.previewSection}>
            <h4 className={styles.previewTitle}>Evaluation Plan Preview</h4>
            <div className={styles.previewBox}>
              <div className={styles.previewContent}>
                <pre className={styles.previewText}>
                  {planResult.substring(0, 2000)}...
                  
                  {planResult.length > 2000 && (
                    <span className={styles.previewTruncated}>
                      [Preview truncated - Full plan will be displayed in final HTML report]
                    </span>
                  )}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Technical Details */}
        <div className={styles.detailsBox}>
          <h4 className={styles.detailsTitle}>Plan Generation Details</h4>
          <div className={styles.detailsList}>
            <div>• Method: LogicalOutcomes Evaluation Planning Template</div>
            <div>• Program: {programData.programName}</div>
            <div>• Organization: {programData.organizationName}</div>
            <div>• Generated: {new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' })}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportTemplate;