// Server-side report generator (CommonJS version)
const { marked } = require('marked');
const hljs = require('highlight.js');
const DOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

// Node.js environment initialization
const window = new JSDOM('').window;
const purify = DOMPurify(window);

// Helper functions
function createSlugger() {
  const slugs = {};
  return {
    reset: () => {
      Object.keys(slugs).forEach(key => delete slugs[key]);
    },
    slug: (text) => {
      const baseSlug = text.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/--+/g, '-');
      
      if (!slugs[baseSlug]) {
        slugs[baseSlug] = 0;
        return baseSlug;
      } else {
        slugs[baseSlug]++;
        return `${baseSlug}-${slugs[baseSlug]}`;
      }
    }
  };
}

function detectTableType(headerText) {
  const header = headerText.toLowerCase();
  if (header.includes('timeline') || header.includes('phase') || header.includes('month') || header.includes('quarter')) {
    return 'timeline-table';
  }
  if (header.includes('stakeholder') || header.includes('role') || header.includes('responsibility')) {
    return 'stakeholder-table';
  }
  if (header.includes('evaluation') || header.includes('method') || header.includes('approach')) {
    return 'evaluation-table';
  }
  if (header.includes('metric') || header.includes('indicator') || header.includes('measure')) {
    return 'metrics-table';
  }
  return 'standard-table';
}

function isLogicModelTable(headerText) {
  const header = headerText.toLowerCase();
  const logicModelKeywords = ['inputs', 'activities', 'outputs', 'outcomes', 'impact'];
  return logicModelKeywords.some(keyword => header.includes(keyword));
}

function postProcessHTML(html) {
  let processed = html.replace(/<section class="content-section"><h2([^>]*)>([^<]*)<\/h2>/g, 
    '</section><section class="content-section"><h2$1>$2</h2>');
  
  processed = processed.replace(/^<\/section>/, '');
  
  if (processed.includes('<section class="content-section">')) {
    processed += '</section>';
  }
  
  return processed;
}

