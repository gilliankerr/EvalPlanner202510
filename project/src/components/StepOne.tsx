import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import type { ProgramData } from '../App';
import styles from './StepOne.module.css';

interface StepOneProps {
  programData: ProgramData;
  updateProgramData: (data: Partial<ProgramData>) => void;
  onComplete: () => void;
  setIsProcessing: (processing: boolean) => void;
}

const StepOne: React.FC<StepOneProps> = ({ programData, updateProgramData, onComplete, setIsProcessing }) => {
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const extractUrlsFromText = (text: string): string[] => {
    if (!text) return [];
    
    // Regex to match URLs (http, https, www)
    const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi;
    const matches = text.match(urlRegex) || [];
    
    return matches.map(url => {
      // Add https:// to www URLs
      if (url.startsWith('www.')) {
        return 'https://' + url;
      }
      return url;
    }).filter(url => {
      // Basic validation - must have a domain
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    });
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!programData.organizationName.trim()) {
      newErrors.organizationName = 'Organization name is required';
    }

    if (!programData.programName.trim()) {
      newErrors.programName = 'Program name is required';
    }

    if (!programData.aboutProgram.trim()) {
      newErrors.aboutProgram = 'Program description is required';
    }

    if (programData.deliveryMethod === 'email') {
      if (!programData.userEmail.trim()) {
        newErrors.userEmail = 'Email address is required for email delivery';
      } else if (!/\S+@\S+\.\S+/.test(programData.userEmail)) {
        newErrors.userEmail = 'Please enter a valid email address';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    const extractedUrls = extractUrlsFromText(programData.aboutProgram);
    updateProgramData({ urls: extractedUrls });
    
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      onComplete();
    }, 1000);
  };

  return (
    <div className={styles.formContainer}>
      <div className={styles.formHeader}>
        <h2 className={styles.formTitle}>Provide information</h2>
        <p className={styles.formSubtitle}>Enter details about the program you want to evaluate</p>
      </div>

      <div className={styles.formFields}>
        {/* Organization Name */}
        <div className={styles.fieldGroup}>
          <label className={styles.staticLabel}>
            Organization name<span className={styles.requiredStar}>*</span>
          </label>
          <input
            type="text"
            value={programData.organizationName}
            onChange={(e) => updateProgramData({ organizationName: e.target.value })}
            className={`${styles.input} ${errors.organizationName ? styles.inputError : ''}`}
            placeholder="Enter organization or partnership name"
          />
          <p className={styles.helperText}>
            The name of your organization or partnership
          </p>
          {errors.organizationName && (
            <p className={styles.errorMessage}>
              <AlertCircle className={styles.errorIcon} />
              {errors.organizationName}
            </p>
          )}
        </div>

        {/* Program Name */}
        <div className={styles.fieldGroup}>
          <label className={styles.staticLabel}>
            Program name<span className={styles.requiredStar}>*</span>
          </label>
          <input
            type="text"
            value={programData.programName}
            onChange={(e) => updateProgramData({ programName: e.target.value })}
            className={`${styles.input} ${errors.programName ? styles.inputError : ''}`}
            placeholder="Program name or 'All Programs'"
          />
          <p className={styles.helperText}>
            Enter the program name. To evaluate the entire organization, write 'All Programs'
          </p>
          {errors.programName && (
            <p className={styles.errorMessage}>
              <AlertCircle className={styles.errorIcon} />
              {errors.programName}
            </p>
          )}
        </div>

        {/* About the Program */}
        <div className={styles.fieldGroup}>
          <label className={styles.staticLabel}>
            About the program<span className={styles.requiredStar}>*</span>
          </label>
          <textarea
            value={programData.aboutProgram}
            onChange={(e) => updateProgramData({ aboutProgram: e.target.value })}
            className={`${styles.textarea} ${errors.aboutProgram ? styles.inputError : ''}`}
            placeholder="Enter URLs or paste program information here&#10;&#10;Example: https://example.org/about-program.html"
          />
          <p className={styles.helperText}>
            Include web page URLs describing the program and organization. You can also paste text from funding proposals, reports, or your own knowledge.
          </p>
          {errors.aboutProgram && (
            <p className={styles.errorMessage}>
              <AlertCircle className={styles.errorIcon} />
              {errors.aboutProgram}
            </p>
          )}
          {programData.aboutProgram && extractUrlsFromText(programData.aboutProgram).length > 0 && (
            <div className={styles.urlBox}>
              <p className={styles.urlTitle}>
                URLs detected ({extractUrlsFromText(programData.aboutProgram).length})
              </p>
              <ul className={styles.urlList}>
                {extractUrlsFromText(programData.aboutProgram).map((url, index) => (
                  <li key={index} className={styles.urlItem}>• {url}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Delivery Method */}
        <div className={styles.fieldGroup}>
          <label className={styles.staticLabel}>
            How would you like to receive your evaluation plan?
          </label>
          <p className={styles.processingNote}>
            Report generation takes 5-10 minutes depending on program complexity. You can choose to download immediately or receive by email.
          </p>
          <div className={styles.radioGroup}>
            <label className={styles.radioOption}>
              <input
                type="radio"
                value="download"
                checked={programData.deliveryMethod === 'download'}
                onChange={(e) => updateProgramData({ deliveryMethod: e.target.value })}
                className={styles.radioInput}
              />
              <div className={styles.radioContent}>
                <span className={styles.radioLabel}>Download when ready</span>
                <p className={styles.radioDescription}>
                  Keep your browser open while the report generates
                </p>
              </div>
            </label>
            
            <label className={styles.radioOption}>
              <input
                type="radio"
                value="email"
                checked={programData.deliveryMethod === 'email'}
                onChange={(e) => updateProgramData({ deliveryMethod: e.target.value })}
                className={styles.radioInput}
              />
              <div className={styles.radioContent}>
                <span className={styles.radioLabel}>Email me when complete</span>
                <p className={styles.radioDescription}>
                  Close your browser anytime - you'll receive the report via email within 10 minutes
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Email Address - Only show when email delivery is selected */}
        {programData.deliveryMethod === 'email' && (
          <div className={styles.fieldGroup}>
            <label className={styles.staticLabel}>
              Email address<span className={styles.requiredStar}>*</span>
            </label>
            <input
              type="email"
              value={programData.userEmail}
              onChange={(e) => updateProgramData({ userEmail: e.target.value })}
              className={`${styles.input} ${errors.userEmail ? styles.inputError : ''}`}
              placeholder="your@email.com"
            />
            {errors.userEmail && (
              <p className={styles.errorMessage}>
                <AlertCircle className={styles.errorIcon} />
                {errors.userEmail}
              </p>
            )}
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          className={styles.submitButton}
        >
          Continue to next step
        </button>
      </div>
    </div>
  );
};

export default StepOne;