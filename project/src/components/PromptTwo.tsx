import React, { useEffect, useState } from 'react';
import { Brain, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import type { ProgramData } from '../App';
import { fetchPrompt, buildPromptWithContext } from '../utils/promptApi';

interface PromptTwoProps {
  programData: ProgramData;
  updateProgramData: (data: Partial<ProgramData>) => void;
  onComplete: () => void;
  setIsProcessing: (processing: boolean) => void;
}

const PromptTwo: React.FC<PromptTwoProps> = ({ programData, updateProgramData, onComplete, setIsProcessing }) => {
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'analyzing' | 'complete' | 'error'>('idle');
  const [analysisResult, setAnalysisResult] = useState<string>('');

  useEffect(() => {
    analyzeProgram();
  }, []);

  const analyzeProgram = async () => {
    setIsProcessing(true);
    setAnalysisStatus('analyzing');

    try {
      // Fetch admin template from database
      // Note: Uses 'step4_framework' as database identifier (mapped to "Prompt 2" in UI)
      const adminTemplate = await fetchPrompt('step4_framework');
      
      // Automatically inject all program data + Step 3 analysis before admin template
      const analysisPrompt = buildPromptWithContext(adminTemplate, {
        organizationName: programData.organizationName,
        programName: programData.programName,
        aboutProgram: programData.aboutProgram,
        scrapedContent: programData.scrapedContent,
        labeledScrapedContent: programData.labeledScrapedContent,
        programAnalysis: programData.programAnalysis
      });

      // Make API call to OpenRouter
      const model = import.meta.env.VITE_STEP4_MODEL || 'openai/gpt-5';
      const temperature = import.meta.env.VITE_STEP4_TEMPERATURE ? parseFloat(import.meta.env.VITE_STEP4_TEMPERATURE) : undefined;
      
      const requestBody: any = {
        model,
        messages: [
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        max_tokens: 4000
      };
      
      if (temperature !== undefined) {
        requestBody.temperature = temperature;
      }
      
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      const framework = data.choices[0].message.content;

      setAnalysisResult(framework);
      updateProgramData({ evaluationFramework: framework });
      setAnalysisStatus('complete');

      // Auto-advance after a brief delay
      setTimeout(() => {
        setIsProcessing(false);
        onComplete();
      }, 2000);

    } catch (error) {
      console.error('Error analyzing program:', error);
      setAnalysisStatus('error');
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 rounded-lg" style={{backgroundColor: '#e6f3ff'}}>
            <Brain className="h-6 w-6" style={{color: '#0085ca'}} />
          </div>
          <div>
            <h2 className="text-2xl font-bold" style={{color: '#30302f'}}>AI Program Model Analysis</h2>
            <p className="text-gray-600">Analyzing program model using advanced AI and web search</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Status Card */}
        <div 
          className="p-6 rounded-lg border"
          style={{
            backgroundColor: analysisStatus === 'analyzing' ? '#e6f3ff' :
                           analysisStatus === 'complete' ? '#f0f9ff' :
                           analysisStatus === 'error' ? '#fef2f2' :
                           '#f8fafc',
            borderColor: analysisStatus === 'analyzing' ? '#0085ca' :
                        analysisStatus === 'complete' ? '#10b981' :
                        analysisStatus === 'error' ? '#ef4444' :
                        '#e2e8f0'
          }}
        >
          <div className="flex items-center space-x-3">
            {analysisStatus === 'analyzing' && <Loader2 className="h-6 w-6 animate-spin" style={{color: '#0085ca'}} />}
            {analysisStatus === 'complete' && <CheckCircle className="h-6 w-6 text-green-600" />}
            {analysisStatus === 'error' && <AlertCircle className="h-6 w-6 text-red-600" />}
            
            <div>
              <h3 className="text-lg font-semibold" style={{color: '#30302f'}}>
                {analysisStatus === 'analyzing' && 'Analyzing Program Model...'}
                {analysisStatus === 'complete' && 'Analysis Complete'}
                {analysisStatus === 'error' && 'Analysis Failed'}
                {analysisStatus === 'idle' && 'Preparing Analysis...'}
              </h3>
              <p className="text-gray-600">
                {analysisStatus === 'analyzing' && 'Using AI to define program terms, goals, activities, and intended outcomes'}
                {analysisStatus === 'complete' && 'Program model analysis completed successfully'}
                {analysisStatus === 'error' && 'An error occurred during analysis'}
                {analysisStatus === 'idle' && 'Setting up analysis parameters'}
              </p>
            </div>
          </div>
        </div>

        {/* Error Recovery Options */}
        {analysisStatus === 'error' && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800 mb-3">
                The evaluation framework generation encountered an issue. This could be due to API connectivity or rate limits. You can:
              </p>
              <div className="flex gap-3">
                <button
                  onClick={analyzeProgram}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Retry Generation
                </button>
                <button
                  onClick={() => {
                    updateProgramData({ 
                      evaluationFramework: 'Framework generation skipped by user due to error'
                    });
                    setIsProcessing(false);
                    onComplete();
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Skip and Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Analysis Progress */}
        {analysisStatus === 'analyzing' && (
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
              <span className="text-sm text-slate-600">Identifying target population and presenting issues</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
              <span className="text-sm text-slate-600">Analyzing core intervention strategies</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
              <span className="text-sm text-slate-600">Determining theoretical foundations</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" style={{ animationDelay: '1.5s' }}></div>
              <span className="text-sm text-slate-600">Comparing with evidence-based models</span>
            </div>
          </div>
        )}

        {/* Results Preview */}
        {analysisResult && (
          <div className="mt-8">
            <h4 className="text-lg font-semibold text-slate-900 mb-4">Analysis Results</h4>
            <div className="bg-slate-50 rounded-lg p-6 max-h-96 overflow-y-auto border border-slate-200">
              <div className="prose prose-sm max-w-none">
                <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans">
                  {analysisResult}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Technical Details */}
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <h4 className="text-sm font-medium text-slate-700 mb-2">Analysis Details</h4>
          <div className="text-xs text-slate-600 space-y-1">
            <div>• Focus: {programData.programName}</div>
            <div>• Organization: {programData.organizationName}</div>
            <div>• Data Sources: Program description, URLs, additional context</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromptTwo;
