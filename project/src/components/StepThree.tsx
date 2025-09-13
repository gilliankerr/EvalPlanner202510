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

## Structured Data Extraction

After completing the comprehensive narrative analysis above, provide exactly one JSON object at the end with these specific keys:

- **program_type_plural**: A concise phrase describing the general type/category of program in plural form (e.g., "financial literacy programs", "mental health services", "after-school programs", "workforce development programs")
- **target_population**: A specific description of who the program serves (e.g., "low-income families in urban areas", "youth ages 12-18", "adults with substance use disorders", "rural communities")

Example JSON format:
\`\`\`json
{
  "program_type_plural": "financial literacy programs",
  "target_population": "low-income adults in Toronto"
}
\`\`\`
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

      // Extract structured JSON data from the analysis response
      let programTypePlural = '';
      let targetPopulation = '';
      
      try {
        // Look for JSON block in the response
        const jsonMatch = analysis.match(/```json\s*({[\s\S]*?})\s*```/);
        if (jsonMatch) {
          const extractedData = JSON.parse(jsonMatch[1]);
          programTypePlural = extractedData.program_type_plural || '';
          targetPopulation = extractedData.target_population || '';
        } else {
          // Fallback: look for JSON object anywhere in the text
          const jsonObjectMatch = analysis.match(/{[\s\S]*?"program_type_plural"[\s\S]*?"target_population"[\s\S]*?}/);
          if (jsonObjectMatch) {
            const extractedData = JSON.parse(jsonObjectMatch[0]);
            programTypePlural = extractedData.program_type_plural || '';
            targetPopulation = extractedData.target_population || '';
          }
        }
      } catch (error) {
        console.warn('Could not extract structured data from analysis:', error);
        // Use fallback values if extraction fails
        programTypePlural = 'programs of this type';
        targetPopulation = 'the target population described in this evaluation plan';
      }

      setAnalysisResult(analysis);
      updateProgramData({ 
        programAnalysis: analysis,
        programTypePlural: programTypePlural,
        targetPopulation: targetPopulation
      });
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

        {/* Analysis Progress */}
        {analysisStatus === 'analyzing' && (
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{backgroundColor: '#0085ca'}}></div>
              <span className="text-sm text-gray-600">Identifying target population and presenting issues</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{backgroundColor: '#0085ca', animationDelay: '0.5s'}}></div>
              <span className="text-sm text-gray-600">Analyzing core intervention strategies</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{backgroundColor: '#0085ca', animationDelay: '1s'}}></div>
              <span className="text-sm text-gray-600">Determining theoretical foundations</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{backgroundColor: '#0085ca', animationDelay: '1.5s'}}></div>
              <span className="text-sm text-gray-600">Comparing with evidence-based models</span>
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