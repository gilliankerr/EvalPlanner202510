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

// Generate the complete HTML document
function generateHTMLReport(evaluationPlan, options = {}) {
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
  
  // Process the markdown content with our custom renderer
  const contentHTML = marked.parse(evaluationPlan);
  
  // Reuse CSS from the frontend
  const styles = `
    @media print {
      .no-print { display: none; }
      .page-break { page-break-before: always; }
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #2d3748;
      background-color: white;
      margin: 0;
      padding: 0;
    }
    
    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem;
    }
    
    .header {
      text-align: center;
      margin-bottom: 3rem;
      padding-bottom: 1rem;
      border-bottom: 2px solid #e2e8f0;
    }
    
    .header h1 {
      color: #1a365d;
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }
    
    .header .subtitle {
      color: #4a5568;
      font-size: 1.1rem;
      margin-top: 0.5rem;
    }
    
    .header .date {
      color: #718096;
      font-size: 0.9rem;
      margin-top: 1rem;
    }
    
    .content {
      background-color: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    
    h1 { 
      color: #1a365d; 
      font-size: 2rem; 
      margin-top: 2rem; 
      margin-bottom: 1rem;
      font-weight: 700;
    }
    
    h2 { 
      color: #2c5282; 
      font-size: 1.5rem; 
      margin-top: 2rem; 
      margin-bottom: 1rem;
      font-weight: 600;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 0.5rem;
    }
    
    h3 { 
      color: #2d3748; 
      font-size: 1.25rem; 
      margin-top: 1.5rem; 
      margin-bottom: 0.75rem;
      font-weight: 600;
    }
    
    h4 { 
      color: #4a5568; 
      font-size: 1.1rem; 
      margin-top: 1.25rem; 
      margin-bottom: 0.5rem;
      font-weight: 600;
    }
    
    p { 
      margin-bottom: 1rem; 
      text-align: justify;
      color: #2d3748;
    }
    
    ul, ol { 
      margin-bottom: 1rem; 
      padding-left: 2rem;
      color: #2d3748;
    }
    
    li { 
      margin-bottom: 0.5rem; 
    }
    
    /* Enhanced table styles */
    .table-wrapper {
      overflow-x: auto;
      margin: 2rem 0;
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.95rem;
    }
    
    th {
      background-color: #f7fafc;
      color: #1a365d;
      font-weight: 600;
      text-align: left;
      padding: 1rem;
      border-bottom: 2px solid #cbd5e0;
    }
    
    td {
      padding: 1rem;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }
    
    tr:hover {
      background-color: #f7fafc;
    }
    
    /* Logic Model specific styling */
    .logic-model-table {
      margin: 2rem 0;
    }
    
    .logic-model-table table {
      background-color: white;
    }
    
    .logic-model-table th {
      background-color: #2c5282;
      color: white;
      text-align: center;
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 1rem 0.5rem;
      white-space: normal;
    }
    
    .logic-model-table td {
      background-color: #f8fafc;
      text-align: center;
      padding: 1rem;
      vertical-align: middle;
    }
    
    .logic-model-table tr:nth-child(even) td {
      background-color: white;
    }
    
    /* Stakeholder table styling */
    .stakeholder-table th {
      background-color: #4a5568;
      color: white;
    }
    
    /* Risks table styling */
    .risks-table th {
      background-color: #c53030;
      color: white;
    }
    
    /* Timeline table styling */
    .timeline-table th {
      background-color: #2b6cb0;
      color: white;
    }
    
    /* Budget table styling */
    .budget-table th {
      background-color: #2f855a;
      color: white;
    }
    
    /* Indicators table styling */
    .indicators-table th {
      background-color: #6b46c1;
      color: white;
    }
    
    /* Methods table styling */
    .methods-table th {
      background-color: #d69e2e;
      color: white;
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
    
    /* Print button styling */
    .print-button {
      background-color: #2c5282;
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      font-size: 1rem;
      border-radius: 6px;
      cursor: pointer;
      margin-bottom: 2rem;
      transition: background-color 0.2s;
    }
    
    .print-button:hover {
      background-color: #2a4e7c;
    }
    
    /* Code blocks */
    pre {
      background-color: #f7fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 1rem;
      overflow-x: auto;
      margin: 1rem 0;
    }
    
    code {
      background-color: #f7fafc;
      padding: 0.2rem 0.4rem;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
    }
    
    pre code {
      background-color: transparent;
      padding: 0;
    }
    
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
  `;
  
  const printScript = includePrintButton ? `
    <script>
      function printReport() {
        window.print();
      }
    </script>
  ` : '';
  
  const printButton = includePrintButton ? `
    <button class="print-button no-print" onclick="printReport()">Print Report</button>
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
<body>
    <div class="container">
        <div class="header">
            <h1>${organizationName} — ${programName}</h1>
            <div class="subtitle">Evaluation Plan</div>
            <div class="date">Generated on ${date}</div>
        </div>
        ${printButton}
        <div class="content">
            ${contentHTML}
        </div>
    </div>
</body>
</html>`;
  
  return html;
}

module.exports = { generateHTMLReport };
