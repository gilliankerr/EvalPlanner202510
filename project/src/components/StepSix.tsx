import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, Download, Mail } from 'lucide-react';
import { sendEmail } from '../utils/email';
import { getProcessedPrompt } from '../utils/promptApi';
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
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  useEffect(() => {
    renderHtmlReport();
  }, []);

  const renderHtmlReport = async () => {
    setIsProcessing(true);
    setRenderStatus('rendering');

    // Simulate rendering process
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      // Use the unified HTML generation function
      const htmlReport = generateFullHtmlDocument(programData.evaluationPlan, {
        programName: programData.programName,
        organizationName: programData.organizationName,
        includePrintButton: true  // Include print button for downloads
      });
      
      setHtmlContent(htmlReport);
      setRenderStatus('complete');
      setIsProcessing(false);
      onComplete();
    } catch (error) {
      console.error('Error rendering HTML report:', error);
      setRenderStatus('idle');
      setIsProcessing(false);
      alert('Failed to render HTML report. Please try again.');
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

  // Email sending function using Replit Mail integration
  const sendEmailReport = useCallback(async () => {
    try {
      setEmailStatus('sending');

      // Get the processed email template from the backend
      const currentDateTime = new Date().toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
        timeZone: 'America/Toronto'
      });

      const emailBody = await getProcessedPrompt('email_delivery', {
        programName: programData.programName,
        organizationName: programData.organizationName,
        currentDateTime: currentDateTime
      });
      
      if (!emailBody) {
        throw new Error('Failed to fetch email template');
      }

      // Create clean filename
      const orgNameClean = (programData.organizationName || 'Organization').replace(/[^a-zA-Z0-9]/g, '_');
      const progNameClean = (programData.programName || 'Program').replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${orgNameClean}_${progNameClean}_Evaluation_Plan.html`;

      // Convert emailBody from markdown to HTML if it's in markdown format
      const isMarkdown = emailBody.includes('#') || emailBody.includes('**') || emailBody.includes('*');
      const processedEmailBody = isMarkdown ? 
        `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">${emailBody.replace(/\n/g, '<br>')}</div>` : 
        emailBody;

      // Convert HTML to base64 for attachment
      const base64Content = btoa(unescape(encodeURIComponent(htmlContent)));

      // Send email using Replit Mail
      const success = await sendEmail({
        to: programData.userEmail || 'user@example.com',
        subject: `Evaluation Plan for ${programData.programName}`,
        html: processedEmailBody,
        attachments: [{
          filename: filename,
          content: base64Content,
          contentType: 'text/html',
          encoding: 'base64'
        }]
      });

      if (success) {
        setEmailStatus('sent');
      } else {
        setEmailStatus('error');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      setEmailStatus('error');
    }
  }, [htmlContent, programData]);

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
        <div className={styles.previewContainer}>
          <div className={styles.successMessage}>
            <h2>✅ Your Evaluation Plan is Ready!</h2>
            <p className={styles.emailNotification}>
              Download the report below. It has already been emailed to <strong>{programData.userEmail}</strong>.
            </p>
          </div>

          {emailStatus === 'sent' && (
            <div className={styles.emailSuccessBanner}>
              ✅ Email sent successfully! Please check your inbox.
            </div>
          )}

          {emailStatus === 'error' && (
            <div className={styles.emailErrorBanner}>
              ❌ Failed to send email. Please try again or download the report below.
            </div>
          )}
          
          <div className={styles.actionButtons}>
            <button 
              onClick={downloadHtml}
              className={styles.downloadButton}
            >
              <Download size={20} />
              <div className={styles.buttonContent}>
                <span className={styles.buttonTitle}>Download Report</span>
                <span className={styles.buttonSubtitle}>Can be printed to PDF, posted on the web or pasted into Word</span>
              </div>
            </button>
            
            <button 
              onClick={sendEmailReport}
              className={styles.emailButton}
              disabled={emailStatus === 'sending'}
            >
              {emailStatus === 'sending' ? <Loader2 className={styles.spinner} size={20} /> : <Mail size={20} />}
              <div className={styles.buttonContent}>
                <span className={styles.buttonTitle}>
                  {emailStatus === 'sending' ? 'Sending...' : 'Email Report'}
                </span>
                <span className={styles.buttonSubtitle}>Send a copy to your inbox</span>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StepSix;