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
            This tool guides users through creating evaluation plans for nonprofit programs. 
            It's based on the{' '}
            <a 
              href="https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4815131" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: '#2563eb', textDecoration: 'underline' }}
            >
              LogicalOutcomes Evaluation Planning Handbook
            </a>
            , a simplified evaluation framework designed for nonprofit programs.
          </p>
          
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Process:</h3>
            <ol className={styles.list}>
              <li>Users enter program information and relevant URLs</li>
              <li>The system extracts content from provided websites</li>
              <li>AI analyzes the program model and identifies key components</li>
              <li>An evaluation framework is generated based on the analysis</li>
              <li>A formatted HTML report is produced for download or email delivery</li>
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
};

export default AboutApp;
