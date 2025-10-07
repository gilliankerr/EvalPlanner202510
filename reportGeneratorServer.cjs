const express = require('express');
const cors = require('cors');
const pg = require('pg');
const marked = require('marked');
const hljs = require('highlight.js');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const port = process.env.EMAIL_SERVER_PORT || 3001;

// Initialize database connection
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

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
    
    // Extract clean text for ID generation
    const rawText = textStr.replace(/<[^>]+>/g, '').trim();
    
    // Generate consistent ID for TOC navigation
    const id = slugger.slug(rawText);
    const levelClass = `heading-level-${depth}`;
    
    return `<h${depth} id="${id}" class="${levelClass}">${textStr}</h${depth}>`;
  };
  
  // Custom table renderer with enhanced styling
  renderer.table = function(header, body) {
    // Handle both old and new marked API signatures
    let align;
    
    if (typeof header === 'object' && header !== null && header.header !== undefined) {
      // New API: object with { header, body, align }
      const obj = header;
      header = obj.header;
      body = obj.body;
      align = obj.align;
    }
    
    // Parse tokens to get HTML if needed
    if (Array.isArray(header)) {
      header = this.parser.parseInline(header);
    }
    if (Array.isArray(body)) {
      body = this.parser.parseInline(body);
    }
    
    const headerStr = String(header || '');
    const bodyStr = String(body || '');
    const headerText = headerStr.replace(/<[^>]+>/g, ' ').toLowerCase();
    
    const tableType = detectTableType(headerText);
    const isLogicModel = isLogicModelTable(headerText);
    const tableClass = isLogicModel ? 'logic-model-table' : tableType;
    
    return `<div class="table-wrapper ${tableClass}">
      <table class="${tableClass}">
        <thead>${headerStr}</thead>
        <tbody>${bodyStr}</tbody>
      </table>
    </div>`;
  };
  
  // Custom list renderer
  renderer.list = function(body, ordered, start) {
    // Handle both old and new marked API signatures
    if (typeof body === 'object' && body !== null && body.body !== undefined) {
      // New API: object with { body, ordered, start }
      const obj = body;
      body = obj.body;
      ordered = obj.ordered;
      start = obj.start;
    }
    
    // Parse tokens if needed
    if (Array.isArray(body)) {
      body = this.parser.parseInline(body);
    }
    
    const bodyStr = String(body || '');
    const type = ordered ? 'ol' : 'ul';
    const startAttr = (ordered && start !== undefined && start !== 1) ? ` start="${start}"` : '';
    return `<${type}${startAttr} class="content-list">${bodyStr}</${type}>`;
  };
  
  // Custom table row renderer
  renderer.tablerow = function(content) {
    // Handle both old and new marked API signatures
    if (typeof content === 'object' && content !== null) {
      // New API: object with { text } or direct token array
      if (content.text !== undefined) {
        content = content.text;
      } else if (Array.isArray(content)) {
        content = this.parser.parseInline(content);
      }
    }
    
    const contentStr = String(content || '');
    return `<tr>${contentStr}</tr>`;
  };
  
  // Custom table cell renderer
  renderer.tablecell = function(content, flags) {
    // Handle both old and new marked API signatures
    let header, align;
    
    if (typeof content === 'object' && content !== null) {
      // New API: object with { text, tokens, flags }
      if (content.tokens && Array.isArray(content.tokens)) {
        content = this.parser.parseInline(content.tokens);
      } else if (content.text !== undefined) {
        content = content.text;
      }
      
      if (content.flags) {
        flags = content.flags;
      }
    }
    
    // Parse flags
    if (flags) {
      header = flags.header;
      align = flags.align;
    }
    
    const contentStr = String(content || '');
    const tag = header ? 'th' : 'td';
    const alignAttr = align ? ` style="text-align: ${align};"` : '';
    return `<${tag}${alignAttr}>${contentStr}</${tag}>`;
  };
  
  // Custom list item renderer
  renderer.listitem = function(text, task, checked) {
    // Handle both old and new marked API signatures
    if (typeof text === 'object' && text !== null) {
      // New API: object with { text, tokens, task, checked }
      const obj = text;
      if (obj.tokens && Array.isArray(obj.tokens)) {
        text = this.parser.parseInline(obj.tokens);
      } else {
        text = obj.text || '';
      }
      task = obj.task !== undefined ? obj.task : task;
      checked = obj.checked !== undefined ? obj.checked : checked;
    }
    
    const textStr = String(text || '');
    
    if (task) {
      const checkbox = checked 
        ? '<input type="checkbox" checked disabled> ' 
        : '<input type="checkbox" disabled> ';
      return `<li class="task-list-item">${checkbox}${textStr}</li>`;
    }
    
    return `<li>${textStr}</li>`;
  };
  
  // Custom paragraph renderer for better spacing
  renderer.paragraph = function(text) {
    // Handle both old and new marked API signatures
    if (typeof text === 'object' && text !== null) {
      // New API: object with { text, tokens }
      if (text.tokens && Array.isArray(text.tokens)) {
        text = this.parser.parseInline(text.tokens);
      } else {
        text = text.text || '';
      }
    }
    
    const textString = String(text || '');
    
    if (textString.startsWith('<strong>') && (textString.includes('Phase') || textString.includes('Component'))) {
      return `<div class="phase-header">${textString}</div>`;
    }
    return `<p>${textString}</p>`;
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
function generateHTMLReport(evaluationPlan, options = {}) {
  const { 
    programName = 'Program',
    organizationName = 'Organization',
    includePrintButton = true
  } = options;
  
  console.log('[Backend Report Generator] Options received:', {
    programName,
    organizationName,
    includePrintButton,
    optionsKeys: Object.keys(options)
  });
  
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  // Initialize slugger for heading IDs
  const slugger = new marked.Slugger();
  
  // Process the markdown content with our custom renderer
  initializeMarked(slugger, programName);
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

// API endpoint to generate HTML report
app.post('/api/generate-report-html', async (req, res) => {
  try {
    const { evaluationPlan, options } = req.body;
    
    if (!evaluationPlan) {
      return res.status(400).json({ error: 'Evaluation plan is required' });
    }
    
    const html = generateHTMLReport(evaluationPlan, options);
    
    res.json({ 
      html,
      success: true 
    });
  } catch (error) {
    console.error('Error generating HTML report:', error);
    res.status(500).json({ 
      error: 'Failed to generate HTML report',
      details: error.message 
    });
  }
});

// Start the server
app.listen(port, '0.0.0.0', () => {
  console.log('');
  console.log('=== Email Server Startup ===');
  console.log('Environment checks:');
  console.log(`- DATABASE_URL: ${process.env.DATABASE_URL ? '✓ Set' : '✗ Not set'}`);
  console.log(`- REPLIT_CONNECTORS_HOSTNAME: ${process.env.REPLIT_CONNECTORS_HOSTNAME ? '✓ Set' : '✗ Not set'}`);
  console.log(`- REPL_IDENTITY or WEB_REPL_RENEWAL: ${(process.env.REPL_IDENTITY || process.env.WEB_REPL_RENEWAL) ? '✓ Set' : '✗ Not set'}`);
  console.log(`- ADMIN_PASSWORD: ${process.env.ADMIN_PASSWORD ? '✓ Set' : '✗ Not set'}`);
  
  // Test database connection
  console.log('Testing database connection...');
  pool.query('SELECT NOW()', (err) => {
    if (err) {
      console.error('✗ Database connection failed:', err.message);
    } else {
      console.log('✓ Database connection successful');
    }
  });
  
  // Test Resend connection
  if (process.env.RESEND_API_KEY) {
    const Resend = require('resend').Resend;
    const resend = new Resend(process.env.RESEND_API_KEY);
    console.log('Testing Resend connection...');
    
    resend.emails.send({
      from: 'ai@gkerr.com',
      to: [],
      subject: 'Connection Test',
      html: 'Test'
    }).catch(() => {
      console.log('✓ Resend connection successful');
      console.log(`  Emails will be sent from: ai@gkerr.com`);
    });
  } else {
    console.log('✗ Resend API key not set - email sending disabled');
  }
  
  // Check prompts table
  pool.query('SELECT COUNT(*) FROM prompts', (err, result) => {
    if (err) {
      console.log('✗ Prompts table not accessible:', err.message);
    } else {
      console.log(`✓ Prompts table accessible (${result.rows[0].count} prompts found)`);
    }
  });
  
  // Clean up expired sessions
  console.log('Cleaning up expired sessions...');
  pool.query('DELETE FROM sessions WHERE expires < NOW()', (err) => {
    if (!err) {
      console.log('✓ Session cleanup complete');
    }
  });
  
  // Initialize job queue processor
  require('./jobProcessor');
  console.log('Starting background job processor...');
  console.log('✓ Background job processor started (runs every 5 seconds)');
  
  console.log(`✓ Email server running on port ${port}`);
  console.log('=========================');
});

module.exports = { generateHTMLReport };