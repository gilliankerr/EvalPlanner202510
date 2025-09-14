import React, { useEffect, useState } from 'react';
import { Globe, CheckCircle, AlertTriangle, Loader2, RotateCcw, Clock, Shield, XCircle } from 'lucide-react';
import type { ProgramData } from '../App';
import { extractAndNormalizeUrls } from '../utils/url';
import { scrapeUrls, type ScrapeResult } from '../utils/scrape';

interface StepTwoProps {
  programData: ProgramData;
  updateProgramData: (data: Partial<ProgramData>) => void;
  onComplete: () => void;
  setIsProcessing: (processing: boolean) => void;
}

const StepTwo: React.FC<StepTwoProps> = ({ programData, updateProgramData, onComplete, setIsProcessing }) => {
  const [urlResults, setUrlResults] = useState<ScrapeResult[]>([]);
  const [isLocalProcessing, setIsLocalProcessing] = useState(false);
  const [validUrls, setValidUrls] = useState<string[]>([]);

  useEffect(() => {
    // Extract and normalize URLs from both sources
    const urlsFromField = programData.urls || [];
    const extractedUrls = extractAndNormalizeUrls(programData.aboutProgram, urlsFromField);
    
    // Get valid URLs only
    const validUrlList = extractedUrls
      .filter(url => url.isValid)
      .map(url => url.normalized);
    
    setValidUrls(validUrlList);
    
    if (validUrlList.length > 0) {
      startScraping(validUrlList);
    } else {
      // If no valid URLs, skip this step
      setTimeout(() => {
        onComplete();
      }, 500);
    }
  }, []);

  const startScraping = async (urls: string[]) => {
    setIsLocalProcessing(true);
    setIsProcessing(true);
    
    // Initialize results with pending status
    const initialResults: ScrapeResult[] = urls.map(url => ({
      url,
      status: 'network_error',
      elapsedMs: 0
    }));
    setUrlResults(initialResults);
    
    try {
      const results = await scrapeUrls(urls, {
        concurrency: 3,
        timeoutMs: 10000,
        onProgress: (result) => {
          setUrlResults(prev => 
            prev.map(r => r.url === result.url ? result : r)
          );
        }
      });
      
      setUrlResults(results);
      
      // Combine successful content for program data
      const successfulContent = results
        .filter(r => r.status === 'success' && r.content)
        .map(r => r.content)
        .join('\n\n---\n\n');
      
      updateProgramData({ scrapedContent: successfulContent });
      
    } catch (error) {
      console.error('Scraping error:', error);
    } finally {
      setIsLocalProcessing(false);
      setIsProcessing(false);
      
      // Auto-advance after a brief delay
      setTimeout(() => {
        onComplete();
      }, 1500);
    }
  };

  const retryUrl = async (url: string) => {
    // Update status to pending
    setUrlResults(prev => 
      prev.map(r => r.url === url ? { ...r, status: 'network_error' as const, error: undefined } : r)
    );
    
    try {
      const results = await scrapeUrls([url], {
        timeoutMs: 10000,
        onProgress: (result) => {
          setUrlResults(prev => 
            prev.map(r => r.url === result.url ? result : r)
          );
        }
      });
      
      const result = results[0];
      if (result.status === 'success' && result.content) {
        // Update combined content using latest state
        setUrlResults(prev => {
          const next = prev.map(r => r.url === url ? result : r);
          const successfulContent = next
            .filter(r => r.status === 'success' && r.content)
            .map(r => r.content)
            .join('\n\n---\n\n');
          
          updateProgramData({ scrapedContent: successfulContent });
          return next;
        });
      }
    } catch (error) {
      console.error('Retry failed:', error);
    }
  };

  const getStatusIcon = (status: ScrapeResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'timeout':
        return <Clock className="h-5 w-5 text-orange-600" />;
      case 'rate_limited':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'blocked':
        return <Shield className="h-5 w-5 text-red-600" />;
      case 'not_found':
        return <XCircle className="h-5 w-5 text-gray-600" />;
      case 'unsupported_content':
        return <AlertTriangle className="h-5 w-5 text-purple-600" />;
      case 'network_error':
      default:
        return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />;
    }
  };

  const getStatusText = (result: ScrapeResult) => {
    switch (result.status) {
      case 'success':
        return `Completed in ${result.elapsedMs}ms${result.proxy ? ` via ${result.proxy}` : ''}`;
      case 'timeout':
        return 'Timed out after 10 seconds';
      case 'rate_limited':
        return `Rate limited${result.retryAfter ? ` - retry after ${result.retryAfter}s` : ''}`;
      case 'blocked':
        return 'Blocked by website (403 error)';
      case 'not_found':
        return 'Page not found (404 error)';
      case 'unsupported_content':
        return `Unsupported content type: ${result.contentType || 'unknown'}`;
      case 'network_error':
      default:
        return result.error || 'Processing...';
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 rounded-lg" style={{backgroundColor: '#e6f3ff'}}>
            <Globe className="h-6 w-6" style={{color: '#0085ca'}} />
          </div>
          <div>
            <h2 className="text-2xl font-bold" style={{color: '#30302f'}}>Web Content Extraction</h2>
            <p className="text-gray-600">Extracting information from provided URLs</p>
          </div>
        </div>
      </div>

      {validUrls.length === 0 ? (
        <div className="text-center py-12">
          <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2" style={{color: '#30302f'}}>No URLs to Process</h3>
          <p className="text-gray-600">
            No URLs were found in the URL fields or program description, proceeding with the text you entered.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold mb-4" style={{color: '#30302f'}}>
            Processing {validUrls.length} URL{validUrls.length > 1 ? 's' : ''}
          </h3>
          
          {/* Show URLs from program description if any */}
          {(() => {
            const extractedUrls = extractAndNormalizeUrls(programData.aboutProgram, []);
            const urlsFromText = extractedUrls.filter(url => url.isValid).map(url => url.normalized);
            
            return urlsFromText.length > 0 && (
              <div className="mb-4 p-3 rounded-lg border" style={{backgroundColor: '#e6f3ff', borderColor: '#0085ca'}}>
                <p className="text-sm" style={{color: '#0085ca'}}>
                  <strong>Found {urlsFromText.length} URL{urlsFromText.length > 1 ? 's' : ''} in program description:</strong>
                </p>
                <ul className="text-xs mt-1 ml-4" style={{color: '#006b9f'}}>
                  {urlsFromText.map((url, index) => (
                    <li key={index} className="truncate">{url}</li>
                  ))}
                </ul>
              </div>
            );
          })()}
          
          {/* URL Results */}
          {urlResults.map((result, index) => {
            const canRetry = ['timeout', 'rate_limited', 'network_error'].includes(result.status);
            const isFromDescription = (() => {
              const extractedUrls = extractAndNormalizeUrls(programData.aboutProgram, []);
              return extractedUrls.some(url => url.normalized === result.url);
            })();
            
            return (
              <div
                key={index}
                className="flex items-start space-x-4 p-4 bg-slate-50 rounded-lg border border-slate-200"
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getStatusIcon(result.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {result.url}
                  </p>
                  <p className="text-sm text-slate-500">
                    {getStatusText(result)}
                    {isFromDescription && (
                      <span className="ml-2 text-xs text-blue-600">(from description)</span>
                    )}
                  </p>
                  {result.error && result.status !== 'network_error' && (
                    <p className="text-xs text-red-600 mt-1">
                      {result.error}
                    </p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {result.status === 'success' && result.content && (
                    <div className="text-xs text-slate-400">
                      {result.content.length} chars
                      {result.truncated && <span className="text-orange-500 ml-1">truncated</span>}
                    </div>
                  )}
                  {canRetry && !isLocalProcessing && (
                    <button
                      onClick={() => retryUrl(result.url)}
                      className="flex items-center space-x-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                      title="Retry this URL"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Retry</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {isLocalProcessing && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start space-x-3">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-blue-900">Processing URLs</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Extracting content from web pages with timeout protection and automatic retries. Processing up to 3 URLs concurrently.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Preview of scraped content (if available) */}
      {programData.scrapedContent && (
        <div className="mt-8">
          <h4 className="text-sm font-medium text-slate-700 mb-3">Extracted Content Preview</h4>
          <div className="bg-slate-50 rounded-lg p-4 max-h-48 overflow-y-auto border border-slate-200">
            <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono">
              {programData.scrapedContent.substring(0, 500)}
              {programData.scrapedContent.length > 500 && '...'}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default StepTwo;