function flattenTokensToText(tokens) {
  return tokens.map(t => {
    if (t.type === 'text') return t.text;
    if (t.type === 'strong') return flattenTokensToText(t.tokens);
    if (t.type === 'em') return flattenTokensToText(t.tokens);
    if (t.type === 'link') return flattenTokensToText(t.tokens);
    if (t.type === 'codespan') return t.text;
    if (t.type === 'br') return '\n';
    if (t.type === 'html') {
      const htmlText = t.text;
      return htmlText.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
    }
    return '';
  }).join('')
    .replace(/[\t\r\f\v ]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

// Initialize marked with custom renderer
function initializeMarked(slugger, programName) {
  const renderer = new marked.Renderer();
  
  // Custom heading renderer with IDs for TOC navigation
  renderer.heading = function(text, level, raw) {
    // Handle both string and token array formats from parseInline
    const parsed = this.parser.parseInline(text);
    let rawText;
    
    if (typeof parsed === 'string') {
      // If parseInline returns a string, use it directly
      rawText = parsed.replace(/<[^>]+>/g, '').trim();
    } else if (Array.isArray(parsed)) {
      // If it returns tokens, flatten them
      rawText = flattenTokensToText(parsed);
    } else {
      // Fallback to raw text
      rawText = (raw || text).replace(/<[^>]+>/g, '').trim();
    }
    
    const id = slugger.slug(rawText);
    const levelClass = `heading-level-${level}`;
    return `<h${level} id="${id}" class="${levelClass}">${text}</h${level}>`;
  };
  
  // Custom table renderer with enhanced styling
  renderer.table = function(header, body) {
    // Extract text from HTML header for table type detection
    // The header parameter is already processed HTML, not markdown
    // Ensure header is a string before processing
    const headerStr = String(header || '');
    const headerText = headerStr.replace(/<[^>]+>/g, ' ').toLowerCase();
    
    const tableType = detectTableType(headerText);
    const isLogicModel = isLogicModelTable(headerText);
    const tableClass = isLogicModel ? 'logic-model-table' : tableType;
    
    return `<div class="table-wrapper ${tableClass}">
      <table class="${tableClass}">
        <thead>${headerStr}</thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
  };
  
  // Custom list renderer
  renderer.list = function(body, ordered, start) {
    const type = ordered ? 'ol' : 'ul';
    const startAttr = (ordered && start !== 1) ? ` start="${start}"` : '';
    return `<${type}${startAttr} class="content-list">${body}</${type}>`;
  };
  
  // Custom paragraph renderer for better spacing
  renderer.paragraph = function(text) {
    // Ensure text is a string (handle both string and token formats)
    const textString = typeof text === 'string' ? text : String(text);
    
    if (textString.startsWith('<strong>') && (textString.includes('Phase') || textString.includes('Component'))) {
      return `<div class="phase-header">${textString}</div>`;
    }
    return `<p>${textString}</p>`;
  };
  
  // Code block with syntax highlighting
  renderer.code = function(code, language) {
    const validLanguage = hljs.getLanguage(language) ? language : 'plaintext';
    const highlighted = hljs.highlight(code, { language: validLanguage }).value;
    return `<pre class="code-block"><code class="hljs language-${validLanguage}">${highlighted}</code></pre>`;
  };
  
  // Enhanced blockquote styling
  renderer.blockquote = function(quote) {
    return `<blockquote class="enhanced-quote">${quote}</blockquote>`;
  };
  
  // Configure marked with custom renderer
  marked.setOptions({
    renderer,
    highlight: function(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, { language }).value;
    },
    breaks: true,
    gfm: true,
    headerIds: true,
    mangle: false
  });
}

// Convert markdown to HTML content only (no document wrapper)
function convertMarkdownToHtml(markdown, reportData) {
  try {
    const slugger = createSlugger();
    initializeMarked(slugger, reportData.programName);
    
    const rawHtml = marked.parse(markdown);
    
    const processedHtml = postProcessHTML(rawHtml);
    
    const sanitizedHtml = purify.sanitize(processedHtml, {
      ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'span', 'a', 'ul', 'ol', 'li',
        'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption', 'strong', 'em', 'code',
        'pre', 'blockquote', 'br', 'hr', 'img', 'figure', 'figcaption', 'section'
      ],
      ALLOWED_ATTR: [
        'id', 'class', 'href', 'title', 'alt', 'src', 'width', 'height', 'style'
      ],
      ALLOW_DATA_ATTR: false
    });
    
    return sanitizedHtml;
  } catch (error) {
    console.error('Error converting markdown to HTML:', error);
    return `<div class="error-message">Error processing evaluation plan content. Please try regenerating the plan.</div>`;
  }
}

// Generate table of contents
function generateTOC(markdown) {
  try {
    const slugger = createSlugger();
    slugger.reset();
    
    const tokens = marked.lexer(markdown);
    const tocItems = [];
    
    tokens.forEach(token => {
      if (token.type === 'heading' && token.depth <= 3) {
        const rawText = token.tokens
          .map(t => t.type === 'text' ? t.text : '')
          .join('');
        const id = slugger.slug(rawText);
        const level = token.depth;
        const levelClass = level === 1 ? 'toc-level-1' : level === 2 ? 'toc-level-2' : 'toc-level-3';
        
        const displayText = purify.sanitize(rawText, { ALLOWED_TAGS: [] });
        
        tocItems.push(`<div class="toc-item ${levelClass}"><a href="#${id}">${displayText}</a></div>`);
      }
    });
    
    return tocItems.join('');
  } catch (error) {
    console.error('Error generating TOC:', error);
    return '<div class="error-message">Error generating table of contents</div>';
  }
}

// Get report styles
function getReportStyles() {
  return `
    @media print {
      .no-print { display: none; }
      .page-break { page-break-before: always; }
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1e293b;
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }
    
    h1:first-of-type {
      font-size: 2.5rem;
      font-weight: 700;
      color: #0f172a;
      margin: 2rem 0 1rem 0;
      padding-bottom: 1rem;
      border-bottom: 3px solid #2563eb;
      text-align: center;
    }
    
    .subtitle {
      text-align: center;
      color: #64748b;
      font-size: 1.1rem;
      margin-bottom: 3rem;
      font-weight: 400;
    }
    
    h2 {
      font-size: 1.75rem;
      font-weight: 700;
      color: #1e293b;
      margin: 3rem 0 1.5rem 0;
      padding-bottom: 0.75rem;
      border-bottom: 2px solid #e2e8f0;
      position: relative;
    }
    
    h2::before {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 0;
      width: 60px;
      height: 2px;
      background: #2563eb;
    }
    
    h3 {
      font-size: 1.375rem;
      font-weight: 600;
      color: #374151;
      margin: 2.5rem 0 1rem 0;
      padding-left: 1rem;
      border-left: 4px solid #3b82f6;
    }
    
    h4 {
      font-size: 1.25rem;
      font-weight: 500;
      color: #4b5563;
      margin: 2rem 0 0.75rem 0;
    }
    
    p {
      margin-bottom: 1.25rem;
      line-height: 1.7;
      color: #374151;
    }
    
    ul, ol {
      margin: 1rem 0 1.5rem 0;
      padding-left: 2rem;
    }
    
    li {
      margin-bottom: 0.5rem;
      line-height: 1.6;
      color: #374151;
    }
    
    strong {
      font-weight: 600;
      color: #1e293b;
    }
    
    a {
      color: #2563eb;
      text-decoration: underline;
      font-weight: 500;
      transition: color 0.2s ease;
    }
    
    a:hover {
      color: #1d4ed8;
      text-decoration: underline;
    }
    
    a:visited {
      color: #7c3aed;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 2rem 0;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
    }
    
    .table-wrapper {
      overflow-x: auto;
      margin: 2rem 0;
      border-radius: 12px;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
    }
    
    thead {
      background: linear-gradient(to bottom, #f8fafc, #f1f5f9);
    }
    
    th {
      padding: 1rem;
      text-align: left;
      font-weight: 600;
      color: #0f172a;
      border-bottom: 2px solid #e2e8f0;
      white-space: nowrap;
    }
    
    td {
      padding: 0.875rem 1rem;
      border-bottom: 1px solid #f1f5f9;
      color: #475569;
    }
    
    tr:last-child td {
      border-bottom: none;
    }
    
    tbody tr:hover {
      background-color: #f8fafc;
    }
    
    /* Logic Model Table Styling */
    .logic-model-table {
      margin: 3rem 0;
    }
    
    .logic-model-table table {
      border-radius: 16px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    
    .logic-model-table thead {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    
    .logic-model-table th {
      color: white;
      font-size: 1.1rem;
      padding: 1.25rem;
      border-bottom: none;
    }
    
    .logic-model-table td {
      padding: 1rem 1.25rem;
      vertical-align: top;
      background: white;
      position: relative;
    }
    
    .logic-model-table td::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 4px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    
    .logic-model-table tr:hover td::before {
      opacity: 1;
    }
    
    /* Timeline Table Styling */
    .timeline-table table {
      background: linear-gradient(to bottom, #fefce8, #fffbeb);
    }
    
    .timeline-table th {
      background: #facc15;
      color: #713f12;
    }
    
    /* Stakeholder Table Styling */
    .stakeholder-table table {
      background: linear-gradient(to bottom, #f0fdf4, #f7fee7);
    }
    
    .stakeholder-table th {
      background: #84cc16;
      color: #365314;
    }
    
    /* Evaluation Table Styling */
    .evaluation-table table {
      background: linear-gradient(to bottom, #eff6ff, #f0f9ff);
    }
    
    .evaluation-table th {
      background: #3b82f6;
      color: white;
    }
    
    /* Metrics Table Styling */
    .metrics-table table {
      background: linear-gradient(to bottom, #fef2f2, #fff5f5);
    }
    
    .metrics-table th {
      background: #f87171;
      color: white;
    }
    
    /* Phase Headers */
    .phase-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      margin: 2rem 0 1rem 0;
      font-weight: 600;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    
    /* Enhanced Callouts/Blockquotes */
    blockquote.enhanced-quote {
      background: linear-gradient(to right, #f0f9ff, #e0f2fe);
      border-left: 4px solid #3b82f6;
      padding: 1.5rem;
      margin: 2rem 0;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }
    
    blockquote.enhanced-quote p {
      margin: 0;
      color: #1e3a8a;
      font-style: italic;
    }
    
    /* Code Blocks */
    .code-block {
      background: #1e293b;
      color: #e2e8f0;
      padding: 1.5rem;
      border-radius: 8px;
      overflow-x: auto;
      margin: 1.5rem 0;
    }
    
    .code-block code {
      font-family: 'SF Mono', Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
      font-size: 0.875rem;
      line-height: 1.7;
    }
    
    /* Section Styling */
    .content-section {
      margin: 3rem 0;
      padding: 2rem;
      background: white;
      border-radius: 12px;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
    }
    
    .content-section h2:first-child {
      margin-top: 0;
    }
    
    /* TOC Styling */
    .toc-item {
      padding: 0.5rem 0.75rem;
      border-radius: 6px;
      transition: background-color 0.2s ease;
    }
    
    .toc-item:hover {
      background-color: #f1f5f9;
    }
    
    .toc-item a {
      text-decoration: none;
      color: #475569;
    }
    
    .toc-item a:hover {
      color: #2563eb;
    }
    
    .toc-level-1 {
      font-weight: 600;
      font-size: 1rem;
    }
    
    .toc-level-2 {
      padding-left: 1.5rem;
      font-size: 0.875rem;
    }
    
    .toc-level-3 {
      padding-left: 3rem;
      font-size: 0.8125rem;
      color: #64748b;
    }
    
    /* Error Messages */
    .error-message {
      background-color: #fef2f2;
      border: 1px solid #fecaca;
      color: #dc2626;
      padding: 1rem;
      border-radius: 8px;
      margin: 1rem 0;
    }
    
    /* Print-specific Optimizations */
    @media print {
      body {
        font-size: 11pt;
        line-height: 1.5;
      }
      
      h1 {
        font-size: 18pt;
      }
      
      h2 {
        font-size: 14pt;
        page-break-after: avoid;
      }
      
      h3 {
        font-size: 12pt;
        page-break-after: avoid;
      }
      
      table {
        page-break-inside: avoid;
      }
      
      .content-section {
        box-shadow: none;
        border: 1px solid #e2e8f0;
      }
      
      .phase-header {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
    
    /* Responsive Design */
    @media (max-width: 768px) {
      body {
        padding: 1rem;
      }
      
      table {
        font-size: 0.875rem;
      }
      
      th, td {
        padding: 0.5rem;
      }
      
      h1 {
        font-size: 2rem;
      }
      
      h2 {
        font-size: 1.5rem;
      }
      
      h3 {
        font-size: 1.25rem;
      }
      
      .content-section {
        padding: 1rem;
        margin: 1.5rem 0;
      }
      
      .toc-level-2 {
        padding-left: 1rem;
      }
      
      .toc-level-3 {
        padding-left: 2rem;
      }
    }
    
    /* Utility Classes */
    .mt-4 {
      margin-top: 1rem;
    }
    
    .mb-4 {
      margin-bottom: 1rem;
    }
    
    .report-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 1rem;
    }
    
    /* Print button styling */
    .print-btn {
      display: block;
      width: 100%;
      padding: 0.75rem 1.5rem;
      margin-bottom: 1rem;
      background-color: #dbeafe;
      color: #1e40af;
      font-weight: 600;
      border: 2px solid #3b82f6;
      border-radius: 0.5rem;
      cursor: pointer;
      text-align: center;
      transition: all 0.2s ease;
    }
    
    .print-btn:hover {
      background-color: #bfdbfe;
      border-color: #60a5fa;
    }
    
    @media (max-width: 768px) {
      /* Mobile responsiveness handled via inline styles */
    }
  `;
}

// Generate complete HTML document
function generateFullHtmlDocument(markdown, options = {}) {
  const {
    programName = 'Program',
    organizationName = 'Organization',
    includePrintButton = false
  } = options;
  
  const reportData = { programName, organizationName };
  
  // Ensure markdown is a string
  if (typeof markdown !== 'string') {
    console.error('Error: markdown is not a string, it is:', typeof markdown, markdown);
    markdown = String(markdown || '');
  }
  
  // Generate TOC
  const tocHtml = generateTOC(markdown);
  
  // Convert markdown content
  const contentHtml = convertMarkdownToHtml(markdown, reportData);
  
  // Get styles
  const styles = getReportStyles();
  
  // Build the HTML document
  let htmlDocument = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${purify.sanitize(organizationName)} — ${purify.sanitize(programName)} Evaluation Plan</title>
    <style>
        ${styles}
    </style>
</head>
<body style="background-color: #ffffff; margin: 0; padding: 0;">`;

  if (includePrintButton) {
    // Include print button and sidebar layout (for downloads)
    htmlDocument += `
    <!-- Table of Contents Layout -->
    <div class="report-container">
        <div style="display: flex;">
        <!-- TOC Sidebar: Always visible on left -->
        <aside style="width: 320px; background-color: #f8fafc; min-height: 100vh; padding: 24px;" class="no-print">
            <button onclick="printLandscape()" class="print-btn">
                Print / Save PDF
            </button>
            <p style="font-size: 0.75rem; color: #64748b; margin-bottom: 1rem; padding: 0.5rem; background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 0.375rem; text-align: center;">
                💡 For best results, select <strong>Landscape</strong> orientation in your print dialog
            </p>
            <h3 style="font-weight: 600; color: #0f172a; margin-bottom: 1rem;">Table of Contents</h3>
            <nav style="font-size: 0.875rem; line-height: 1.6;">
                ${tocHtml}
            </nav>
        </aside>

        <!-- Main Content -->
        <main style="flex: 1; padding: 24px; background-color: #ffffff;">
            <div style="max-width: none;">
                ${contentHtml}
            </div>
        </main>
        </div>
    </div>

    <script>
        function printLandscape() {
            window.print();
        }
    </script>`;
  } else {
    // Simple layout without print button (for emails)
    htmlDocument += `
    <div class="report-container">
        <div style="background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); margin-bottom: 2rem;">
            <h3 style="margin: 0 0 1rem 0; color: #1e293b; font-size: 1.25rem;">Table of Contents</h3>
            ${tocHtml}
        </div>
        ${contentHtml}
    </div>`;
  }
  
  htmlDocument += `
</body>
</html>`;
  
  return htmlDocument;
}

// CommonJS exports
module.exports = {
  convertMarkdownToHtml,
  generateTOC,
  getReportStyles,
  generateFullHtmlDocument
};