import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, Download } from 'lucide-react';
import type { ProgramData } from '../App';
import styles from './StepSix.module.css';
// Import the unified report generator
// @ts-ignore - JavaScript module without TypeScript declarations
import { generateFullHtmlDocument } from '../utils/reportGenerator.js';

interface StepSixProps {
  programData: ProgramData;
  updateProgramData: (data: Partial<ProgramData>) => void;
  onComplete: () => void;
  setIsProcessing: (processing: boolean) => void;
}

const StepSix: React.FC<StepSixProps> = ({ programData, onComplete, setIsProcessing }) => {
  const [renderStatus, setRenderStatus] = useState<'idle' | 'rendering' | 'complete'>('idle');
  const [htmlContent, setHtmlContent] = useState<string>('');

  useEffect(() => {
    renderHtmlReport();
  }, []);

  const renderHtmlReport = async () => {
    setIsProcessing(true);
    setRenderStatus('rendering');

    // Simulate rendering process
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      // Validate evaluation plan exists
      if (!programData.evaluationPlan || programData.evaluationPlan.trim().length === 0) {
        throw new Error('No evaluation plan content available. Please regenerate the plan.');
      }

      console.log('Generating HTML from evaluation plan...');
      console.log('Evaluation plan length:', programData.evaluationPlan.length);
      
      // Use the unified HTML generation function
      const htmlReport = generateFullHtmlDocument(programData.evaluationPlan, {
        programName: programData.programName,
        organizationName: programData.organizationName,
        includePrintButton: true  // Include print button for downloads
      });
      
      if (!htmlReport || htmlReport.trim().length === 0) {
        throw new Error('HTML generation returned empty content');
      }
      
      console.log('HTML report generated successfully, length:', htmlReport.length);
      setHtmlContent(htmlReport);
      setRenderStatus('complete');
      setIsProcessing(false);
      onComplete();
    } catch (error) {
      console.error('Error rendering HTML report:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        error: error
      });
      setRenderStatus('idle');
      setIsProcessing(false);
      alert(`Failed to render HTML report: ${error instanceof Error ? error.message : 'Unknown error'}. Please try regenerating the plan.`);
    }
  };

  // Download HTML functionality
  const downloadHtml = useCallback(() => {
    try {
      if (!htmlContent || htmlContent.trim().length === 0) {
        alert('No HTML content available for download. Please try regenerating the report.');
        return;
      }

      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      const filename = `${programData.organizationName}_${programData.programName}_Evaluation_Plan.html`.replace(/[^a-zA-Z0-9._-]/g, '_');
      
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      
      // Clean up after a short delay
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
      
    } catch (error) {
      console.error('Error downloading HTML:', error);
      alert(`Failed to download HTML file: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
    }
  }, [htmlContent, programData.organizationName, programData.programName]);


  return (
    <div className={styles.container}>
      {renderStatus === 'rendering' && (
        <div className={styles.loadingContainer}>
          <Loader2 className={styles.spinner} size={48} />
          <h2>Rendering HTML Report</h2>
          <p>Converting your evaluation plan to a formatted HTML document...</p>
        </div>
      )}
      
      {renderStatus === 'complete' && (
        <div className={styles.downloadContainer}>
          <div className={styles.successMessage}>
            <h2>✅ Your Evaluation Plan is Ready!</h2>
            <p className={styles.emailNotification}>
              Download the report below. It has already been emailed to <strong>{programData.userEmail}</strong>.
            </p>
          </div>
          
          <button 
            onClick={downloadHtml}
            className={styles.downloadButton}
          >
            <Download size={24} />
            <div className={styles.buttonContent}>
              <span className={styles.buttonTitle}>Download Report</span>
              <span className={styles.buttonSubtitle}>Can be printed to PDF, posted on the web or pasted into Word</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};

export default StepSix;