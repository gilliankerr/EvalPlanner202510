/**
 * Robust web scraping utilities with error handling and retry logic
 */

export interface ScrapeResult {
  url: string;
  status: 'success' | 'timeout' | 'rate_limited' | 'blocked' | 'not_found' | 'unsupported_content' | 'network_error';
  content?: string;
  error?: string;
  httpStatus?: number;
  contentType?: string;
  proxy?: string;
  elapsedMs: number;
  truncated?: boolean;
  retryAfter?: number;
}

interface ProxyConfig {
  name: string;
  buildUrl: (url: string) => string;
  parseResponse: (response: Response) => Promise<string>;
}

// Available CORS proxies in order of preference
const PROXIES: ProxyConfig[] = [
  {
    name: 'allorigins-json',
    buildUrl: (url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    parseResponse: async (response: Response) => {
      const data = await response.json();
      return data.contents || '';
    }
  },
  {
    name: 'corsproxy',
    buildUrl: (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    parseResponse: async (response: Response) => response.text()
  },
  {
    name: 'allorigins-raw',
    buildUrl: (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    parseResponse: async (response: Response) => response.text()
  }
];

/**
 * Fetch URL with timeout using AbortController
 */
async function fetchWithTimeout(url: string, timeoutMs: number = 7000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EvaluationPlanner/1.0)',
      }
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}

/**
 * Sleep with jitter for backoff
 */
function sleep(ms: number): Promise<void> {
  const jitter = Math.random() * 0.3 + 0.85; // 85-115% of intended delay
  return new Promise(resolve => setTimeout(resolve, ms * jitter));
}

/**
 * Try multiple proxies with retry logic
 */
async function tryProxies(url: string, timeoutMs: number): Promise<{response: Response, proxy: string, html: string}> {
  let lastError: Error | null = null;
  
  for (const proxy of PROXIES) {
    let retries = 2;
    
    while (retries >= 0) {
      try {
        const proxyUrl = proxy.buildUrl(url);
        const response = await fetchWithTimeout(proxyUrl, timeoutMs);
        
        // Don't retry on client errors (except timeout and rate limit)
        if (!response.ok) {
          if (response.status === 429) {
            // Rate limited - check for Retry-After header
            const retryAfter = response.headers.get('retry-after');
            const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
            if (retries > 0 && waitMs < 30000) { // Don't wait more than 30s
              await sleep(waitMs);
              retries--;
              continue;
            }
            throw new Error(`Rate limited (429) - ${proxy.name}`);
          }
          
          if (response.status >= 400 && response.status < 500 && response.status !== 408) {
            // Client error (don't retry except for timeouts)
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        }
        
        const html = await proxy.parseResponse(response);
        return { response, proxy: proxy.name, html };
        
      } catch (error) {
        lastError = error as Error;
        
        // Exponential backoff for retries
        if (retries > 0) {
          const backoffMs = (3 - retries) * 2000; // 2s, 4s
          await sleep(backoffMs);
        }
        retries--;
      }
    }
  }
  
  throw lastError || new Error('All proxies failed');
}

/**
 * Classify the scraping outcome
 */
function classifyOutcome(error: Error, httpStatus?: number): Pick<ScrapeResult, 'status' | 'retryAfter'> {
  const message = error.message.toLowerCase();
  
  if (message.includes('timeout') || message.includes('aborted')) {
    return { status: 'timeout' };
  }
  
  if (message.includes('rate limited') || httpStatus === 429) {
    const match = message.match(/retry-after:?\s*(\d+)/i);
    const retryAfter = match ? parseInt(match[1]) : undefined;
    return { status: 'rate_limited', retryAfter };
  }
  
  if (httpStatus === 403 || message.includes('blocked') || message.includes('forbidden')) {
    return { status: 'blocked' };
  }
  
  if (httpStatus === 404 || message.includes('not found')) {
    return { status: 'not_found' };
  }
  
  return { status: 'network_error' };
}

/**
 * Detect content type and check if it's processable
 */
function detectContentType(html: string, contentType?: string): { type: string; isProcessable: boolean } {
  const cleanHtml = html.trim().toLowerCase();
  
  // Check for binary content markers
  if (cleanHtml.startsWith('%pdf-') || cleanHtml.includes('application/pdf')) {
    return { type: 'pdf', isProcessable: false };
  }
  
  if (cleanHtml.startsWith('pk\x03\x04') || cleanHtml.includes('application/zip')) {
    return { type: 'zip', isProcessable: false };
  }
  
  if (cleanHtml.startsWith('{') && cleanHtml.endsWith('}')) {
    return { type: 'json', isProcessable: false };
  }
  
  // Check Content-Type header if available
  if (contentType) {
    if (contentType.includes('application/pdf')) return { type: 'pdf', isProcessable: false };
    if (contentType.includes('application/zip')) return { type: 'zip', isProcessable: false };
    if (contentType.includes('application/json')) return { type: 'json', isProcessable: false };
    if (contentType.includes('image/') || contentType.includes('video/') || contentType.includes('audio/')) {
      return { type: 'media', isProcessable: false };
    }
  }
  
  // Check for HTML markers
  if (cleanHtml.includes('<html') || cleanHtml.includes('<!doctype') || cleanHtml.includes('<body')) {
    return { type: 'html', isProcessable: true };
  }
  
  // Default to text if unclear but has reasonable content
  if (html.length > 50 && !cleanHtml.includes('\x00')) {
    return { type: 'text', isProcessable: true };
  }
  
  return { type: 'unknown', isProcessable: false };
}

/**
 * Parse HTML and extract meaningful text content
 */
function parseAndExtract(html: string): { content: string; truncated: boolean } {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Remove unwanted elements
    const unwantedElements = doc.querySelectorAll('script, style, nav, footer, header, aside, .advertisement, .ads, .sidebar');
    unwantedElements.forEach(el => el.remove());
    
    // Try to find main content area first
    const contentSelectors = [
      'main', 
      '[role="main"]', 
      '.content', 
      '.main-content', 
      '#content', 
      '#main',
      'article',
      '.post',
      '.page-content',
      '.entry-content',
      '.post-content'
    ];
    
    let extractedText = '';
    
    for (const selector of contentSelectors) {
      const element = doc.querySelector(selector);
      if (element && element.textContent && element.textContent.trim().length > 200) {
        extractedText = element.textContent;
        break;
      }
    }
    
    // Fallback to body if no main content found
    if (!extractedText) {
      const body = doc.querySelector('body');
      extractedText = body?.textContent || html;
    }
    
    // Clean up the text
    extractedText = extractedText
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();
    
    // Handle content length limit
    const maxLength = 25000;
    let truncated = false;
    
    if (extractedText.length > maxLength) {
      extractedText = extractedText.substring(0, maxLength) + '... [Content truncated]';
      truncated = true;
    }
    
    return { content: extractedText, truncated };
    
  } catch (error) {
    // Fallback for parsing errors
    let cleanText = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const maxLength = 25000;
    let truncated = false;
    
    if (cleanText.length > maxLength) {
      cleanText = cleanText.substring(0, maxLength) + '... [Content truncated]';
      truncated = true;
    }
    
    return { content: cleanText, truncated };
  }
}

/**
 * Scrape a single URL with comprehensive error handling
 */
export async function scrapeUrl(url: string, timeoutMs: number = 7000): Promise<ScrapeResult> {
  const startTime = Date.now();
  
  try {
    const { response, proxy, html } = await tryProxies(url, timeoutMs);
    
    console.log(`[Scraper] URL: ${url}`);
    console.log(`[Scraper] Proxy used: ${proxy}`);
    console.log(`[Scraper] Response length: ${html.length}`);
    console.log(`[Scraper] First 200 chars:`, html.substring(0, 200));
    
    // Detect content type
    // Note: Don't use Content-Type header from JSON proxies since they return application/json
    // but we've already extracted the actual HTML content from the JSON wrapper
    const contentTypeHeader = response.headers.get('content-type') || undefined;
    const shouldIgnoreHeader = contentTypeHeader?.includes('application/json') && proxy.includes('json');
    const { type: contentType, isProcessable } = detectContentType(html, shouldIgnoreHeader ? undefined : contentTypeHeader);
    
    console.log(`[Scraper] Content-Type header: ${contentTypeHeader}`);
    console.log(`[Scraper] Detected type: ${contentType}, processable: ${isProcessable}`);
    
    if (!isProcessable) {
      console.warn(`[Scraper] Rejected as ${contentType} - not processable`);
      return {
        url,
        status: 'unsupported_content',
        error: `Content type '${contentType}' is not supported for text extraction. Response preview: ${html.substring(0, 100)}`,
        contentType,
        proxy,
        elapsedMs: Date.now() - startTime
      };
    }
    
    // Parse and extract content
    const { content, truncated } = parseAndExtract(html);
    
    if (!content || content.length < 50) {
      return {
        url,
        status: 'network_error',
        error: 'No meaningful content found',
        contentType,
        proxy,
        elapsedMs: Date.now() - startTime
      };
    }
    
    // Format successful result
    const formattedContent = `
URL: ${url}
Scraped at: ${new Date().toISOString()}
Content length: ${content.length} characters
Proxy used: ${proxy}
Content type: ${contentType}
${truncated ? 'Note: Content was truncated to 25,000 characters' : ''}

EXTRACTED CONTENT:
${content}
    `.trim();
    
    return {
      url,
      status: 'success',
      content: formattedContent,
      contentType,
      proxy,
      elapsedMs: Date.now() - startTime,
      truncated
    };
    
  } catch (error) {
    const outcome = classifyOutcome(error as Error);
    
    return {
      url,
      ...outcome,
      error: (error as Error).message,
      elapsedMs: Date.now() - startTime
    };
  }
}

/**
 * Scrape multiple URLs with controlled concurrency
 */
export async function scrapeUrls(
  urls: string[], 
  options: {
    concurrency?: number;
    timeoutMs?: number;
    onProgress?: (result: ScrapeResult) => void;
  } = {}
): Promise<ScrapeResult[]> {
  const { concurrency = 5, timeoutMs = 7000, onProgress } = options;
  const results: ScrapeResult[] = [];
  
  // Process URLs in batches with controlled concurrency
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    
    const batchPromises = batch.map(async (url) => {
      const result = await scrapeUrl(url, timeoutMs);
      if (onProgress) {
        onProgress(result);
      }
      return result;
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }
  
  return results;
}