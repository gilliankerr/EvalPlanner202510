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
            This AI-powered tool helps nonprofit organizations create customized evaluation plans 
            for their programs. It's based on the{' '}
            <a 
              href="https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4815131" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: '#2563eb', textDecoration: 'underline' }}
            >
              LogicalOutcomes Evaluation Planning Handbook
            </a>
            , a simplified evaluation framework designed specifically for nonprofit programs.
          </p>
          
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>How it works:</h3>
            <ol className={styles.list}>
              <li><strong>Enter your program details:</strong> Provide your organization name, program name, description, and relevant website URLs</li>
              <li><strong>Automated web research:</strong> The system extracts and analyzes content from the websites you provide</li>
              <li><strong>AI-powered analysis:</strong> Advanced AI analyzes your program model, identifies key components, activities, and outcomes</li>
              <li><strong>Evaluation framework generation:</strong> A customized evaluation plan is created with specific indicators, data collection methods, and measurement strategies</li>
              <li><strong>Report delivery:</strong> Your completed evaluation plan is emailed to you as a formatted HTML report (and accessible in your browser for 6 hours)</li>
            </ol>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Key features:</h3>
            <ul className={styles.list}>
              <li><strong>Email delivery:</strong> Reports are automatically emailed to you when complete—no need to keep your browser open</li>
              <li><strong>Privacy-focused:</strong> All your data is automatically deleted from our systems 6 hours after your report is generated</li>
              <li><strong>AI-powered insights:</strong> Uses advanced AI models to provide tailored evaluation recommendations based on your specific program</li>
              <li><strong>Professional output:</strong> Generates comprehensive, ready-to-use evaluation plans in HTML format</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>About this service:</h3>
            <p className={styles.paragraph}>
              This tool is funded to serve Canadian nonprofit organizations, helping them develop 
              effective evaluation strategies without requiring specialized expertise or extensive resources.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default AboutApp;
