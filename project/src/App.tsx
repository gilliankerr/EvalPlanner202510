import { useState } from 'react';
import { FileText, Globe, Brain, Clipboard, FileOutput, Download, Loader2, ChevronRight, Check, Settings } from 'lucide-react';
import logoIcon from './assets/logo.jpg';
import StepOne from './components/StepOne';
import StepTwo from './components/StepTwo';
import PromptOne from './components/PromptOne';
import PromptTwo from './components/PromptTwo';
import ReportTemplate from './components/ReportTemplate';
import StepSix from './components/StepSix';
import PromptAdmin from './components/PromptAdmin';

/*
 * Component Naming Convention:
 * UI Components use descriptive names aligned with the Admin interface:
 *   - PromptOne (Step 3) → Database: step3_analysis
 *   - PromptTwo (Step 4) → Database: step4_framework
 *   - ReportTemplate (Step 5) → Database: step5_plan
 * 
 * Note: Database identifiers were kept unchanged to avoid migration complexity.
 * Each component internally references the appropriate database step_name.
 */

export interface ProgramData {
  organizationName: string;
  programName: string;
  aboutProgram: string;
  userEmail: string;
  deliveryMethod: string;
  urls: string[];
  scrapedContent: string;
  programAnalysis: string;
  programTypePlural: string;
  targetPopulation: string;
  evaluationFramework: string;
  evaluationPlan: string;
}

const steps = [
  { id: 1, title: 'Program Information', icon: FileText, description: 'Collect program details' },
  { id: 2, title: 'Extract Content', icon: Globe, description: '' },
  { id: 3, title: 'Prompt 1', icon: Brain, description: 'AI-powered program model analysis' },
  { id: 4, title: 'Prompt 2', icon: Clipboard, description: 'Generate evaluation framework' },
  { id: 5, title: 'Report Template', icon: FileOutput, description: 'Create comprehensive plan' },
  { id: 6, title: 'Document Generation', icon: Download, description: 'Render final report' }
];

function App() {
  const [showAdmin, setShowAdmin] = useState(false);
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
    if (currentStep < steps.length) {
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
          <PromptOne 
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
          <PromptTwo 
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="rounded-lg overflow-hidden">
                <img src={logoIcon} alt="Evaluation Planner" className="h-10 w-10 object-contain" />
              </div>
              <div>
                <h1 className="text-2xl font-bold" style={{color: '#30302f'}}>Evaluation Planner</h1>
                <p className="text-sm" style={{color: '#666'}}>Based on LogicalOutcomes Evaluation Planning Handbook</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {isProcessing && (
                <div className="flex items-center space-x-2" style={{color: '#0085ca'}}>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm font-medium">Processing...</span>
                </div>
              )}
              <button
                onClick={() => setShowAdmin(true)}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <Settings className="h-4 w-4" />
                <span className="text-sm font-medium">Admin</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center space-y-2">
                  <div 
                    className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 ${
                      completedSteps.includes(step.id) 
                        ? 'text-white' 
                        : currentStep === step.id 
                        ? 'text-white' 
                        : 'bg-white border-slate-300 text-slate-400'
                    }`}
                    style={{
                      backgroundColor: completedSteps.includes(step.id) ? '#ed8b00' : 
                                     currentStep === step.id ? '#0085ca' : undefined,
                      borderColor: completedSteps.includes(step.id) ? '#ed8b00' : 
                                 currentStep === step.id ? '#0085ca' : undefined
                    }}
                  >
                    {completedSteps.includes(step.id) ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <step.icon className="h-5 w-5" />
                    )}
                  </div>
                  <div className="text-center">
                    <p 
                      className="text-sm font-medium"
                      style={{
                        color: currentStep === step.id ? '#0085ca' : 
                               completedSteps.includes(step.id) ? '#ed8b00' : '#64748b'
                      }}
                    >
                      {step.title}
                    </p>
                    <p className="text-xs text-slate-400 max-w-20 leading-tight">
                      {step.description}
                    </p>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <ChevronRight className="h-5 w-5 text-slate-300 mx-4 hidden sm:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {renderStep()}
        </div>
      </main>

      {/* Footer */}
      <footer style={{backgroundColor: '#30302f'}} className="text-white mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p className="text-gray-300">
              Powered by LogicalOutcomes Evaluation Planning Framework
            </p>
            <p className="text-sm text-gray-400 mt-2">
              AI-enhanced evaluation planning for nonprofit organizations
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;