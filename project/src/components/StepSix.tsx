import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, Download, Mail } from 'lucide-react';
import { sendEmail } from '../utils/email';
import { getProcessedPrompt } from '../utils/promptApi';
import type { ProgramData } from '../App';
import styles from './StepSix.module.css';
// Import the unified report generator
// @ts-ignore - JavaScript module without TypeScript declarations
import { generateFullHtmlDocument } from '../utils/reportGenerator';

interface StepSixProps {
  programData: ProgramData;
  updateProgramData: (data: Partial<ProgramData>) => void;
  onComplete: () => void;
  setIsProcessing: (processing: boolean) => void;
}

const StepSix: React.FC<StepSixProps> = ({ programData, onComplete, setIsProcessing }) => {
  const [renderStatus, setRenderStatus] = useState<'idle' | 'rendering' | 'complete'>('idle');
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

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
      const templateContent = await getProcessedPrompt('email_delivery');
      
      if (!templateContent) {
        throw new Error('Failed to fetch email template');
      }

      // Format the email body with proper HTML
      let emailBody = templateContent;
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

      // Replace template variables
      emailBody = emailBody
        .replace(/\{\{programName\}\}/g, programData.programName)
        .replace(/\{\{organizationName\}\}/g, programData.organizationName)
        .replace(/\{\{currentDateTime\}\}/g, currentDateTime);

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
        alert('Email sent successfully! Please check your inbox.');
      } else {
        setEmailStatus('error');
        alert('Failed to send email. Please try again.');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      setEmailStatus('error');
      alert('Failed to send email. Please try again later.');
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
            <h2>✅ HTML Report Ready!</h2>
            <p>Your evaluation plan has been successfully converted to HTML format.</p>
          </div>
          
          <div className={styles.actionButtons}>
            <button 
              onClick={downloadHtml}
              className={styles.downloadButton}
            >
              <Download size={20} />
              Download HTML Report
            </button>
            
            <button 
              onClick={sendEmailReport}
              className={styles.emailButton}
            >
              <Mail size={20} />
              Email Report
            </button>
          </div>
          
          <div className={styles.previewFrame}>
            <h3>Report Preview</h3>
            <iframe 
              srcDoc={htmlContent}
              title="Report Preview"
              className={styles.iframe}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default StepSix;