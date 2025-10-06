import React from 'react';
import { X } from 'lucide-react';
import styles from './PrivacyPolicy.module.css';

interface AboutAppProps {
  onClose: () => void;
}

const AboutApp: React.FC<AboutAppProps> = ({ onClose }) => {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>About this app</h2>
          <button onClick={onClose} className={styles.closeButton}>
            <X size={24} />
          </button>
        </div>
        
        <div className={styles.content}>
          <p className={styles.paragraph}>
            This tool creates evaluation plans for nonprofit programs. It's based on the{' '}
            <a 
              href="https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4815131" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: '#2563eb', textDecoration: 'underline' }}
            >
              LogicalOutcomes Evaluation Planning Handbook
            </a>
            , a simplified evaluation framework for nonprofit programs.
          </p>
          
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>How it works:</h3>
            <ol className={styles.list}>
              <li>Enter your organization name, program name, description, and relevant website URLs</li>
              <li>The system extracts content from the websites you provide</li>
              <li>AI analyzes your program model and identifies key components, activities, and outcomes</li>
              <li>An evaluation framework is generated with indicators, data collection methods, and measurement strategies</li>
              <li>The completed evaluation plan is emailed to you as an HTML report</li>
            </ol>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>What you get:</h3>
            <ul className={styles.list}>
              <li><strong>Email delivery:</strong> The report is emailed to you when processing is complete (usually takes a few minutes)</li>
              <li><strong>Browser access:</strong> Results are also available in your browser for 6 hours</li>
              <li><strong>HTML format:</strong> The report can be imported into a Word document for further editing</li>
              <li><strong>Automatic deletion:</strong> Your data is deleted from our systems 6 hours after the report is generated</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>About this tool:</h3>
            <p className={styles.paragraph}>
              This tool is funded to serve Canadian nonprofit organizations. We collect organization 
              names for internal monitoring but do not report them publicly.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default AboutApp;
