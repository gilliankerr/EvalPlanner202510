const marked = require('marked');
const hljs = require('highlight.js');

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

// Initialize marked with custom renderer
function initializeMarked(slugger, programName) {
  const renderer = new marked.Renderer();
  
  // Custom heading renderer with IDs for TOC navigation
  renderer.heading = function(text, level, raw) {
    // Handle both old and new marked API signatures
    let tokens, depth;
    
    if (typeof text === 'object' && text !== null) {
      // New API: object with { tokens, depth, text }
      tokens = text.tokens;
      depth = text.depth || level;
      // For new API, we need to parse tokens to get HTML
      if (tokens && Array.isArray(tokens)) {
        text = this.parser.parseInline(tokens);
      } else {
        text = text.text || '';
      }
    } else {
      // Old API: (text, level, raw)
      depth = level;
    }
    
    // Ensure we have valid values
    depth = depth || 1;
    const textStr = String(text || '');
    
    const anchorText = textStr.replace(/<[^>]*>/g, '').trim();
    const anchor = slugger.slug(anchorText);
    
    return `<h${depth} id="${anchor}">${textStr}</h${depth}>`;
  };
  
  // Custom paragraph renderer
  renderer.paragraph = function(token) {
    // Handle both old and new marked API signatures
    if (typeof token === 'object' && token !== null) {
      // New API: token object with tokens array
      if (token.tokens && Array.isArray(token.tokens)) {
        const text = this.parser.parseInline(token.tokens);
        return `<p>${text}</p>\n`;
      }
      // Fallback for other object formats
      return `<p>${token.text || ''}</p>\n`;
    }
    // Old API: string parameter
    return `<p>${token}</p>\n`;
  };
  
  // Custom table renderer
  renderer.table = function(token) {
    // Handle both old and new marked API signatures
    let header, body;
    
    if (typeof token === 'object' && token !== null && token.header && token.rows) {
      // New API: token object
      // Build header HTML
      const headerCells = token.header.map((cell, i) => {
        const align = token.align && token.align[i] ? ` align="${token.align[i]}"` : '';
        const cellText = cell.tokens ? this.parser.parseInline(cell.tokens) : cell.text || '';
        return `<th${align}>${cellText}</th>`;
      }).join('');
      header = `<thead>\n<tr>\n${headerCells}\n</tr>\n</thead>`;
      
      // Build body HTML
      const bodyRows = token.rows.map(row => {
        const cells = row.map((cell, i) => {
          const align = token.align && token.align[i] ? ` align="${token.align[i]}"` : '';
          const cellText = cell.tokens ? this.parser.parseInline(cell.tokens) : cell.text || '';
          return `<td${align}>${cellText}</td>`;
        }).join('');
        return `<tr>\n${cells}\n</tr>`;
      }).join('\n');
      body = `<tbody>\n${bodyRows}\n</tbody>`;
    } else {
      // Old API: (header, body) string parameters
      header = arguments[0] || token || '';
      body = arguments[1] || '';
    }
    
    // Extract header text for classification
    const headerText = header.toLowerCase();
    const isLogicModel = isLogicModelTable(headerText);
    const tableClass = isLogicModel ? 'logic-model-table' : detectTableType(headerText);
    
    if (isLogicModel) {
      return `
        <div class="logic-model-section">
          <h3 class="logic-model-title">Logic Model for ${programName}</h3>
          <div class="table-responsive">
            <table class="${tableClass}">
              ${header}
              ${body}
            </table>
          </div>
        </div>\n`;
    }
    
    return `
      <div class="table-responsive">
        <table class="${tableClass}">
          ${header}
          ${body}
        </table>
      </div>\n`;
  };
  
  // Custom list renderer
  renderer.list = function(token) {
    // Handle both old and new marked API signatures
    if (typeof token === 'object' && token !== null) {
      // New API: token object
      const ordered = token.ordered;
      const start = token.start;
      const items = token.items || [];
      
      const type = ordered ? 'ol' : 'ul';
      const startAttr = ordered && start !== 1 ? ` start="${start}"` : '';
      
      const itemsHtml = items.map(item => {
        // Parse the item tokens
        let itemContent = '';
        if (item.tokens && Array.isArray(item.tokens)) {
          itemContent = this.parser.parse(item.tokens);
        } else {
          itemContent = item.text || '';
        }
        return `<li>${itemContent}</li>`;
      }).join('\n');
      
      return `<${type}${startAttr}>\n${itemsHtml}\n</${type}>\n`;
    }
    
    // Old API: (body, ordered, start) parameters
    const body = arguments[0] || token || '';
    const ordered = arguments[1] || false;
    const start = arguments[2] || 1;
    
    const type = ordered ? 'ol' : 'ul';
    const startAttr = ordered && start !== 1 ? ` start="${start}"` : '';
    
    return `<${type}${startAttr}>\n${body}</${type}>\n`;
  };
  
  // Custom list item renderer
  renderer.listitem = function(token) {
    // Handle both old and new marked API signatures
    if (typeof token === 'object' && token !== null) {
      // New API: token object
      let text = '';
      if (token.tokens && Array.isArray(token.tokens)) {
        text = this.parser.parse(token.tokens);
      } else {
        text = token.text || '';
      }
      return `<li>${text}</li>\n`;
    }
    
    // Old API: string parameter
    return `<li>${token}</li>\n`;
  };
  
  // Custom code renderer
  renderer.code = function(token) {
    // Handle both old and new marked API signatures
    let code, lang;
    
    if (typeof token === 'object' && token !== null) {
      // New API: token object
      code = token.text || '';
      lang = token.lang || '';
    } else {
      // Old API: (code, infostring, escaped) parameters
      code = arguments[0] || token || '';
      lang = arguments[1] || '';
    }
    
    // Highlight code if language is specified
    if (lang && hljs.getLanguage(lang)) {
      try {
        const highlighted = hljs.highlight(code, { language: lang }).value;
        return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>\n`;
      } catch (err) {
        console.error('Highlighting error:', err);
      }
    }
    
    // Fallback to plain code block
    const escaped = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<pre><code>${escaped}</code></pre>\n`;
  };
  
  return renderer;
}

// Main HTML generation function
function generateHTMLReport(content, organizationName, programName, options = {}) {
  const fullHTML = generateFullHtmlDocument(content, organizationName, programName, options);
  return fullHTML;
}

// Full HTML document generator with all styles inline
function generateFullHtmlDocument(markdownContent, organizationName, programName, options = {}) {
  // Create a new slugger instance for this document
  const slugger = new marked.Slugger();
  
  // Initialize marked with custom renderer
  const renderer = initializeMarked(slugger, programName);
  
  // Configure marked options
  marked.setOptions({
    renderer: renderer,
    highlight: function(code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(code, { language: lang }).value;
        } catch (err) {
          console.error('Highlighting error:', err);
        }
      }
      return code;
    },
    breaks: true,
    gfm: true,
    headerIds: true,
    mangle: false,
    sanitize: false
  });
  
  // Convert markdown to HTML
  const htmlContent = marked.parse(markdownContent);
  
  // Generate table of contents
  const headings = [];
  const headingRegex = /<h([1-3])[^>]*id="([^"]*)"[^>]*>(.*?)<\/h[1-3]>/gi;
  let match;
  
  while ((match = headingRegex.exec(htmlContent)) !== null) {
    headings.push({
      level: parseInt(match[1]),
      id: match[2],
      text: match[3].replace(/<[^>]*>/g, '').trim()
    });
  }
  
  let tocHtml = '<nav class="toc" role="navigation" aria-label="Table of contents">\n';
  tocHtml += '<h2>Table of Contents</h2>\n';
  tocHtml += '<ul>\n';
  
  headings.forEach(heading => {
    const indent = '  '.repeat(heading.level - 1);
    tocHtml += `${indent}<li class="toc-level-${heading.level}">`;
    tocHtml += `<a href="#${heading.id}">${heading.text}</a>`;
    tocHtml += '</li>\n';
  });
  
  tocHtml += '</ul>\n</nav>\n\n';
  
  // Create the complete HTML document
  const fullHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Evaluation Plan for ${programName} by ${organizationName}">
  <title>Evaluation Plan - ${programName}</title>
  <style>
    /* CSS Reset and Base Styles */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    /* Root Variables */
    :root {
      --primary-color: #0969da;
      --secondary-color: #6c757d;
      --success-color: #28a745;
      --warning-color: #ffc107;
      --danger-color: #dc3545;
      --info-color: #17a2b8;
      --light-bg: #f8f9fa;
      --dark-text: #212529;
      --border-color: #dee2e6;
      --link-color: #0969da;
      --link-hover: #0051a3;
      --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      --font-size-base: 16px;
      --line-height-base: 1.6;
      --spacing-xs: 0.25rem;
      --spacing-sm: 0.5rem;
      --spacing-md: 1rem;
      --spacing-lg: 1.5rem;
      --spacing-xl: 2rem;
      --spacing-xxl: 3rem;
      --border-radius: 4px;
      --max-width: 900px;
    }
    
    /* Base Typography */
    body {
      font-family: var(--font-family);
      font-size: var(--font-size-base);
      line-height: var(--line-height-base);
      color: var(--dark-text);
      background-color: white;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      padding: var(--spacing-xl) var(--spacing-md);
    }
    
    .container {
      max-width: var(--max-width);
      margin: 0 auto;
      padding: 0 var(--spacing-md);
    }
    
    /* Header Styles */
    .header {
      text-align: center;
      margin-bottom: var(--spacing-xxl);
      padding: var(--spacing-xl) 0;
      border-bottom: 2px solid var(--border-color);
    }
    
    .header h1 {
      color: var(--primary-color);
      font-size: 2.5rem;
      margin-bottom: var(--spacing-md);
      font-weight: 600;
    }
    
    .header p {
      color: var(--secondary-color);
      font-size: 1.1rem;
      margin: var(--spacing-sm) 0;
    }
    
    /* Headings */
    h1, h2, h3, h4, h5, h6 {
      font-weight: 600;
      line-height: 1.2;
      margin-top: var(--spacing-xl);
      margin-bottom: var(--spacing-md);
      color: var(--dark-text);
    }
    
    h1 { font-size: 2.25rem; }
    h2 { 
      font-size: 1.875rem; 
      color: var(--primary-color);
      border-bottom: 2px solid var(--light-bg);
      padding-bottom: var(--spacing-sm);
      margin-top: var(--spacing-xxl);
    }
    h3 { 
      font-size: 1.5rem; 
      margin-top: var(--spacing-xl);
    }
    h4 { font-size: 1.25rem; }
    h5 { font-size: 1.125rem; }
    h6 { font-size: 1rem; }
    
    /* Paragraph and Text */
    p {
      margin-bottom: var(--spacing-md);
    }
    
    /* Links */
    a {
      color: var(--link-color);
      text-decoration: underline;
      transition: color 0.2s ease;
    }
    
    a:hover {
      color: var(--link-hover);
      text-decoration: underline;
    }
    
    a:focus {
      outline: 2px solid var(--link-color);
      outline-offset: 2px;
    }
    
    /* Lists */
    ul, ol {
      margin-bottom: var(--spacing-md);
      padding-left: var(--spacing-xl);
    }
    
    li {
      margin-bottom: var(--spacing-sm);
    }
    
    li > ul, li > ol {
      margin-top: var(--spacing-sm);
      margin-bottom: var(--spacing-sm);
    }
    
    /* Table of Contents */
    .toc {
      background-color: var(--light-bg);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: var(--spacing-lg);
      margin-bottom: var(--spacing-xxl);
    }
    
    .toc h2 {
      font-size: 1.25rem;
      margin-top: 0;
      margin-bottom: var(--spacing-md);
      color: var(--dark-text);
      border: none;
      padding: 0;
    }
    
    .toc ul {
      list-style: none;
      padding-left: 0;
    }
    
    .toc li {
      margin-bottom: var(--spacing-xs);
      line-height: 1.8;
    }
    
    .toc-level-2 {
      padding-left: var(--spacing-lg);
    }
    
    .toc-level-3 {
      padding-left: calc(var(--spacing-lg) * 2);
    }
    
    .toc a {
      color: var(--dark-text);
      text-decoration: none;
      border-bottom: 1px dotted var(--border-color);
    }
    
    .toc a:hover {
      color: var(--link-color);
      border-bottom-color: var(--link-color);
    }
    
    /* Tables */
    .table-responsive {
      overflow-x: auto;
      margin: var(--spacing-lg) 0;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.95rem;
      background-color: white;
    }
    
    th, td {
      padding: var(--spacing-md);
      text-align: left;
      vertical-align: top;
      border: 1px solid var(--border-color);
    }
    
    th {
      background-color: var(--light-bg);
      font-weight: 600;
      color: var(--dark-text);
      white-space: nowrap;
    }
    
    td {
      background-color: white;
    }
    
    tbody tr:nth-child(even) td {
      background-color: rgba(248, 249, 250, 0.5);
    }
    
    tbody tr:hover td {
      background-color: rgba(9, 105, 218, 0.05);
    }
    
    /* Specialized Table Styles */
    .logic-model-section {
      margin: var(--spacing-xxl) 0;
      padding: var(--spacing-xl);
      background-color: var(--light-bg);
      border-radius: var(--border-radius);
      page-break-inside: avoid;
    }
    
    .logic-model-title {
      text-align: center;
      color: var(--primary-color);
      margin-bottom: var(--spacing-lg);
      font-size: 1.5rem;
    }
    
    .logic-model-table {
      border: 2px solid var(--primary-color);
    }
    
    .logic-model-table th {
      background-color: var(--primary-color);
      color: white;
      text-align: center;
      font-size: 1rem;
      padding: var(--spacing-md) var(--spacing-sm);
    }
    
    .logic-model-table td {
      vertical-align: middle;
      padding: var(--spacing-md);
      background-color: white;
    }
    
    /* Risk Table */
    .risks-table th {
      background-color: #dc3545;
      color: white;
    }
    
    .risks-table tbody tr:nth-child(even) td {
      background-color: rgba(220, 53, 69, 0.05);
    }
    
    /* Stakeholder Table */
    .stakeholder-table th {
      background-color: #17a2b8;
      color: white;
    }
    
    /* Code Blocks */
    pre {
      background-color: var(--light-bg);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: var(--spacing-md);
      overflow-x: auto;
      margin-bottom: var(--spacing-md);
    }
    
    code {
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 0.875rem;
      background-color: var(--light-bg);
      padding: 0.125rem 0.25rem;
      border-radius: 3px;
    }
    
    pre code {
      background-color: transparent;
      padding: 0;
    }
    
    /* Syntax Highlighting */
    .hljs {
      display: block;
      overflow-x: auto;
      padding: var(--spacing-md);
      background: var(--light-bg);
    }
    
    /* Blockquotes */
    blockquote {
      border-left: 4px solid var(--primary-color);
      padding-left: var(--spacing-lg);
      margin: var(--spacing-lg) 0;
      color: var(--secondary-color);
      font-style: italic;
    }
    
    /* Horizontal Rules */
    hr {
      border: none;
      border-top: 2px solid var(--border-color);
      margin: var(--spacing-xxl) 0;
    }
    
    /* Print Styles */
    @media print {
      body {
        font-size: 12pt;
        line-height: 1.5;
        padding: 0;
      }
      
      .container {
        max-width: 100%;
        padding: 0;
      }
      
      .header {
        page-break-after: avoid;
      }
      
      h1, h2, h3, h4, h5, h6 {
        page-break-after: avoid;
        page-break-inside: avoid;
      }
      
      table, figure, blockquote {
        page-break-inside: avoid;
      }
      
      .toc {
        page-break-after: always;
      }
      
      .logic-model-section {
        page-break-inside: avoid;
      }
      
      a {
        color: var(--dark-text);
        text-decoration: underline;
      }
      
      a[href^="http"]:after {
        content: " (" attr(href) ")";
        font-size: 0.8em;
        color: var(--secondary-color);
      }
      
      a[href^="#"]:after {
        content: "";
      }
      
      .table-responsive {
        border: none;
        overflow: visible;
      }
      
      table {
        font-size: 10pt;
      }
      
      th, td {
        padding: var(--spacing-sm);
      }
    }
    
    /* Responsive Design */
    @media (max-width: 768px) {
      body {
        padding: var(--spacing-md);
      }
      
      .header h1 {
        font-size: 2rem;
      }
      
      h1 { font-size: 1.75rem; }
      h2 { font-size: 1.5rem; }
      h3 { font-size: 1.25rem; }
      
      table {
        font-size: 0.875rem;
      }
      
      th, td {
        padding: var(--spacing-sm);
      }
      
      .logic-model-table th {
        font-size: 0.875rem;
        padding: var(--spacing-sm) var(--spacing-xs);
      }
    }
    
    /* Accessibility Enhancements */
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
    
    /* Skip to main content link */
    .skip-link {
      position: absolute;
      top: -40px;
      left: 0;
      background: var(--primary-color);
      color: white;
      padding: var(--spacing-sm);
      text-decoration: none;
      z-index: 100;
    }
    
    .skip-link:focus {
      top: 0;
    }
    
    /* Focus indicators for interactive elements */
    button:focus,
    input:focus,
    select:focus,
    textarea:focus {
      outline: 2px solid var(--primary-color);
      outline-offset: 2px;
    }
    
    /* High contrast mode support */
    @media (prefers-contrast: high) {
      :root {
        --border-color: #000;
        --light-bg: #fff;
      }
      
      table, th, td {
        border: 2px solid var(--border-color);
      }
    }
    
    /* Dark mode support */
    @media (prefers-color-scheme: dark) {
      :root {
        --light-bg: #1e1e1e;
        --dark-text: #e4e4e4;
        --border-color: #444;
        --link-color: #58a6ff;
        --link-hover: #79c0ff;
      }
      
      body {
        background-color: #0d1117;
        color: var(--dark-text);
      }
      
      th {
        background-color: #161b22;
      }
      
      td {
        background-color: #0d1117;
      }
      
      tbody tr:nth-child(even) td {
        background-color: rgba(110, 118, 129, 0.1);
      }
      
      pre, code {
        background-color: #161b22;
      }
      
      .toc {
        background-color: #161b22;
        border-color: #30363d;
      }
      
      .logic-model-section {
        background-color: #161b22;
      }
    }
  </style>
</head>
<body>
  <a href="#main" class="skip-link">Skip to main content</a>
  <div class="container">
    <header class="header">
      <h1>Evaluation Plan</h1>
      <p><strong>Organization:</strong> ${organizationName}</p>
      <p><strong>Program:</strong> ${programName}</p>
      <p><strong>Generated:</strong> ${new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })}</p>
    </header>
    
    <main id="main" role="main" aria-label="Evaluation plan content">
      ${tocHtml}
      ${htmlContent}
    </main>
    
    <footer style="margin-top: var(--spacing-xxl); padding-top: var(--spacing-xl); border-top: 1px solid var(--border-color); text-align: center; color: var(--secondary-color); font-size: 0.9rem;">
      <p>Generated by Evaluation Planner · Based on LogicalOutcomes Evaluation Planning Handbook</p>
      <p style="margin-top: var(--spacing-sm);">
        <a href="https://www.logicaloutcomes.net" target="_blank" rel="noopener noreferrer">www.logicaloutcomes.net</a>
      </p>
    </footer>
  </div>
</body>
</html>`;
  
  return fullHTML;
}

// Export both names for compatibility
module.exports = { 
  generateHTMLReport,
  generateFullHtmlDocument: generateHTMLReport
};