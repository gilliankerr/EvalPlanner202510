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
function initializeMarked(slugger, programName) {
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
    const anchor = slugger.slug(rawText);
    
    return `<h${depth} id="${anchor}" class="heading-level-${depth}">${text}</h${depth}>`;
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
  
  // Custom table renderer
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
  
  // Code block with syntax highlighting
  renderer.code = function(code, language) {
    const validLanguage = hljs.getLanguage(language) ? language : 'plaintext';
    const highlighted = hljs.highlight(code, { language: validLanguage }).value;
    return `<pre><code class="hljs ${validLanguage}">${highlighted}</code></pre>`;
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
  
  // Initialize marked with custom renderer
  const renderer = initializeMarked(slugger, programName);
  
  // Configure marked options
  marked.setOptions({
    renderer: renderer,
    highlight: function(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, { language }).value;
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