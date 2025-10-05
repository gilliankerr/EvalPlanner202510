import { useState } from 'react';
import { Loader2, Settings } from 'lucide-react';
import logoIcon from './assets/logo.jpg';
import StepOne from './components/StepOne';
import StepTwo from './components/StepTwo';
import Prompt1 from './components/Prompt1';
import Prompt2 from './components/Prompt2';
import ReportTemplate from './components/ReportTemplate';
import StepSix from './components/StepSix';
import PromptAdmin from './components/PromptAdmin';
import PrivacyPolicy from './components/PrivacyPolicy';
import StepProgress from './components/StepProgress';
import { TOTAL_STEPS } from './config/workflow';
import styles from './App.module.css';

/*
 * Component Naming Convention:
 * UI Components use names aligned with the Admin interface:
 *   - Prompt1 (Step 3) → Database: prompt1
 *   - Prompt2 (Step 4) → Database: prompt2
 *   - ReportTemplate (Step 5) → Database: report_template
 * 
 * Environment Variables:
 *   - VITE_PROMPT1_MODEL, VITE_PROMPT1_TEMPERATURE
 *   - VITE_PROMPT2_MODEL, VITE_PROMPT2_TEMPERATURE
 *   - VITE_REPORT_TEMPLATE_MODEL, VITE_REPORT_TEMPLATE_TEMPERATURE
 * 
 * Workflow Configuration:
 *   - See config/workflow.ts for phase definitions and customization
 *   - UI displays 3 phases but maintains 6 backend steps for processing
 */

import type { LabeledScrapeResult } from './utils/scrape';

export interface ProgramData {
  organizationName: string;
  programName: string;
  aboutProgram: string;
  userEmail: string;
  deliveryMethod: string;
  urls: string[];
  scrapedContent: string;
  labeledScrapedContent?: LabeledScrapeResult[];
  programAnalysis: string;
  programTypePlural: string;
  targetPopulation: string;
  evaluationFramework: string;
  evaluationPlan: string;
}

function App() {
  const [showAdmin, setShowAdmin] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [programData, setProgramData] = useState<ProgramData>({
    organizationName: '',
    programName: '',
    aboutProgram: '',
    userEmail: '',
    deliveryMethod: 'download',
    urls: [],
    scrapedContent: '',
    programAnalysis: '',
    programTypePlural: '',
    targetPopulation: '',
    evaluationFramework: '',
    evaluationPlan: '',
  });

  const updateProgramData = (data: Partial<ProgramData>) => {
    setProgramData(prev => ({ ...prev, ...data }));
  };

  const markStepComplete = (stepNumber: number) => {
    setCompletedSteps(prev => [...prev, stepNumber]);
  };

  const goToNextStep = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <StepOne 
            programData={programData} 
            updateProgramData={updateProgramData}
            onComplete={() => {
              markStepComplete(1);
              goToNextStep();
            }}
            setIsProcessing={setIsProcessing}
          />
        );
      case 2:
        return (
          <StepTwo 
            programData={programData}
            updateProgramData={updateProgramData}
            onComplete={() => {
              markStepComplete(2);
              goToNextStep();
            }}
            setIsProcessing={setIsProcessing}
          />
        );
      case 3:
        return (
          <Prompt1 
            programData={programData}
            updateProgramData={updateProgramData}
            onComplete={() => {
              markStepComplete(3);
              goToNextStep();
            }}
            setIsProcessing={setIsProcessing}
          />
        );
      case 4:
        return (
          <Prompt2 
            programData={programData}
            updateProgramData={updateProgramData}
            onComplete={() => {
              markStepComplete(4);
              goToNextStep();
            }}
            setIsProcessing={setIsProcessing}
          />
        );
      case 5:
        return (
          <ReportTemplate 
            programData={programData}
            updateProgramData={updateProgramData}
            onComplete={() => {
              markStepComplete(5);
              goToNextStep();
            }}
            setIsProcessing={setIsProcessing}
          />
        );
      case 6:
        return (
          <StepSix 
            programData={programData}
            updateProgramData={updateProgramData}
            onComplete={() => {
              markStepComplete(6);
            }}
            setIsProcessing={setIsProcessing}
          />
        );
      default:
        return null;
    }
  };

  if (showAdmin) {
    return <PromptAdmin onBack={() => setShowAdmin(false)} />;
  }

  return (
    <div className={styles.appContainer}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <div className={styles.logoContainer}>
              <img src={logoIcon} alt="Evaluation Planner" className={styles.logo} />
            </div>
            <div>
              <h1 className={styles.headerTitle}>Evaluation Planner</h1>
              <p className={styles.headerSubtitle}>Based on LogicalOutcomes Evaluation Planning Handbook</p>
            </div>
          </div>
          <div className={styles.headerRight}>
            {isProcessing && (
              <div className={styles.processingIndicator}>
                <Loader2 className={styles.processingIcon} />
                <span className={styles.processingText}>Processing...</span>
              </div>
            )}
            <button
              onClick={() => setShowAdmin(true)}
              className={styles.adminButton}
            >
              <Settings className={styles.adminIcon} />
              <span className={styles.adminButtonText}>Admin</span>
            </button>
          </div>
        </div>
      </header>

      <StepProgress 
        currentStep={currentStep}
        completedSteps={completedSteps}
        isProcessing={isProcessing}
      />

      <main className={styles.mainContent}>
        <div className={styles.contentCard}>
          {renderStep()}
        </div>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <details className={styles.aboutSection}>
            <summary className={styles.aboutSummary}>About this app</summary>
            <div className={styles.aboutContent}>
              <p className={styles.aboutParagraph}>
                This tool guides users through creating evaluation plans for nonprofit programs. 
                It's based on the{' '}
                <a 
                  href="https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4815131" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={styles.aboutLink}
                >
                  LogicalOutcomes Evaluation Planning Handbook
                </a>
                , a simplified evaluation framework designed for nonprofit programs.
              </p>
              <p className={styles.aboutSubheading}>Process:</p>
              <ol className={styles.aboutList}>
                <li>Users enter program information and relevant URLs</li>
                <li>The system extracts content from provided websites</li>
                <li>AI analyzes the program model and identifies key components</li>
                <li>An evaluation framework is generated based on the analysis</li>
                <li>A formatted HTML report is produced for download or email delivery</li>
              </ol>
            </div>
          </details>
          
          <p className={styles.footerText}>
            Powered by LogicalOutcomes Evaluation Planning Framework
          </p>
          
          <div className={styles.footerLinks}>
            <a 
              href="https://logicaloutcomes.net" 
              target="_blank" 
              rel="noopener noreferrer"
              className={styles.footerLink}
            >
              Visit LogicalOutcomes
            </a>
            <span className={styles.footerLinkSeparator}>•</span>
            <button 
              onClick={() => setShowPrivacyPolicy(true)}
              className={styles.footerLinkButton}
            >
              Privacy Policy
            </button>
          </div>
        </div>
      </footer>
      
      {showPrivacyPolicy && (
        <PrivacyPolicy onClose={() => setShowPrivacyPolicy(false)} />
      )}
    </div>
  );
}

export default App;
