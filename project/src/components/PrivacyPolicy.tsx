import React from 'react';
import { X } from 'lucide-react';
import styles from './PrivacyPolicy.module.css';

interface PrivacyPolicyProps {
  onClose: () => void;
}

const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onClose }) => {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Privacy Policy</h2>
          <button onClick={onClose} className={styles.closeButton}>
            <X size={24} />
          </button>
        </div>
        
        <div className={styles.content}>
          <p className={styles.lastUpdated}>Last updated: October 2025</p>
          
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>What information we collect</h3>
            <ul className={styles.list}>
              <li>Organization and program details you provide (name, description, URLs)</li>
              <li>Email address (if you choose email delivery)</li>
              <li>Web content extracted from URLs you provide</li>
              <li>System logs for troubleshooting purposes</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>How we use this information</h3>
            <ul className={styles.list}>
              <li>To generate your evaluation plan using AI analysis</li>
              <li>To deliver reports via email (if selected)</li>
              <li>To improve the tool's functionality and accuracy</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Data storage and security</h3>
            <ul className={styles.list}>
              <li>Program information is stored in our database during the planning process</li>
              <li>We use industry-standard security practices to protect your data</li>
              <li>Emails are sent through Resend email service</li>
              <li>AI analysis is performed by third-party AI providers (OpenAI, Anthropic, or others as configured)</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Third-party services</h3>
            <ul className={styles.list}>
              <li>AI model providers receive your program information to perform analysis</li>
              <li>Resend receives your email address if you choose email delivery</li>
              <li>These services operate under their own privacy policies</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Your data rights</h3>
            <ul className={styles.list}>
              <li>You control what information you provide</li>
              <li>We do not share your data with third parties except as needed to operate the tool (AI providers, email service)</li>
              <li>Contact your administrator for data deletion requests</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Questions</h3>
            <p className={styles.paragraph}>
              For privacy questions or data requests, contact your system administrator.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
