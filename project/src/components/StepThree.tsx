import React, { useEffect, useState } from 'react';
import { Brain, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import type { ProgramData } from '../App';

interface StepThreeProps {
  programData: ProgramData;
  updateProgramData: (data: Partial<ProgramData>) => void;
  onComplete: () => void;
  setIsProcessing: (processing: boolean) => void;
}

const StepThree: React.FC<StepThreeProps> = ({ programData, updateProgramData, onComplete, setIsProcessing }) => {
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'analyzing' | 'complete' | 'error'>('idle');
  const [analysisResult, setAnalysisResult] = useState<string>('');

  useEffect(() => {
    analyzeProgram();
  }, []);

  const analyzeProgram = async () => {
    setIsProcessing(true);
    setAnalysisStatus('analyzing');

    try {
      // Prepare the analysis prompt
      const analysisPrompt = `
# Primary Objective

Analyze all available information and, using your expertise and web search as needed, define the program's key terms, goals, activities, target populations, and intended outcomes. Where details are missing, infer them based on best practices and analogous programs, clearly flagging any assumptions. Use the organization's own vocabulary when possible. Be sure you are focusing on ${programData.programName} and not on other programs delivered by the organization!

---

## Program Information

**Organization:** ${programData.organizationName}
**Program Name:** ${programData.programName}

**About the Program:**
${programData.aboutProgram}

**Web Content:**
${programData.scrapedContent}

---

## Output Requirements

Based on the provided information, do the following:

Identify and describe the underlying program model by analyzing:

• Target population and presenting issues addressed 
• Core intervention strategies and service delivery methods 
• Theoretical foundations and logic model (implicit or explicit)
• Program goals, intended outcomes, and theory of change
• Service intensity, duration, and delivery setting
• Staff roles and qualifications required

Deliver a comprehensive program model description including:

• Classification within established program typologies
• Key assumptions about how change occurs
• Primary mechanisms of action
• Comparison to similar evidence-based models in the literature
      `;

      // Make API call to OpenRouter
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openai/gpt-5',
          messages: [
            {
              role: 'user',
              content: analysisPrompt
            }
          ],
          max_tokens: 4000
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      const analysis = data.choices[0].message.content;

      setAnalysisResult(analysis);
      updateProgramData({ programAnalysis: analysis });
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
          <div className="p-2 bg-purple-100 rounded-lg">
            <Brain className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">AI Program Model Analysis</h2>
            <p className="text-slate-600">Analyzing program model using advanced AI and web search</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Status Card */}
        <div className={`p-6 rounded-lg border ${
          analysisStatus === 'analyzing' ? 'bg-blue-50 border-blue-200' :
          analysisStatus === 'complete' ? 'bg-green-50 border-green-200' :
          analysisStatus === 'error' ? 'bg-red-50 border-red-200' :
          'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center space-x-3">
            {analysisStatus === 'analyzing' && <Loader2 className="h-6 w-6 animate-spin text-blue-600" />}
            {analysisStatus === 'complete' && <CheckCircle className="h-6 w-6 text-green-600" />}
            {analysisStatus === 'error' && <AlertCircle className="h-6 w-6 text-red-600" />}
            
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                {analysisStatus === 'analyzing' && 'Analyzing Program Model...'}
                {analysisStatus === 'complete' && 'Analysis Complete'}
                {analysisStatus === 'error' && 'Analysis Failed'}
                {analysisStatus === 'idle' && 'Preparing Analysis...'}
              </h3>
              <p className="text-slate-600">
                {analysisStatus === 'analyzing' && 'Using AI to define program terms, goals, activities, and intended outcomes'}
                {analysisStatus === 'complete' && 'Program model analysis completed successfully'}
                {analysisStatus === 'error' && 'An error occurred during analysis'}
                {analysisStatus === 'idle' && 'Setting up analysis parameters'}
              </p>
            </div>
          </div>
        </div>

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

export default StepThree;