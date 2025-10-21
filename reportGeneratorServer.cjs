let marked;
const hljs = require('highlight.js');

const markedReady = import('marked').then((module) => {
  const candidate = module.marked ?? module.default ?? module;
  if (!candidate || typeof candidate.parse !== 'function') {
    throw new Error('Failed to load the marked markdown parser.');
  }
  marked = candidate;
  return candidate;
});

async function ensureMarked() {
  if (marked) {
    return marked;
  }
  return markedReady;
}

// Helper function to detect table type based on headers
function detectTableType(headerText) {
  if (headerText.includes('risk') && headerText.includes('mitigation')) {
    return 'risks-table';
  }
  if (headerText.includes('stakeholder') || headerText.includes('interest')) {
    return 'stakeholder-table';
  }
  if (headerText.includes('method') || headerText.includes('data')) {
    return 'methods-table';
  }
  if (headerText.includes('timeline') || headerText.includes('milestone')) {
    return 'timeline-table';
  }
  if (headerText.includes('budget') || headerText.includes('cost')) {
    return 'budget-table';
  }
  if (headerText.includes('indicator') || headerText.includes('metric')) {
    return 'indicators-table';
  }
  return 'standard-table';
}

// Helper function to check if a table is a Logic Model
function isLogicModelTable(headerText) {
  const logicModelKeywords = ['inputs', 'activities', 'outputs', 'outcomes'];
  const matches = logicModelKeywords.filter(keyword => headerText.includes(keyword));
  return matches.length >= 3;
}

// Build a helper for rendering inline content with marked v16
function buildInlineRenderer() {
  // Helper to safely render inline tokens
  const renderInline = (tokens) => {
    if (!tokens) return '';
    if (typeof tokens === 'string') return tokens;
    if (!Array.isArray(tokens)) {
      return tokens.text || tokens.raw || '';
    }
    
    // Process each token
    return tokens.map(token => {
      if (typeof token === 'string') return token;
      
      // Handle different token types
      switch (token.type) {
        case 'text':
        case 'escape':
          return token.text || token.raw || '';
        case 'strong':
          return `<strong>${renderInline(token.tokens)}</strong>`;
        case 'em':
          return `<em>${renderInline(token.tokens)}</em>`;
        case 'codespan':
          return `<code>${token.text}</code>`;
        case 'br':
          return '<br>';
        case 'del':
          return `<del>${renderInline(token.tokens)}</del>`;
        case 'link':
          const linkText = renderInline(token.tokens);
          return `<a href="${token.href}"${token.title ? ` title="${token.title}"` : ''}>${linkText}</a>`;
        case 'image':
          return `<img src="${token.href}" alt="${token.text}"${token.title ? ` title="${token.title}"` : ''}>`;
        default:
          // For unknown types, try to extract text
          return token.text || token.raw || renderInline(token.tokens) || '';
      }
    }).join('');
  };
  
  // Helper to extract plain text from tokens
  const renderText = (tokens) => {
    if (!tokens) return '';
    if (typeof tokens === 'string') return tokens;
    if (!Array.isArray(tokens)) {
      return tokens.text || tokens.raw || '';
    }
    
    return tokens.map(token => {
      if (typeof token === 'string') return token;
      if (token.type === 'text' || token.type === 'escape') {
        return token.text || token.raw || '';
      }
      if (token.tokens) {
        return renderText(token.tokens);
      }
      return token.text || token.raw || '';
    }).join('');
  };
  
  return { renderInline, renderText };
}

