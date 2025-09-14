/**
 * URL preprocessing and validation utilities
 * Handles URL extraction, normalization, validation, and sanitization
 */

export interface ExtractedUrl {
  original: string;
  normalized: string;
  isValid: boolean;
  error?: string;
}

/**
 * Extract and normalize URLs from text input
 * @param text - Input text containing potential URLs
 * @param additionalUrls - Additional URLs provided separately
 * @returns Array of processed URL objects
 */
export function extractAndNormalizeUrls(text: string, additionalUrls: string[] = []): ExtractedUrl[] {
  const allInputs = [...extractUrlsFromText(text), ...additionalUrls];
  const results: ExtractedUrl[] = [];
  const seen = new Set<string>();

  for (const input of allInputs) {
    const processed = processUrl(input.trim());
    
    // Deduplicate by normalized URL
    if (processed.isValid && processed.normalized && !seen.has(processed.normalized)) {
      seen.add(processed.normalized);
      results.push(processed);
    } else if (!processed.isValid) {
      results.push(processed);
    }
  }

  return results;
}

/**
 * Extract URLs from text using improved regex
 * @param text - Input text
 * @returns Array of potential URL strings
 */
function extractUrlsFromText(text: string): string[] {
  if (!text) return [];
  
  // Enhanced regex to match URLs and strip trailing punctuation
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)|(www\.[^\s<>"{}|\\^`\[\]]+)/gi;
  const matches = text.match(urlRegex) || [];
  
  return matches.map(url => {
    // Strip trailing punctuation that's commonly part of sentences
    return url.replace(/[.,;!?)\]]+$/, '');
  });
}

/**
 * Process and normalize a single URL
 * @param input - Raw URL input
 * @returns Processed URL object
 */
function processUrl(input: string): ExtractedUrl {
  if (!input) {
    return {
      original: input,
      normalized: '',
      isValid: false,
      error: 'Empty URL'
    };
  }

  try {
    let normalizedUrl = input;

    // Reject dangerous schemes
    const dangerousSchemes = ['javascript:', 'data:', 'mailto:', 'file:', 'ftp:'];
    if (dangerousSchemes.some(scheme => input.toLowerCase().startsWith(scheme))) {
      return {
        original: input,
        normalized: '',
        isValid: false,
        error: 'Unsupported URL scheme'
      };
    }

    // Add https:// prefix for www URLs
    if (input.toLowerCase().startsWith('www.')) {
      normalizedUrl = 'https://' + input;
    }

    // Ensure http:// or https:// prefix for other URLs
    if (!normalizedUrl.match(/^https?:\/\//i)) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    // Validate using URL constructor
    const urlObj = new URL(normalizedUrl);
    
    // Additional validation
    if (!urlObj.hostname || urlObj.hostname.length < 3) {
      return {
        original: input,
        normalized: '',
        isValid: false,
        error: 'Invalid hostname'
      };
    }

    // Normalize the URL (removes unnecessary components)
    const canonicalUrl = `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}${urlObj.search}`;

    return {
      original: input,
      normalized: canonicalUrl,
      isValid: true
    };

  } catch (error) {
    return {
      original: input,
      normalized: '',
      isValid: false,
      error: error instanceof Error ? error.message : 'Invalid URL format'
    };
  }
}

/**
 * Validate URLs and filter out invalid ones
 * @param urls - Array of URL strings to validate
 * @returns Array of valid, normalized URLs
 */
export function validateAndNormalizeUrls(urls: string[]): string[] {
  return extractAndNormalizeUrls('', urls)
    .filter(url => url.isValid)
    .map(url => url.normalized);
}