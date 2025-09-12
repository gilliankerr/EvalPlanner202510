import React, { useState } from 'react';
import { FileText, Globe, Brain, Clipboard, FileOutput, Download, Loader2, ChevronRight, Check } from 'lucide-react';
import StepOne from './components/StepOne';
import StepTwo from './components/StepTwo';
import StepThree from './components/StepThree';
import StepFour from './components/StepFour';
import StepFive from './components/StepFive';
import StepSix from './components/StepSix';

export interface ProgramData {
  organizationName: string;
  programName: string;
  aboutProgram: string;
  urls: string[];
  scrapedContent: string;
  programAnalysis: string;
  evaluationFramework: string;
  evaluationPlan: string;
}

const steps = [
  { id: 1, title: 'Program Information', icon: FileText, description: 'Collect program details' },
  { id: 2, title: 'Extract Content', icon: Globe, description: '' },
  { id: 3, title: 'Program Analysis', icon: Brain, description: 'AI-powered program model analysis' },
  { id: 4, title: 'Evaluation Framework', icon: Clipboard, description: 'Generate evaluation framework' },
  { id: 5, title: 'Plan Generation', icon: FileOutput, description: 'Create comprehensive plan' },
  { id: 6, title: 'HTML Report', icon: Download, description: 'Render final report' }
];

function App() {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [programData, setProgramData] = useState<ProgramData>({
    organizationName: '',
    programName: '',
    aboutProgram: '',
    urls: [],
    scrapedContent: '',
    programAnalysis: '',
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
          <StepThree 
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
          <StepFour 
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
          <StepFive 
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Evaluation Planner</h1>
                <p className="text-sm text-slate-600">AI-powered nonprofit program evaluation planning</p>
              </div>
            </div>
            {isProcessing && (
              <div className="flex items-center space-x-2 text-blue-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm font-medium">Processing...</span>
              </div>
            )}
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
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 ${
                    completedSteps.includes(step.id) 
                      ? 'bg-green-600 border-green-600 text-white' 
                      : currentStep === step.id 
                        ? 'bg-blue-600 border-blue-600 text-white' 
                        : 'bg-white border-slate-300 text-slate-400'
                  }`}>
                    {completedSteps.includes(step.id) ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <step.icon className="h-5 w-5" />
                    )}
                  </div>
                  <div className="text-center">
                    <p className={`text-sm font-medium ${
                      currentStep === step.id ? 'text-blue-600' : 
                      completedSteps.includes(step.id) ? 'text-green-600' : 'text-slate-500'
                    }`}>
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
      <footer className="bg-slate-900 text-white mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p className="text-slate-400">
              Powered by LogicalOutcomes Evaluation Planning Framework
            </p>
            <p className="text-sm text-slate-500 mt-2">
              AI-enhanced evaluation planning for nonprofit organizations
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;