// Initialize marked with custom renderer
function initializeMarked(slugger, programName, tocItems) {
  const renderer = new marked.Renderer();
  const { renderInline, renderText } = buildInlineRenderer();
  
  // Custom heading renderer with IDs for TOC navigation
  renderer.heading = function(token) {
    // Extract depth and text
    let depth = 1;
    let text = '';
    
    if (typeof token === 'object' && token !== null) {
      depth = token.depth || 1;
      if (token.tokens) {
        text = renderInline(token.tokens);
      } else if (token.text) {
        text = token.text;
      }
    } else {
      // Fallback for string input
      text = String(token || '');
    }
    
    // Generate ID for TOC
    const rawText = text.replace(/<[^>]+>/g, '').trim();
    const id = slugger.slug(rawText);
    const levelClass = `heading-level-${depth}`;
    
    // Collect h2 and h3 headings for TOC
    if (depth === 2 || depth === 3) {
      tocItems.push({
        level: depth,
        text: rawText,
        id: id
      });
    }
    
    return `<h${depth} id="${id}" class="${levelClass}">${text}</h${depth}>`;
  };
  
  // Custom table renderer with enhanced styling
  renderer.table = function(token) {
    let headerHTML = '';
    let bodyHTML = '';
    
    if (typeof token === 'object' && token !== null && token.header) {
      // New API: token object with header and rows
      // Build header row
      const headerCells = token.header.map((cell, i) => {
        const alignAttr = token.align && token.align[i] ? ` align="${token.align[i]}"` : '';
        const cellText = cell.tokens ? renderInline(cell.tokens) : cell.text || '';
        return `<th${alignAttr}>${cellText}</th>`;
      }).join('');
      headerHTML = `<tr>${headerCells}</tr>`;
      
      // Build body rows
      const bodyRows = token.rows.map(row => {
        const cells = row.map((cell, i) => {
          const alignAttr = token.align && token.align[i] ? ` align="${token.align[i]}"` : '';
          const cellText = cell.tokens ? renderInline(cell.tokens) : cell.text || '';
          return `<td${alignAttr}>${cellText}</td>`;
        }).join('');
        return `<tr>${cells}</tr>`;
      }).join('\n');
      bodyHTML = bodyRows;
    } else {
      // Fallback for string input
      headerHTML = String(token || '');
      bodyHTML = '';
    }
    
    // Analyze table type from header content
    const headerText = headerHTML.replace(/<[^>]+>/g, ' ').toLowerCase();
    const tableType = detectTableType(headerText);
    const isLogicModel = isLogicModelTable(headerText);
    const tableClass = isLogicModel ? 'logic-model-table' : tableType;
    
    return `<div class="table-wrapper ${tableClass}">
      <table class="${tableClass}">
        <thead>${headerHTML}</thead>
        <tbody>${bodyHTML}</tbody>
      </table>
    </div>`;
  };
  
  // Custom list renderer
  renderer.list = function(token) {
    let bodyHTML = '';
    let ordered = false;
    let start = 1;
    
    if (typeof token === 'object' && token !== null && token.items) {
      // New API: token with items array
      ordered = token.ordered || false;
      start = token.start || 1;
      
      // Render each list item
      bodyHTML = token.items.map(item => {
        if (item.task !== undefined) {
          // Task list item
          const checkbox = item.checked 
            ? '<input type="checkbox" checked disabled> '
            : '<input type="checkbox" disabled> ';
          const text = item.tokens ? renderInline(item.tokens) : item.text || '';
          return `<li class="task-list-item">${checkbox}${text}</li>`;
        } else {
          // Regular list item
          const text = item.tokens ? renderInline(item.tokens) : item.text || '';
          return `<li>${text}</li>`;
        }
      }).join('\n');
    } else {
      // Fallback for string input
      bodyHTML = String(token || '');
    }
    
    const type = ordered ? 'ol' : 'ul';
    const startAttr = (ordered && start !== 1) ? ` start="${start}"` : '';
    return `<${type}${startAttr} class="content-list">${bodyHTML}</${type}>`;
  };
  
  // Custom paragraph renderer for better spacing
  renderer.paragraph = function(token) {
    let text = '';
    
    if (typeof token === 'object' && token !== null) {
      // New API: token with tokens array
      if (token.tokens) {
        text = renderInline(token.tokens);
      } else if (token.text) {
        text = token.text;
      }
    } else {
      // Fallback for string input
      text = String(token || '');
    }
    
    if (text.startsWith('<strong>') && (text.includes('Phase') || text.includes('Component'))) {
      return `<div class="phase-header">${text}</div>`;
    }
    return `<p>${text}</p>`;
  };
  
  // Code block with syntax highlighting
  renderer.code = function(code, language) {
    const validLanguage = hljs.getLanguage(language) ? language : 'plaintext';
    const highlighted = hljs.highlight(code, { language: validLanguage }).value;
    return `<pre><code class="hljs ${validLanguage}">${highlighted}</code></pre>`;
  };
  
  // Set up marked with the custom renderer
  marked.setOptions({
    renderer: renderer,
    highlight: function(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, { language }).value;
    },
    breaks: true,
    gfm: true
  });
  
  return renderer;
}

