import React, { useEffect, useState } from 'react';
import { Globe, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import type { ProgramData } from '../App';

interface StepTwoProps {
  programData: ProgramData;
  updateProgramData: (data: Partial<ProgramData>) => void;
  onComplete: () => void;
  setIsProcessing: (processing: boolean) => void;
}

const StepTwo: React.FC<StepTwoProps> = ({ programData, updateProgramData, onComplete, setIsProcessing }) => {
  const [scrapingProgress, setScrapingProgress] = useState<{ [url: string]: 'pending' | 'success' | 'error' }>({});
  const [scrapedResults, setScrapedResults] = useState<{ [url: string]: string }>({});

  useEffect(() => {
    // Extract URLs from both the urls array and the aboutProgram text
    const urlsFromField = programData.urls || [];
    const urlsFromText = extractUrlsFromText(programData.aboutProgram);
    const allUrls = [...urlsFromField, ...urlsFromText].filter((url, index, arr) => 
      url && arr.indexOf(url) === index // Remove duplicates and empty strings
    );
    
    if (allUrls.length > 0) {
      scrapeUrls(allUrls);
    } else {
      // If no URLs, skip this step
      setTimeout(() => {
        onComplete();
      }, 500);
    }
  }, []);

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

  const scrapeUrls = async (urlsToScrape: string[]) => {
    setIsProcessing(true);
    const results: { [url: string]: string } = {};
    const progress: { [url: string]: 'pending' | 'success' | 'error' } = {};

    // Initialize progress
    urlsToScrape.forEach(url => {
      progress[url] = 'pending';
    });
    setScrapingProgress(progress);

    for (const url of urlsToScrape) {
      try {
        // Add delay for user experience
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Use CORS proxy to fetch the content
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        const htmlContent = data.contents;
        
        // Parse HTML and extract text content
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        
        // Remove script and style elements
        const scripts = doc.querySelectorAll('script, style, nav, footer, header');
        scripts.forEach(el => el.remove());
        
        // Extract text content from main content areas
        const contentSelectors = [
          'main', 
          '[role="main"]', 
          '.content', 
          '.main-content', 
          '#content', 
          '#main',
          'article',
          '.post',
          '.page-content'
        ];
        
        let extractedText = '';
        
        // Try to find main content area first
        for (const selector of contentSelectors) {
          const element = doc.querySelector(selector);
          if (element) {
            extractedText = element.textContent || '';
            break;
          }
        }
        
        // If no main content found, extract from body
        if (!extractedText) {
          const body = doc.querySelector('body');
          extractedText = body?.textContent || '';
        }
        
        // Clean up the text
        extractedText = extractedText
          .replace(/\s+/g, ' ')
          .replace(/\n\s*\n/g, '\n')
          .trim();
        
        // Limit content length to prevent overwhelming the analysis
        if (extractedText.length > 5000) {
          extractedText = extractedText.substring(0, 5000) + '... [Content truncated]';
        }
        
        const scrapedContent = `
URL: ${url}
Scraped at: ${new Date().toISOString()}
Content length: ${extractedText.length} characters

EXTRACTED CONTENT:
${extractedText}
        `.trim();
        
        results[url] = scrapedContent;
        progress[url] = 'success';
        setScrapingProgress({ ...progress });
        setScrapedResults({ ...results });
        
      } catch (error) {
        console.error(`Error scraping ${url}:`, error);
        
        // Add delay before trying fallback proxy to handle transient network issues
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Try alternative CORS proxy as fallback
        try {
          const fallbackProxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
          const fallbackResponse = await fetch(fallbackProxyUrl);
          
          if (fallbackResponse.ok) {
            const htmlContent = await fallbackResponse.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');
            
            // Remove unwanted elements
            const scripts = doc.querySelectorAll('script, style, nav, footer, header');
            scripts.forEach(el => el.remove());
            
            let extractedText = doc.body?.textContent || '';
            extractedText = extractedText.replace(/\s+/g, ' ').trim();
            
            if (extractedText.length > 5000) {
              extractedText = extractedText.substring(0, 5000) + '... [Content truncated]';
            }
            
            const scrapedContent = `
URL: ${url}
Scraped at: ${new Date().toISOString()} (via fallback proxy)
Content length: ${extractedText.length} characters

EXTRACTED CONTENT:
${extractedText}
            `.trim();
            
            results[url] = scrapedContent;
            progress[url] = 'success';
            setScrapingProgress({ ...progress });
            setScrapedResults({ ...results });
            continue;
          }
        } catch (fallbackError) {
          console.error(`Fallback proxy also failed for ${url}:`, fallbackError);
        }
        
        // If all methods fail, provide error content
        const fallbackContent = `
URL: ${url}
Attempted at: ${new Date().toISOString()}
Status: Could not scrape content
Error: ${error instanceof Error ? error.message : 'Network or CORS error'}

Note: Unable to automatically extract content from this URL due to network restrictions or website blocking. 
Please manually copy relevant content from ${url} and include it in your program description for more detailed analysis.
        `.trim();
        
        results[url] = fallbackContent;
        progress[url] = 'error';
        setScrapingProgress({ ...progress });
        setScrapedResults({ ...results });
      }
    }

    // Combine all scraped content
    const combinedContent = Object.values(results).join('\n\n---\n\n');
    updateProgramData({ scrapedContent: combinedContent });

    setIsProcessing(false);
    
    // Auto-advance to next step after a brief delay
    setTimeout(() => {
      onComplete();
    }, 1500);
  };

  const getStatusIcon = (status: 'pending' | 'success' | 'error') => {
    switch (status) {
      case 'pending':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />;
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
    }
  };

  const getStatusText = (status: 'pending' | 'success' | 'error') => {
    switch (status) {
      case 'pending':
        return 'Scraping...';
      case 'success':
        return 'Completed';
      case 'error':
        return 'Failed';
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-teal-100 rounded-lg">
            <Globe className="h-6 w-6 text-teal-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Web Content Extraction</h2>
            <p className="text-slate-600">Extracting information from provided URLs</p>
          </div>
        </div>
      </div>

      {programData.urls.length === 0 ? (
        <div className="text-center py-12">
          <Globe className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No URLs to Process</h3>
          <p className="text-slate-600">
            No URLs were found in the URL fields or program description, proceeding with the text you entered.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Show URLs from both sources */}
          {(() => {
            const urlsFromField = programData.urls || [];
            const urlsFromText = extractUrlsFromText(programData.aboutProgram);
            const allUrls = [...urlsFromField, ...urlsFromText].filter((url, index, arr) => 
              url && arr.indexOf(url) === index
            );
            
            return (
              <>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">
                  Processing {allUrls.length} URL{allUrls.length > 1 ? 's' : ''}
                </h3>
                
                {urlsFromText.length > 0 && (
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-800">
                      <strong>Found {urlsFromText.length} URL{urlsFromText.length > 1 ? 's' : ''} in program description:</strong>
                    </p>
                    <ul className="text-xs text-blue-700 mt-1 ml-4">
                      {urlsFromText.map((url, index) => (
                        <li key={index} className="truncate">{url}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            );
          })()}
          {(() => {
            const urlsFromField = programData.urls || [];
            const urlsFromText = extractUrlsFromText(programData.aboutProgram);
            const allUrls = [...urlsFromField, ...urlsFromText].filter((url, index, arr) => 
              url && arr.indexOf(url) === index
            );
            
            return allUrls.map((url, index) => {
            const status = scrapingProgress[url] || 'pending';
            return (
              <div
                key={index}
                className="flex items-center space-x-4 p-4 bg-slate-50 rounded-lg border border-slate-200"
              >
                <div className="flex-shrink-0">
                  {getStatusIcon(status)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {url}
                  </p>
                  <p className="text-sm text-slate-500">
                    {getStatusText(status)}
                    {urlsFromText.includes(url) && (
                      <span className="ml-2 text-xs text-blue-600">(from description)</span>
                    )}
                  </p>
                </div>
                {status === 'success' && scrapedResults[url] && (
                  <div className="text-xs text-slate-400">
                    {scrapedResults[url].length} characters extracted
                  </div>
                )}
              </div>
            );
            });
          })()}

          {Object.keys(scrapingProgress).length > 0 && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start space-x-3">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-blue-900">Processing URLs</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Extracting content from web pages for analysis. This may take a few moments.
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