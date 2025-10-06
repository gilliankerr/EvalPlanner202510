const { marked } = require('marked');
const hljs = require('highlight.js');
const { JSDOM } = require('jsdom');
const DOMPurify = require('dompurify');

// Create DOMPurify instance for Node.js
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
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function initializeMarked(slugger, programName) {
  slugger.reset();
  
  const renderer = new marked.Renderer();

  renderer.heading = function(token) {
    const text = this.parser.parseInline(token.tokens);
    const rawText = token.tokens.map(t => t.type === 'text' ? t.text : '').join('');
    const level = token.depth;
    const id = slugger.slug(rawText);
    
    if (level === 2) {
      return `<section class="content-section"><h2 id="${id}">${text}</h2>`;
    }
    
    return `<h${level} id="${id}">${text}</h${level}>`;
  };

  renderer.table = function(token) {
    const header = token.header.map(cell => {
      const cellContent = this.parser.parseInline(cell.tokens);
      return `<th>${cellContent}</th>`;
    }).join('');
    
    const body = token.rows.map(row => 
      `<tr>${row.map(cell => {
        const cellContent = this.parser.parseInline(cell.tokens);
        return `<td>${cellContent}</td>`;
      }).join('')}</tr>`
    ).join('');
    
    const flattenHeaderTokens = (tokens) => {
      return tokens.map(t => {
        if (t.type === 'text') return t.text;
        if (t.type === 'strong') return flattenHeaderTokens(t.tokens);
        if (t.type === 'em') return flattenHeaderTokens(t.tokens);
        if (t.type === 'link') return flattenHeaderTokens(t.tokens);
        if (t.type === 'codespan') return t.text;
        return '';
      }).join('');
    };
    
    const headerRawText = token.header.map(cell => 
      flattenHeaderTokens(cell.tokens)
    ).join(' ');
    
    if (isLogicModelTable(headerRawText)) {
      const tokenTextData = token.rows.map(row => 
        row.map(cell => flattenTokensToText(cell.tokens))
      );
      
      const enhancedBody = tokenTextData.map(row => 
        `<tr>${row.map(cellText => {
          if (!cellText.trim()) {
            return '<td><em>No content specified</em></td>';
          }
          
          const semicolonItems = cellText.split(/;\s*/);
          const allItems = [];
          
          semicolonItems.forEach(item => {
            const lineItems = item.split(/\n+/).map(s => s.trim()).filter(s => s.length > 0);
            allItems.push(...lineItems);
          });
          
          const finalItems = allItems.filter(item => item.length > 0);
          
          const bulletedHtml = finalItems.length > 1 
            ? finalItems.map(item => `• ${item}`).join('<br>')
            : (finalItems[0] || '<em>No content</em>');
            
          return `<td>${bulletedHtml}</td>`;
        }).join('')}</tr>`
      ).join('');
      
      return `<div class="logic-model-container">
        <h4 style="margin: 0 0 1rem 0; color: #1e40af; text-align: center;">${programName} Logic Model</h4>
        <table class="logic-model-table">
          <thead><tr>${header}</tr></thead>
          <tbody>${enhancedBody}</tbody>
        </table>
      </div>`;
    }
    
    const tableClass = detectTableType(headerRawText);
    
    return `<table class="${tableClass}"><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
  };

  renderer.paragraph = function(token) {
    const text = this.parser.parseInline(token.tokens);
    const rawText = token.tokens.map(t => {
      if (t.type === 'text') return t.text;
      if (t.type === 'strong') return t.tokens.map(st => st.type === 'text' ? st.text : '').join('');
      return '';
    }).join('');
    
    if (rawText.startsWith('Key Insight:') || rawText.startsWith('Important:')) {
      return `<div class="highlight-box">${text}</div>`;
    }
    
    if (rawText.startsWith('Warning:') || rawText.startsWith('Note:')) {
      return `<div class="warning-box">${text}</div>`;
    }
    
    if (rawText.includes('Created on') && rawText.includes('LogicalOutcomes Evaluation Planner')) {
      return `<p class="subtitle">${text}</p>`;
    }
    
    return `<p>${text}</p>`;
  };

  renderer.list = function(token) {
    const tag = token.ordered ? 'ol' : 'ul';
    const body = token.items.map(item => {
      const itemContent = item.tokens.map(t => {
        if (t.type === 'text') return this.parser.parseInline([t]);
        if (t.type === 'paragraph') return this.parser.parseInline(t.tokens);
        if (t.type === 'list') return this.list(t);
        return '';
      }).join('');
      return `<li>${itemContent}</li>`;
    }).join('');
    return `<${tag}>${body}</${tag}>`;
  };

  renderer.code = function(token) {
    const code = token.text;
    const language = token.lang || '';
    const validLanguage = language && hljs.getLanguage(language) ? language : 'plaintext';
    try {
      const highlighted = hljs.highlight(code, { language: validLanguage }).value;
      return `<pre class="hljs"><code class="language-${validLanguage}">${highlighted}</code></pre>`;
    } catch (err) {
      return `<pre class="hljs"><code>${token.text}</code></pre>`;
    }
  };

  renderer.link = function(token) {
    const href = token.href;
    const title = token.title ? ` title="${token.title}"` : '';
    const text = this.parser.parseInline(token.tokens);
    return `<a href="${href}"${title}>${text}</a>`;
  };

  marked.use({ 
    renderer,
    breaks: true,
    gfm: true
  });
}

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
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      border: 1px solid #e5e7eb;
    }
    
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
    }
    
    .logic-model-table td {
      padding: 0.75rem 0.8rem;
      vertical-align: top;
      line-height: 1.4;
      background: white;
      border-right: 1px solid #e2e8f0;
      font-size: 0.75rem;
      word-wrap: break-word;
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
    
    tbody tr:nth-child(even) {
      background-color: #fafbfc;
    }
    
    tbody tr:nth-child(even):hover {
      background-color: #f1f5f9;
    }

    caption {
      caption-side: top;
      padding: 1rem 0;
      font-weight: 600;
      color: #1e293b;
      font-size: 1.1rem;
    }

    .intro-section {
      background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
      padding: 2rem;
      border-radius: 12px;
      margin: 2rem 0;
      border-left: 4px solid #0ea5e9;
    }

    .content-section {
      margin: 3rem 0;
      padding: 0 1rem;
    }

    @media (max-width: 768px) {
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

    .toc-item {
      padding: 0.5rem 0.75rem;
      border-radius: 6px;
      transition: all 0.15s ease;
    }
    
    .toc-level-1 {
      margin-left: 0;
    }
    
    .toc-level-2 {
      margin-left: 0.5rem;
    }
    
    .toc-level-3 {
      margin-left: 1rem;
    }
    
    .toc-item:hover {
      background-color: #f1f5f9;
      transform: translateX(4px);
    }
    
    .toc-item a {
      color: #475569;
      text-decoration: underline;
      font-weight: 500;
    }
    
    .toc-item a:hover {
      color: #2563eb;
    }
    
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
    
    .error-message {
      background: #fee2e2;
      border: 1px solid #fca5a5;
      color: #dc2626;
      padding: 1rem;
      border-radius: 8px;
      margin: 1rem 0;
    }
    
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
    
    @media (max-width: 768px) {
      .logic-model-diagram {
        padding: 1rem;
        margin: 2rem 0;
      }
      
      .logic-model-svg {
        width: 100%;
        height: auto;
      }
      
      table {
        display: block;
        overflow-x: auto;
        white-space: nowrap;
        border-radius: 8px;
        margin: 1rem 0;
      }
      
      table.timeline-table,
      table.stakeholder-table,
      table.evaluation-table,
      table.metrics-table,
      table.standard-table {
        min-width: 600px;
      }
      
      .highlight-box,
      .warning-box,
      .intro-section {
        margin: 1rem 0;
        padding: 1rem;
        border-radius: 0 8px 8px 0;
      }
      
      .highlight-box::before,
      .warning-box::before,
      .intro-section::before {
        display: none;
      }
      
      .hljs {
        padding: 1rem;
        font-size: 0.875rem;
        margin: 1rem 0;
      }
    }
    
    @media (max-width: 480px) {
      .logic-model-diagram {
        padding: 0.75rem;
      }
      
      .logic-model-diagram h4 {
        font-size: 1rem;
        margin-bottom: 1rem;
      }
      
      table {
        font-size: 0.75rem;
      }
      
      th, td {
        padding: 0.5rem 0.75rem;
      }
      
      .highlight-box,
      .warning-box,
      .intro-section {
        padding: 0.75rem;
        margin: 0.75rem 0;
      }
    }
    
    .flex {
      display: flex;
    }
    
    .max-w-6xl {
      max-width: 1200px;
    }
    
    .report-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 1rem;
    }
    
    .mx-auto {
      margin-left: auto;
      margin-right: auto;
    }
  `;
}

module.exports = {
  convertMarkdownToHtml,
  generateTOC,
  getReportStyles
};