// Generate the complete HTML document
async function generateHTMLReport(evaluationPlan, options = {}) {
  await ensureMarked();
  const { 
    programName = 'Program',
    organizationName = 'Organization',
    includePrintButton = true
  } = options;
  
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  // Simple slug function to replace marked.Slugger
  const slugCache = new Map();
  const slugger = {
    slug: (text) => {
      // Convert to lowercase and replace non-alphanumeric with hyphens
      let slug = text.toString()
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove non-word chars
        .replace(/[\s_-]+/g, '-')  // Replace spaces, underscores with hyphens
        .replace(/^-+|-+$/g, '');  // Remove leading/trailing hyphens
      
      // Handle duplicates
      let count = slugCache.get(slug) || 0;
      if (count > 0) {
        const numberedSlug = `${slug}-${count}`;
        slugCache.set(slug, count + 1);
        return numberedSlug;
      }
      slugCache.set(slug, 1);
      return slug;
    }
  };
  
  // Array to collect TOC items
  const tocItems = [];
  
  // Process the markdown content with our custom renderer
  initializeMarked(slugger, programName, tocItems);
  const contentHTML = marked.parse(evaluationPlan);
  
  // Build TOC HTML
  const tocHTML = tocItems.map(item => {
    const levelClass = `toc-level-${item.level - 1}`;
    return `<div class="toc-item ${levelClass}"><a href="#${item.id}">${item.text}</a></div>`;
  }).join('');
  
  // Rich blue theme CSS styles (matching frontend exactly)
  const styles = `
    /* Typography System */
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1e293b;
      background-color: white;
      margin: 0;
      padding: 0;
    }
    
    /* Layout containers */
    .report-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 1rem;
    }
    
    .flex {
      display: flex;
    }
    
    .flex-1 {
      flex: 1 1 0%;
      max-width: 900px;
      margin: 0 auto;
    }
    
    /* TOC Sidebar */
    .w-80 {
      width: 20rem;
      min-width: 200px;
    }
    
    .bg-slate-50 {
      background-color: #f8fafc;
    }
    
    .min-h-screen {
      min-height: 100vh;
    }
    
    .p-6 {
      padding: 1.5rem;
    }
    
    aside h3 {
      font-weight: 600;
      color: #0f172a;
      margin-bottom: 1rem;
      font-size: 1.1rem;
    }
    
    aside nav {
      font-size: 0.875rem;
    }
    
    aside nav a {
      display: block;
      padding: 0.25rem 0;
      color: #64748b;
      text-decoration: none !important;
      transition: color 0.2s;
    }
    
    aside nav a:hover {
      color: #1e293b;
    }
    
    /* TOC Items */
    .toc-item {
      padding: 0.5rem 0.75rem;
      border-radius: 6px;
      transition: all 0.15s ease;
    }
    
    .toc-level-1 {
      margin-left: 0;
    }
    
    .toc-level-2 {
      margin-left: 1.5rem;
    }
    
    .toc-item:hover {
      background-color: #f1f5f9;
      transform: translateX(4px);
    }
    
    .toc-item a {
      color: #475569;
      text-decoration: none !important;
      font-weight: 500;
    }
    
    .toc-item a:hover {
      color: #2563eb;
    }
    
    /* Print Button */
    .print-btn {
      background-color: #dbeafe;
      color: #1f2937;
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      border: 1px solid #93c5fd;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      margin-bottom: 1.5rem;
      display: block;
      width: 100%;
      text-align: center;
    }
    
    .print-btn:hover {
      background-color: #bfdbfe;
      border-color: #60a5fa;
    }
    
    .text-xs {
      font-size: 0.75rem;
    }
    
    .text-slate-600 {
      color: #475569;
    }
    
    .mb-4 {
      margin-bottom: 1rem;
    }
    
    .px-2 {
      padding-left: 0.5rem;
      padding-right: 0.5rem;
    }
    
    .py-1 {
      padding-top: 0.25rem;
      padding-bottom: 0.25rem;
    }
    
    .bg-blue-50 {
      background-color: #eff6ff;
    }
    
    .border {
      border-width: 1px;
    }
    
    .border-blue-200 {
      border-color: #bfdbfe;
    }
    
    .rounded {
      border-radius: 0.25rem;
    }
    
    .text-center {
      text-align: center;
    }
    
    /* Content area */
    .content {
      padding: 2rem;
    }
    
    /* Main Title */
    h1:first-of-type {
      font-size: 2.5rem;
      font-weight: 700;
      color: #0f172a;
      margin: 2rem 0 1rem 0;
      padding-bottom: 1rem;
      border-bottom: 3px solid #2563eb;
      text-align: center;
    }
    
    /* Subtitle */
    .subtitle {
      text-align: center;
      color: #64748b;
      font-size: 1.1rem;
      margin-bottom: 3rem;
      font-weight: 400;
    }
    
    /* Section Headings */
    h1 {
      font-size: 2rem;
      font-weight: 700;
      color: #1e293b;
      margin: 2rem 0 1rem 0;
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
    
    /* Subsection Headings */
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
    
    /* Paragraphs */
    p {
      margin-bottom: 1.25rem;
      line-height: 1.7;
      color: #374151;
    }
    
    /* Lists */
    ul, ol {
      margin: 1rem 0 1.5rem 0;
      padding-left: 2rem;
    }
    
    li {
      margin-bottom: 0.5rem;
      line-height: 1.6;
      color: #374151;
    }
    
    /* Strong text */
    strong {
      font-weight: 600;
      color: #1e293b;
    }
    
    /* Links */
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
    
    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 2rem 0;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      border: 1px solid #e5e7eb;
    }
    
    /* Logic Model Table Styling */
    .logic-model-container {
      margin: 2.5rem 0;
      padding: 1rem;
      background: #f8fafc;
      border-radius: 16px;
      border: 2px solid #3b82f6;
      overflow-x: auto;
    }
    
    .logic-model-table {
      margin: 0;
      box-shadow: 0 8px 16px -4px rgba(0, 0, 0, 0.1);
      border: 2px solid #3b82f6;
      table-layout: fixed;
      width: 100%;
    }
    
    .logic-model-table th {
      padding: 0.6rem 0.8rem;
      font-size: 0.7rem;
      font-weight: 600;
      background-color: #2563eb;
      color: white;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .logic-model-table td {
      padding: 0.75rem 0.8rem;
      vertical-align: top;
      line-height: 1.4;
      background: white;
      border-right: 1px solid #e2e8f0;
      font-size: 0.75rem;
      word-wrap: break-word;
      text-align: center;
    }
    
    .logic-model-table td:last-child {
      border-right: none;
    }
    
    .logic-model-table tbody tr:hover {
      background: #f1f5f9;
    }
    
    th {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      padding: 1rem 1.5rem;
      font-weight: 600;
      text-align: left;
      color: #1e293b;
      border-bottom: 2px solid #e2e8f0;
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 0.025em;
      position: sticky;
      top: 0;
      z-index: 10;
    }
    
    td {
      padding: 1rem 1.5rem;
      border-bottom: 1px solid #f1f5f9;
      color: #374151;
      vertical-align: top;
      line-height: 1.5;
      font-size: 0.875rem;
    }
    
    tbody tr:hover {
      background-color: #f8fafc;
      transition: background-color 0.15s ease;
    }
    
    tbody tr:last-child td {
      border-bottom: none;
    }
    
    /* Alternating row colors */
    tbody tr:nth-child(even) {
      background-color: #fafbfc;
    }
    
    tbody tr:nth-child(even):hover {
      background-color: #f1f5f9;
    }
    
    /* Enhanced Table Styles - Using Theme Colors */
    .timeline-table,
    .stakeholder-table,
    .evaluation-table,
    .metrics-table {
      background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
      border-left: 4px solid #2563eb;
    }
    
    .timeline-table th,
    .stakeholder-table th,
    .evaluation-table th,
    .metrics-table th {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      color: #1e293b;
    }
    
    .standard-table {
      background: white;
      border-left: 4px solid #6b7280;
    }
    
    .standard-table th {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      color: #1e293b;
    }
    
    /* Callout Boxes */
    .highlight-box {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-left: 4px solid #2563eb;
      padding: 1.5rem;
      margin: 1.5rem 0;
      border-radius: 0 12px 12px 0;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      position: relative;
    }
    
    .highlight-box::before {
      content: "💡";
      position: absolute;
      top: 1rem;
      left: -0.75rem;
      background: #2563eb;
      color: white;
      width: 1.5rem;
      height: 1.5rem;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
    }
    
    .warning-box {
      background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
      border-left: 4px solid #d97706;
      padding: 1.5rem;
      margin: 1.5rem 0;
      border-radius: 0 12px 12px 0;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      position: relative;
    }
    
    .warning-box::before {
      content: "⚠️";
      position: absolute;
      top: 1rem;
      left: -0.75rem;
      background: #d97706;
      color: white;
      width: 1.5rem;
      height: 1.5rem;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
    }
    
    .intro-section {
      background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
      padding: 2rem;
      border-radius: 12px;
      margin: 2rem 0;
      border-left: 4px solid #0ea5e9;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      position: relative;
    }
    
    .intro-section::before {
      content: "📋";
      position: absolute;
      top: 1.5rem;
      left: -0.75rem;
      background: #0ea5e9;
      color: white;
      width: 1.5rem;
      height: 1.5rem;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
    }
    
    /* Content sections */
    .content-section {
      margin: 3rem 0;
      padding: 0 1rem;
    }
    
    /* Phase headers */
    .phase-header {
      background-color: #edf2f7;
      color: #1a365d;
      padding: 1rem;
      margin: 2rem 0 1rem 0;
      border-left: 4px solid #2c5282;
      font-weight: 600;
      font-size: 1.1rem;
    }
    
    /* Code blocks */
    pre {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1.5rem;
      overflow-x: auto;
      margin: 1.5rem 0;
      line-height: 1.5;
    }
    
    code {
      background-color: #f8fafc;
      padding: 0.2rem 0.4rem;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
    }
    
    pre code {
      background-color: transparent;
      padding: 0;
    }
    
    /* Syntax Highlighting */
    .hljs {
      background: #f8fafc;
      color: #1e293b;
      padding: 1.5rem;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      margin: 1.5rem 0;
      overflow-x: auto;
      line-height: 1.5;
    }
    
    .hljs-comment { color: #64748b; font-style: italic; }
    .hljs-keyword { color: #7c3aed; font-weight: 600; }
    .hljs-string { color: #059669; }
    .hljs-number { color: #dc2626; }
    .hljs-function { color: #2563eb; }
    .hljs-variable { color: #b45309; }
    
    /* Blockquotes */
    blockquote {
      border-left: 4px solid #cbd5e0;
      padding-left: 1rem;
      margin: 1rem 0;
      color: #4a5568;
      font-style: italic;
    }
    
    /* Task lists */
    .task-list-item {
      list-style-type: none;
      margin-left: -1.5rem;
    }
    
    .task-list-item input[type="checkbox"] {
      margin-right: 0.5rem;
    }
    
    /* Print Styles */
    @page {
      size: landscape;
      margin: 0.5in;
    }
    
    @media print {
      .no-print { 
        display: none !important; 
      }
      
      .page-break { 
        page-break-before: always; 
      }
      
      /* Expand content to use full width when printing */
      .report-container {
        max-width: 100%;
        padding: 0;
      }
      
      .flex-1 {
        max-width: 100%;
        margin: 0;
      }
      
      @page {
        size: landscape;
        margin: 0.5in;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      
      * {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
        color-adjust: exact;
      }
      
      html, body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
        color-adjust: exact;
        font-size: 12pt;
        line-height: 1.4;
      }
      
      table, th, td {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
    }
    
    /* Responsive Design */
    @media (max-width: 768px) {
      .flex {
        display: block;
      }
      
      .w-80 {
        width: 100%;
        min-height: auto;
        margin-bottom: 1rem;
        padding: 1rem;
        border-radius: 0.5rem;
      }
      
      h1:first-of-type {
        font-size: 2rem;
      }
      
      h2 {
        font-size: 1.5rem;
      }
      
      h3 {
        font-size: 1.25rem;
      }
      
      table {
        font-size: 0.875rem;
      }
      
      th, td {
        padding: 0.75rem 1rem;
      }
      
      .content-section {
        padding: 0 0.5rem;
      }
    }
  `;
  
  const printScript = includePrintButton ? `
    <script>
      function printLandscape() {
        // Use the existing comprehensive landscape CSS in the main styles
        window.print();
      }
    </script>
  ` : '';
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${organizationName} — ${programName} Evaluation Plan</title>
    <style>
        ${styles}
    </style>
    ${printScript}
</head>
<body class="bg-white">
    <!-- Table of Contents Layout -->
    <div class="report-container">
        <div class="flex">
            <!-- TOC Sidebar: Always visible on left -->
            <aside class="w-80 bg-slate-50 min-h-screen p-6 no-print">
                ${includePrintButton ? `
                <button onclick="printLandscape()" class="print-btn">
                    Print / Save PDF
                </button>
                <p class="text-xs text-slate-600 mb-4 px-2 py-1 bg-blue-50 border border-blue-200 rounded text-center">
                    💡 For best results, select <strong>Landscape</strong> orientation in your print dialog
                </p>
                ` : ''}
                <h3 class="font-semibold text-slate-900 mb-4">Table of Contents</h3>
                <nav class="space-y-1 text-sm">
                    ${tocHTML}
                </nav>
            </aside>

            <!-- Main Content -->
            <main class="flex-1 p-6">
                <div class="max-w-none">
                    <h1 id="${slugger.slug(organizationName + ' ' + programName + ' Evaluation Plan')}">${organizationName} — ${programName} Evaluation Plan</h1>
                    <p class="subtitle">Generated on ${date}</p>
                    ${contentHTML}
                </div>
            </main>
        </div>
    </div>
</body>
</html>`;
  
  return html;
}

// Export with both names for compatibility
const generateFullHtmlDocument = generateHTMLReport;

module.exports = { 
  generateHTMLReport,
  generateFullHtmlDocument 
};