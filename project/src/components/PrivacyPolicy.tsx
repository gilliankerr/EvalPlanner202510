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
          <p className={styles.lastUpdated}>Last updated: October 28, 2025</p>
          
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>What information we collect</h3>
            <ul className={styles.list}>
              <li>Organization and program details you provide (name, description, URLs)</li>
              <li>Email address you provide</li>
              <li>Web content extracted from URLs you provide</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>How we use your information</h3>
            <ul className={styles.list}>
              <li><strong>Email addresses:</strong> We use your email address only to send you the completed evaluation report and to track usage of the tool. We do not add you to mailing lists or share your email with anyone.</li>
              <li><strong>Program information:</strong> Your program details and web content are sent to AI service providers (such as OpenAI or Anthropic) to generate your customized evaluation plan.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Data retention and automatic deletion</h3>
            <ul className={styles.list}>
              <li><strong>Your data is temporary:</strong> All data entered into the planner (organization name, program details) and the AI-generated reports is automatically deleted from our database 6 hours after completion or failure.</li>
              <li><strong>Email retention:</strong> Once we send your report via email, it exists in your inbox permanently (your choice). However, we delete it from our systems after 6 hours.</li>
              <li><strong>Access window:</strong> You can access your results via the web interface for 6 hours after completion, after which the data is permanently removed.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Third-party services</h3>
            <p className={styles.paragraph}>To provide this service, we share your information with the following third parties:</p>
            <ul className={styles.list}>
              <li><strong>AI providers (through OpenRouter):</strong> Your program name, organization name, descriptions, and scraped website content are sent to AI providers to generate your evaluation plan. These services operate under their own privacy policies.</li>
              <li><strong>Email service (Resend):</strong> We send your email address, program name, organization name, and the completed report to Resend for delivery. Resend operates under its own privacy policy.</li>
              <li><strong>Database (PostgreSQL/Neon):</strong> Your data is temporarily stored in our database with encryption in transit.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Data security</h3>
            <ul className={styles.list}>
              <li>All data is transmitted over secure HTTPS connections</li>
              <li>Database connections use SSL encryption</li>
              <li>We use industry-standard security practices to protect your information</li>
              <li>Automatic cleanup processes run hourly to ensure timely data deletion</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Your data rights</h3>
            <ul className={styles.list}>
              <li><strong>Control:</strong> You control what information you provide to the tool</li>
              <li><strong>Access:</strong> You can access your data through the web interface for 6 hours after submission</li>
              <li><strong>Deletion:</strong> Your data is automatically deleted after 6 hours. If you need immediate deletion, please contact your system administrator.</li>
              <li><strong>No sharing:</strong> We do not sell or share your data with third parties except as necessary to operate the tool (AI processing, email delivery)</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Questions or concerns</h3>
            <p className={styles.paragraph}>
              For privacy questions, data requests, or concerns, please contact privacy@logicaloutcomes.net or see our Privacy Policy at <a href="https://www.logicaloutcomes.net/privacy-policy" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'underline' }}>https://www.logicaloutcomes.net/privacy-policy</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
