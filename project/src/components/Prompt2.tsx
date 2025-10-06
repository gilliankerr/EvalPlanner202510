import React, { useEffect, useState } from 'react';
import { Sparkles, Loader2, CheckCircle } from 'lucide-react';
import type { ProgramData } from '../App';
import { fetchPrompt, buildPromptWithContext } from '../utils/promptApi';
import styles from './Prompt.module.css';

interface Prompt2Props {
  programData: ProgramData;
  updateProgramData: (data: Partial<ProgramData>) => void;
  onComplete: () => void;
  setIsProcessing: (processing: boolean) => void;
}

const Prompt2: React.FC<Prompt2Props> = ({ programData, updateProgramData, onComplete, setIsProcessing }) => {
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'analyzing' | 'complete' | 'error'>('idle');
  const [analysisResult, setAnalysisResult] = useState<string>('');

  useEffect(() => {
    analyzeProgram();
  }, []);

  const analyzeProgram = async () => {
    setIsProcessing(true);
    setAnalysisStatus('analyzing');

    try {
      const adminTemplate = await fetchPrompt('prompt2');
      
      const analysisPrompt = buildPromptWithContext(adminTemplate, {
        organizationName: programData.organizationName,
        programName: programData.programName,
        aboutProgram: programData.aboutProgram,
        scrapedContent: programData.scrapedContent,
        labeledScrapedContent: programData.labeledScrapedContent,
        programAnalysis: programData.programAnalysis
      });

      const requestBody: any = {
        messages: [
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        max_tokens: 4000,
        step: 'prompt2'
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
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      const framework = data.choices[0].message.content;

      setAnalysisResult(framework);
      updateProgramData({ evaluationFramework: framework });
      setAnalysisStatus('complete');

      setTimeout(() => {
        setIsProcessing(false);
        onComplete();
      }, 2000);

    } catch (error) {
      console.error('Error analyzing program:', error);
      setAnalysisStatus('error');
      setIsProcessing(false);
    }
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
                {analysisStatus === 'analyzing' && 'Using AI to define program terms, goals, activities, and intended outcomes'}
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
                The evaluation framework generation encountered an issue. This could be due to API connectivity or rate limits. You can:
              </p>
              <div className={styles.buttonGroup}>
                <button
                  onClick={analyzeProgram}
                  className={styles.primaryButton}
                >
                  Retry Generation
                </button>
                <button
                  onClick={() => {
                    updateProgramData({ 
                      evaluationFramework: 'Framework generation skipped by user due to error'
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

export default Prompt2;
