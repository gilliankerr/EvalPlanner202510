import React, { useState } from 'react';
import { FileText, AlertCircle } from 'lucide-react';
import type { ProgramData } from '../App';

interface StepOneProps {
  programData: ProgramData;
  updateProgramData: (data: Partial<ProgramData>) => void;
  onComplete: () => void;
  setIsProcessing: (processing: boolean) => void;
}

const StepOne: React.FC<StepOneProps> = ({ programData, updateProgramData, onComplete, setIsProcessing }) => {
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const extractUrlsFromText = (text: string): string[] => {
    if (!text) return [];
    
    // Regex to match URLs (http, https, www)
    const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi;
    const matches = text.match(urlRegex) || [];
    
    return matches.map(url => {
      // Add https:// to www URLs
      if (url.startsWith('www.')) {
        return 'https://' + url;
      }
      return url;
    }).filter(url => {
      // Basic validation - must have a domain
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    });
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!programData.organizationName.trim()) {
      newErrors.organizationName = 'Organization name is required';
    }

    if (!programData.programName.trim()) {
      newErrors.programName = 'Program name is required';
    }

    if (!programData.aboutProgram.trim()) {
      newErrors.aboutProgram = 'Program description is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    const extractedUrls = extractUrlsFromText(programData.aboutProgram);
    updateProgramData({ urls: extractedUrls });
    
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      onComplete();
    }, 1000);
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 rounded-lg" style={{backgroundColor: '#e6f3ff'}}>
            <FileText className="h-6 w-6" style={{color: '#0085ca'}} />
          </div>
          <div>
            <h2 className="text-2xl font-bold" style={{color: '#30302f'}}>Program Information Collection</h2>
            <p className="text-gray-600">Please provide information about the program you want to evaluate</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Organization Name */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{color: '#30302f'}}>
            Organization Name *
          </label>
          <input
            type="text"
            value={programData.organizationName}
            onChange={(e) => updateProgramData({ organizationName: e.target.value })}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 transition-colors ${
              errors.organizationName ? 'border-red-300 bg-red-50' : 'border-gray-300'
            }`}
            style={{'--tw-ring-color': '#0085ca'} as React.CSSProperties}
            placeholder="Enter organization name"
          />
          {errors.organizationName && (
            <p className="text-red-600 text-sm mt-1 flex items-center">
              <AlertCircle className="h-4 w-4 mr-1" />
              {errors.organizationName}
            </p>
          )}
        </div>

        {/* Program Name */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{color: '#30302f'}}>
            Program Name *
          </label>
          <input
            type="text"
            value={programData.programName}
            onChange={(e) => updateProgramData({ programName: e.target.value })}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 transition-colors ${
              errors.programName ? 'border-red-300 bg-red-50' : 'border-gray-300'
            }`}
            style={{'--tw-ring-color': '#0085ca'} as React.CSSProperties}
            placeholder="Enter program name"
          />
          {errors.programName && (
            <p className="text-red-600 text-sm mt-1 flex items-center">
              <AlertCircle className="h-4 w-4 mr-1" />
              {errors.programName}
            </p>
          )}
        </div>

        {/* About the Program */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{color: '#30302f'}}>
            About the Program * 
            <span className="text-sm font-normal text-gray-500">(Include URLs or paste program information)</span>
          </label>
          <textarea
            value={programData.aboutProgram}
            onChange={(e) => updateProgramData({ aboutProgram: e.target.value })}
            rows={8}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 transition-colors ${
              errors.aboutProgram ? 'border-red-300 bg-red-50' : 'border-gray-300'
            }`}
            style={{'--tw-ring-color': '#0085ca'} as React.CSSProperties}
            placeholder="Paste one or more URLs that describe the program, or write/paste information about the program from a funding proposal, report, or your own knowledge. URLs will be automatically detected and scraped for additional information."
          />
          {errors.aboutProgram && (
            <p className="text-red-600 text-sm mt-1 flex items-center">
              <AlertCircle className="h-4 w-4 mr-1" />
              {errors.aboutProgram}
            </p>
          )}
          {programData.aboutProgram && extractUrlsFromText(programData.aboutProgram).length > 0 && (
            <div className="mt-2 p-3 rounded-lg border" style={{backgroundColor: '#e6f3ff', borderColor: '#0085ca'}}>
              <p className="text-sm font-medium mb-1" style={{color: '#0085ca'}}>
                URLs detected ({extractUrlsFromText(programData.aboutProgram).length}):
              </p>
              <ul className="text-xs space-y-1" style={{color: '#006b9f'}}>
                {extractUrlsFromText(programData.aboutProgram).map((url, index) => (
                  <li key={index} className="truncate">• {url}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-6">
          <button
            onClick={handleSubmit}
            className="px-8 py-3 text-white font-medium rounded-lg focus:ring-2 focus:ring-offset-2 transition-all duration-200 shadow-sm"
            style={{backgroundColor: '#0085ca'}}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#006b9f'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0085ca'}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
};

export default StepOne;