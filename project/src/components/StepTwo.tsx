import React, { useEffect, useState } from 'react';
import { Globe, CheckCircle, AlertTriangle, Loader2, RotateCcw, Clock, Shield, XCircle } from 'lucide-react';
import type { ProgramData } from '../App';
import { extractAndNormalizeUrls, extractLabeledUrls } from '../utils/url';
import { scrapeUrls, type ScrapeResult, type LabeledScrapeResult } from '../utils/scrape';
import styles from './StepTwo.module.css';

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
    // Extract labeled URLs from program description
    const labeledUrlList = extractLabeledUrls(programData.aboutProgram);
    
    // Also extract from URL field for backward compatibility
    const urlsFromField = programData.urls || [];
    const additionalUrls = extractAndNormalizeUrls('', urlsFromField)
      .filter(url => url.isValid)
      .map(url => url.normalized);
    
    console.log('[URL Extraction] Raw input:', programData.aboutProgram);
    console.log('[URL Extraction] Labeled URLs:', labeledUrlList);
    console.log('[URL Extraction] Additional URLs from field:', additionalUrls);
    
    // Combine both sources (labeled URLs take priority)
    const validUrlList = [
      ...labeledUrlList.map(lu => lu.normalized),
      ...additionalUrls.filter(url => !labeledUrlList.some(lu => lu.normalized === url))
    ];
    
    console.log('[URL Extraction] Valid URLs to scrape:', validUrlList);
    setValidUrls(validUrlList);
    
    if (validUrlList.length > 0) {
      startScraping(validUrlList, labeledUrlList);
    } else {
      // If no valid URLs, skip this step
      setTimeout(() => {
        onComplete();
      }, 500);
    }
  }, []);

  const startScraping = async (urls: string[], labeledUrls: ReturnType<typeof extractLabeledUrls>) => {
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
      
      // Create labeled scrape results by matching URLs to their labels
      const labeledResults: LabeledScrapeResult[] = results
        .filter(r => r.status === 'success' && r.content)
        .map(r => {
          // Find the label for this URL
          const labeledUrl = labeledUrls.find(lu => lu.normalized === r.url);
          return {
            label: labeledUrl?.label || 'Reference',
            url: r.url,
            status: r.status,
            content: r.content,
            error: r.error
          };
        });
      
      // Combine successful content for backward compatibility
      const successfulContent = results
        .filter(r => r.status === 'success' && r.content)
        .map(r => r.content)
        .join('\n\n---\n\n');
      
      updateProgramData({ 
        scrapedContent: successfulContent,
        labeledScrapedContent: labeledResults
      });
      
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
        // Re-extract labeled URLs to get fresh labels
        const labeledUrlList = extractLabeledUrls(programData.aboutProgram);
        
        // Update combined content using latest state
        setUrlResults(prev => {
          const next = prev.map(r => r.url === url ? result : r);
          
          // Rebuild labeled results with updated content
          const labeledResults: LabeledScrapeResult[] = next
            .filter(r => r.status === 'success' && r.content)
            .map(r => {
              const labeledUrl = labeledUrlList.find(lu => lu.normalized === r.url);
              return {
                label: labeledUrl?.label || 'Reference',
                url: r.url,
                status: r.status,
                content: r.content,
                error: r.error
              };
            });
          
          const successfulContent = next
            .filter(r => r.status === 'success' && r.content)
            .map(r => r.content)
            .join('\n\n---\n\n');
          
          updateProgramData({ 
            scrapedContent: successfulContent,
            labeledScrapedContent: labeledResults
          });
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
        return <CheckCircle className={styles.iconSuccess} />;
      case 'timeout':
        return <Clock className={styles.iconTimeout} />;
      case 'rate_limited':
        return <AlertTriangle className={styles.iconRateLimited} />;
      case 'blocked':
        return <Shield className={styles.iconBlocked} />;
      case 'not_found':
        return <XCircle className={styles.iconNotFound} />;
      case 'unsupported_content':
        return <AlertTriangle className={styles.iconUnsupported} />;
      case 'network_error':
      default:
        return <Loader2 className={styles.iconSpinning} />;
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
        return 'Skipped (not a webpage)';
      case 'network_error':
      default:
        return result.error || 'Processing...';
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.iconWrapper}>
            <Globe className={styles.icon} />
          </div>
          <div className={styles.headerContent}>
            <h2>Web Content Extraction</h2>
            <p>Extracting information from provided URLs</p>
          </div>
        </div>
      </div>

      {validUrls.length === 0 ? (
        <div className={styles.emptyState}>
          <Globe className={styles.emptyIcon} />
          <h3 className={styles.emptyTitle}>No URLs to Process</h3>
          <p className={styles.emptyDescription}>
            No URLs were found in the URL fields or program description, proceeding with the text you entered.
          </p>
        </div>
      ) : (
        <div className={styles.urlList}>
          <h3 className={styles.urlListTitle}>
            Processing {validUrls.length} URL{validUrls.length > 1 ? 's' : ''}
          </h3>
          
          {/* Show URLs from program description if any */}
          {(() => {
            const extractedUrls = extractAndNormalizeUrls(programData.aboutProgram, []);
            const urlsFromText = extractedUrls.filter(url => url.isValid).map(url => url.normalized);
            
            return urlsFromText.length > 0 && (
              <div className={styles.urlInfoBox}>
                <p className={styles.urlInfoText}>
                  <strong>Found {urlsFromText.length} URL{urlsFromText.length > 1 ? 's' : ''} in program description:</strong>
                </p>
                <ul className={styles.urlInfoList}>
                  {urlsFromText.map((url, index) => (
                    <li key={index}>{url}</li>
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
              <div key={index} className={styles.urlResultCard}>
                <div className={styles.urlResultIcon}>
                  {getStatusIcon(result.status)}
                </div>
                <div className={styles.urlResultContent}>
                  <p className={styles.urlResultUrl}>
                    {result.url}
                  </p>
                  <p className={styles.urlResultStatus}>
                    {getStatusText(result)}
                    {isFromDescription && (
                      <span className={styles.urlResultBadge}>(from description)</span>
                    )}
                  </p>
                  {result.error && result.status !== 'network_error' && result.status !== 'unsupported_content' && (
                    <p className={styles.urlResultError}>
                      {result.error}
                    </p>
                  )}
                </div>
                <div className={styles.urlResultActions}>
                  {result.status === 'success' && result.content && (
                    <div className={styles.urlResultChars}>
                      {result.content.length} chars
                      {result.truncated && <span className={styles.urlResultTruncated}>truncated</span>}
                    </div>
                  )}
                  {canRetry && !isLocalProcessing && (
                    <button
                      onClick={() => retryUrl(result.url)}
                      className={styles.retryButton}
                      title="Retry this URL"
                    >
                      <RotateCcw className={styles.retryIcon} />
                      <span>Retry</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}

        </div>
      )}

      {/* Preview of scraped content (if available) */}
      {programData.scrapedContent && (
        <div className={styles.previewSection}>
          <h4 className={styles.previewTitle}>Extracted Content Preview</h4>
          <div className={styles.previewBox}>
            <pre className={styles.previewContent}>
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