import React, { useEffect, useState } from 'react';
import { Sparkles, Loader2, CheckCircle } from 'lucide-react';
import type { ProgramData } from '../App';
import { fetchPrompt, buildPromptWithContext } from '../utils/promptApi';
import styles from './Prompt.module.css';

interface Prompt1Props {
  programData: ProgramData;
  updateProgramData: (data: Partial<ProgramData>) => void;
  onComplete: () => void;
  setIsProcessing: (processing: boolean) => void;
}

const Prompt1: React.FC<Prompt1Props> = ({ programData, updateProgramData, onComplete, setIsProcessing }) => {
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'analyzing' | 'complete' | 'error'>('idle');
  const [analysisResult, setAnalysisResult] = useState<string>('');
  const [jobId, setJobId] = useState<number | null>(null);

  useEffect(() => {
    analyzeProgram();
  }, []);

  const analyzeProgram = async () => {
    setIsProcessing(true);
    setAnalysisStatus('analyzing');

    try {
      const adminTemplate = await fetchPrompt('prompt1');
      
      const analysisPrompt = buildPromptWithContext(adminTemplate, {
        organizationName: programData.organizationName,
        programName: programData.programName,
        aboutProgram: programData.aboutProgram,
        scrapedContent: programData.scrapedContent,
        labeledScrapedContent: programData.labeledScrapedContent
      });

      const jobData = {
        job_type: 'prompt1',
        input_data: {
          messages: [
            {
              role: 'user',
              content: analysisPrompt
            }
          ],
          max_tokens: 4000
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
      setAnalysisStatus('error');
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
          const analysis = job.result;
          
          let programTypePlural = '';
          let targetPopulation = '';
          
          try {
            const jsonMatch = analysis.match(/```json\s*({[\s\S]*?})\s*```/);
            if (jsonMatch) {
              const extractedData = JSON.parse(jsonMatch[1]);
              programTypePlural = extractedData.program_type_plural || '';
              targetPopulation = extractedData.target_population || '';
            } else {
              const jsonObjectMatch = analysis.match(/{[\s\S]*?"program_type_plural"[\s\S]*?"target_population"[\s\S]*?}/);
              if (jsonObjectMatch) {
                const extractedData = JSON.parse(jsonObjectMatch[0]);
                programTypePlural = extractedData.program_type_plural || '';
                targetPopulation = extractedData.target_population || '';
              }
            }
          } catch (error) {
            console.warn('Could not extract structured data from analysis:', error);
            programTypePlural = 'programs of this type';
            targetPopulation = 'the target population described in this evaluation plan';
          }

          setAnalysisResult(analysis);
          updateProgramData({ 
            programAnalysis: analysis,
            programTypePlural: programTypePlural,
            targetPopulation: targetPopulation
          });
          setAnalysisStatus('complete');

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
        setAnalysisStatus('error');
        setIsProcessing(false);
      }
    };

    poll();
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.iconWrapper}>
            <Sparkles className={styles.icon} />
          </div>
          <div>
            <h2 className={styles.title}>AI Program Model Analysis</h2>
            <p className={styles.subtitle}>Analyzing program model using advanced AI and web search</p>
          </div>
        </div>
      </div>

      <div className={styles.content}>
        <div className={`${styles.statusCard} ${styles[analysisStatus]}`}>
          <div className={styles.statusContent}>
            {analysisStatus === 'analyzing' && <Loader2 className={`${styles.statusIcon} ${styles.analyzing}`} style={{ animation: 'spin 1s linear infinite' }} />}
            {analysisStatus === 'complete' && <CheckCircle className={`${styles.statusIcon} ${styles.complete}`} />}
            {analysisStatus === 'error' && (
              <svg className={`${styles.statusIcon} ${styles.error}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
            
            <div>
              <h3 className={styles.statusTitle}>
                {analysisStatus === 'analyzing' && 'Analyzing Program Model...'}
                {analysisStatus === 'complete' && 'Analysis Complete'}
                {analysisStatus === 'error' && 'Analysis Failed'}
                {analysisStatus === 'idle' && 'Preparing Analysis...'}
              </h3>
              <p className={styles.statusDescription}>
                {analysisStatus === 'analyzing' && (
                  <>
                    Processing in background... You can close this browser tab - results will be emailed to {programData.userEmail}
                    {jobId && <span style={{ display: 'block', marginTop: '8px', fontSize: '0.9em', opacity: 0.8 }}>Job ID: {jobId}</span>}
                  </>
                )}
                {analysisStatus === 'complete' && 'Program model analysis completed successfully'}
                {analysisStatus === 'error' && 'An error occurred during analysis'}
                {analysisStatus === 'idle' && 'Setting up analysis parameters'}
              </p>
            </div>
          </div>
        </div>

        {analysisStatus === 'error' && (
          <div className={styles.errorSection}>
            <div className={styles.errorBox}>
              <p className={styles.errorMessage}>
                The AI analysis encountered an issue. This could be due to API connectivity or rate limits. You can:
              </p>
              <div className={styles.buttonGroup}>
                <button
                  onClick={analyzeProgram}
                  className={styles.primaryButton}
                >
                  Retry Analysis
                </button>
                <button
                  onClick={() => {
                    updateProgramData({ 
                      programAnalysis: 'Analysis skipped by user due to error',
                      programTypePlural: 'programs of this type',
                      targetPopulation: 'the target population'
                    });
                    setIsProcessing(false);
                    onComplete();
                  }}
                  className={styles.secondaryButton}
                >
                  Skip and Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {analysisStatus === 'analyzing' && (
          <div className={styles.progressList}>
            <div className={styles.progressItem}>
              <div className={styles.progressDot}></div>
              <span className={styles.progressText}>Identifying target population and presenting issues</span>
            </div>
            <div className={styles.progressItem}>
              <div className={styles.progressDot} style={{ animationDelay: '0.5s' }}></div>
              <span className={styles.progressText}>Analyzing core intervention strategies</span>
            </div>
            <div className={styles.progressItem}>
              <div className={styles.progressDot} style={{ animationDelay: '1s' }}></div>
              <span className={styles.progressText}>Determining theoretical foundations</span>
            </div>
            <div className={styles.progressItem}>
              <div className={styles.progressDot} style={{ animationDelay: '1.5s' }}></div>
              <span className={styles.progressText}>Comparing with evidence-based models</span>
            </div>
          </div>
        )}

        {analysisResult && (
          <div className={styles.resultsSection}>
            <h4 className={styles.resultsTitle}>Analysis Results</h4>
            <div className={styles.resultsBox}>
              <pre className={styles.resultsContent}>
                {analysisResult}
              </pre>
            </div>
          </div>
        )}

        <div className={styles.detailsBox}>
          <h4 className={styles.detailsTitle}>Analysis Details</h4>
          <div className={styles.detailsList}>
            <div>• Focus: {programData.programName}</div>
            <div>• Organization: {programData.organizationName}</div>
            <div>• Data Sources: Program description, URLs, additional context</div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Prompt1;
