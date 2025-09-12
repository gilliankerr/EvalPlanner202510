import React, { useEffect, useState, useCallback } from 'react';
import { Download, Loader2, CheckCircle } from 'lucide-react';
import { marked, Tokens } from 'marked';
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';
import type { ProgramData } from '../App';

interface StepSixProps {
  programData: ProgramData;
  updateProgramData: (data: Partial<ProgramData>) => void;
  onComplete: () => void;
  setIsProcessing: (processing: boolean) => void;
}

const StepSix: React.FC<StepSixProps> = ({ programData, onComplete, setIsProcessing }) => {
  const [renderStatus, setRenderStatus] = useState<'idle' | 'rendering' | 'complete'>('idle');
  const [htmlContent, setHtmlContent] = useState<string>('');

  useEffect(() => {
    renderHtmlReport();
  }, []);

  // Detect table type for enhanced styling
  const detectTableType = useCallback((headerText: string): string => {
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
  }, []);

  // Detect if table represents a logic model
  const isLogicModelTable = useCallback((headerText: string): boolean => {
    const header = headerText.toLowerCase();
    const logicModelKeywords = ['inputs', 'activities', 'outputs', 'outcomes', 'impact'];
    return logicModelKeywords.some(keyword => header.includes(keyword));
  }, []);

  // Generate SVG flowchart for logic models with fixed IDs
  const generateLogicModelSVG = useCallback((headerHtml: string, bodyHtml: string): string => {
    // Generate consistent unique ID for this SVG
    const uid = Date.now();
    
    // Parse table data from HTML
    const headerCells = headerHtml.match(/<th[^>]*>([^<]*)<\/th>/g) || [];
    const headers = headerCells.map(cell => cell.replace(/<\/?th[^>]*>/g, '').trim());
    
    const bodyRows = bodyHtml.match(/<tr[^>]*>.*?<\/tr>/gs) || [];
    const data = bodyRows.map(row => {
      const cells = row.match(/<td[^>]*>([^<]*)<\/td>/g) || [];
      return cells.map(cell => cell.replace(/<\/?td[^>]*>/g, '').trim());
    });

    // Calculate SVG dimensions
    const width = Math.max(800, headers.length * 150);
    const height = 300;
    const boxWidth = 120;
    const boxHeight = 80;
    const spacing = Math.max(20, (width - (headers.length * boxWidth)) / (headers.length + 1));
    
    let svg = `
    <figure class="logic-model-diagram">
      <h4>Logic Model Visualization</h4>
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="logic-model-svg">
        <defs>
          <linearGradient id="boxGradient-${uid}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#f8fafc;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#e2e8f0;stop-opacity:1" />
          </linearGradient>
          <filter id="shadow-${uid}" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.1)"/>
          </filter>
          <marker id="arrowhead-${uid}" markerWidth="10" markerHeight="7" 
                  refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
          </marker>
        </defs>
    `;

    // Draw boxes and arrows
    headers.forEach((header, index) => {
      const x = spacing + (index * (boxWidth + spacing));
      const y = 50;
      
      // Escape header text for SVG
      const escapedHeader = header.replace(/[<>&"']/g, (char) => {
        const escapeMap: { [key: string]: string } = {
          '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#x27;'
        };
        return escapeMap[char] || char;
      });
      
      // Draw box
      svg += `
        <rect x="${x}" y="${y}" width="${boxWidth}" height="${boxHeight}" 
              rx="8" fill="url(#boxGradient-${uid})" stroke="#cbd5e1" stroke-width="2" 
              filter="url(#shadow-${uid})"/>
        <text x="${x + boxWidth/2}" y="${y + 25}" text-anchor="middle" 
              font-weight="600" font-size="14" fill="#1e293b">${escapedHeader}</text>
      `;
      
      // Add content if available
      if (data[0] && data[0][index]) {
        const content = data[0][index].substring(0, 30) + (data[0][index].length > 30 ? '...' : '');
        const escapedContent = content.replace(/[<>&"']/g, (char) => {
          const escapeMap: { [key: string]: string } = {
            '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#x27;'
          };
          return escapeMap[char] || char;
        });
        
        svg += `
          <text x="${x + boxWidth/2}" y="${y + 45}" text-anchor="middle" 
                font-size="11" fill="#64748b">${escapedContent}</text>
        `;
      }
      
      // Draw arrow to next box
      if (index < headers.length - 1) {
        const arrowStartX = x + boxWidth;
        const arrowEndX = x + boxWidth + spacing;
        const arrowY = y + boxHeight/2;
        
        svg += `
          <line x1="${arrowStartX}" y1="${arrowY}" x2="${arrowEndX}" y2="${arrowY}" 
                stroke="#3b82f6" stroke-width="2" marker-end="url(#arrowhead-${uid})"/>
        `;
      }
    });
    
    svg += '</svg></figure>';
    return svg;
  }, []);


  // Post-process HTML to properly close section tags
  const postProcessHTML = useCallback((html: string): string => {
    // Close any unclosed section tags before new sections or end of content
    let processed = html.replace(/<section class="content-section"><h2([^>]*)>([^<]*)<\/h2>/g, 
      '</section><section class="content-section"><h2$1>$2</h2>');
    
    // Remove the first closing section tag if it appears at the beginning
    processed = processed.replace(/^<\/section>/, '');
    
    // Add closing section tag at the end if we have any sections
    if (processed.includes('<section class="content-section">')) {
      processed += '</section>';
    }
    
    return processed;
  }, []);

  // Shared slugger for consistent ID generation - use manual implementation
  const slugger = React.useMemo(() => {
    const slugs: { [key: string]: number } = {};
    return {
      reset: () => {
        Object.keys(slugs).forEach(key => delete slugs[key]);
      },
      slug: (text: string): string => {
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
  }, []);
  
  // Initialize marked with custom renderer and options (memoized)
  const initializeMarked = React.useCallback(() => {
    // Reset slugger for fresh ID generation
    slugger.reset();
    
    // Create custom renderer for enhanced features
    const renderer = new marked.Renderer();

    // Custom heading renderer with IDs - preserves inline formatting
    renderer.heading = function(token: Tokens.Heading) {
      const text = this.parser.parseInline(token.tokens);
      const rawText = token.tokens.map(t => t.type === 'text' ? (t as Tokens.Text).text : '').join('');
      const level = token.depth;
      const id = slugger.slug(rawText);
      
      // Add content-section wrapper for h2 elements
      if (level === 2) {
        return `<section class="content-section"><h2 id="${id}">${text}</h2>`;
      }
      
      return `<h${level} id="${id}">${text}</h${level}>`;
    };

    // Enhanced table renderer with logic model detection - preserves inline formatting
    renderer.table = function(token: Tokens.Table) {
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
      
      // Detect logic model tables (use raw text for detection)
      const headerRawText = token.header.map(cell => 
        cell.tokens.map(t => t.type === 'text' ? (t as Tokens.Text).text : '').join('')
      ).join(' ');
      
      if (isLogicModelTable(headerRawText)) {
        return generateLogicModelSVG(header, body);
      }
      
      // Detect table type for styling
      const tableClass = detectTableType(headerRawText);
      
      return `<table class="${tableClass}"><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
    };

    // Enhanced paragraph renderer with callout detection - preserves inline formatting
    renderer.paragraph = function(token: Tokens.Paragraph) {
      const text = this.parser.parseInline(token.tokens);
      const rawText = token.tokens.map(t => {
        if (t.type === 'text') return (t as Tokens.Text).text;
        if (t.type === 'strong') return (t as Tokens.Strong).tokens.map(st => st.type === 'text' ? (st as Tokens.Text).text : '').join('');
        return '';
      }).join('');
      
      // Detect callouts and special sections using raw text
      // Removed intro-section formatting for first paragraph
      
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

    // Enhanced list renderer - preserves inline formatting
    renderer.list = function(token: Tokens.List) {
      const tag = token.ordered ? 'ol' : 'ul';
      const body = token.items.map(item => {
        const itemContent = item.tokens.map(t => {
          if (t.type === 'text') return this.parser.parseInline([t]);
          if (t.type === 'paragraph') return this.parser.parseInline((t as Tokens.Paragraph).tokens);
          if (t.type === 'list') return this.list(t as Tokens.List);
          return '';
        }).join('');
        return `<li>${itemContent}</li>`;
      }).join('');
      return `<${tag}>${body}</${tag}>`;
    };

    // Code block renderer with syntax highlighting
    renderer.code = function(token: Tokens.Code) {
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

    // Configure marked with custom renderer
    marked.use({ 
      renderer,
      breaks: true,
      gfm: true
    });
  }, [slugger, detectTableType, isLogicModelTable, generateLogicModelSVG]);

  // Convert markdown to HTML using initialized marked with security
  const convertMarkdownToHtml = useCallback((markdown: string): string => {
    try {
      // Initialize marked with custom renderer
      initializeMarked();
      
      // Convert markdown to HTML
      const rawHtml = marked.parse(markdown) as string;
      
      // Post-process HTML for section closures
      const processedHtml = postProcessHTML(rawHtml);
      
      // Sanitize HTML for security
      const sanitizedHtml = DOMPurify.sanitize(processedHtml, {
        ALLOWED_TAGS: [
          'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'span', 'a', 'ul', 'ol', 'li',
          'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption', 'strong', 'em', 'code',
          'pre', 'blockquote', 'br', 'hr', 'img', 'figure', 'figcaption', 'section',
          'svg', 'rect', 'text', 'line', 'polygon', 'defs', 'linearGradient', 'stop',
          'filter', 'feDropShadow', 'marker'
        ],
        ALLOWED_ATTR: [
          'id', 'class', 'href', 'title', 'alt', 'src', 'width', 'height', 'viewBox',
          'x', 'y', 'x1', 'y1', 'x2', 'y2', 'rx', 'fill', 'stroke', 'stroke-width',
          'text-anchor', 'font-weight', 'font-size', 'marker-end', 'points', 'offset',
          'style', 'stop-color', 'stop-opacity', 'dx', 'dy', 'stdDeviation', 'flood-color',
          'markerWidth', 'markerHeight', 'refX', 'refY', 'orient'
        ],
        ALLOW_DATA_ATTR: false
      });
      
      return sanitizedHtml;
    } catch (error) {
      console.error('Error converting markdown to HTML:', error);
      return `<div class="error-message">Error processing evaluation plan content. Please try regenerating the plan.</div>`;
    }
  }, [initializeMarked, postProcessHTML]);

  // Generate table of contents from markdown headings
  const generateTOC = useCallback((markdown: string): string => {
    try {
      // Reset slugger to match heading rendering
      slugger.reset();
      
      const tokens = marked.lexer(markdown);
      const tocItems: string[] = [];
      
      tokens.forEach(token => {
        if (token.type === 'heading' && (token as Tokens.Heading).depth <= 3) {
          const headingToken = token as Tokens.Heading;
          const rawText = headingToken.tokens
            .map(t => t.type === 'text' ? (t as Tokens.Text).text : '')
            .join('');
          const id = slugger.slug(rawText);
          const level = headingToken.depth;
          const indent = level === 1 ? '' : level === 2 ? 'ml-2' : 'ml-4';
          
          // Sanitize display text
          const displayText = DOMPurify.sanitize(rawText, { ALLOWED_TAGS: [] });
          
          tocItems.push(`<div class="toc-item ${indent}"><a href="#${id}">${displayText}</a></div>`);
        }
      });
      
      return tocItems.join('');
    } catch (error) {
      console.error('Error generating TOC:', error);
      return '<div class="error-message">Error generating table of contents</div>';
    }
  }, [slugger]);

  const renderHtmlReport = async () => {
    setIsProcessing(true);
    setRenderStatus('rendering');

    // Simulate rendering process
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      // Generate table of contents first
      const tocHtml = generateTOC(programData.evaluationPlan);
      
      // Convert markdown content 
      const contentHtml = convertMarkdownToHtml(programData.evaluationPlan);
      
      // Create complete HTML report with sanitized content
      const htmlReport = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${DOMPurify.sanitize(programData.organizationName)} — ${DOMPurify.sanitize(programData.programName)} Evaluation Plan</title>
    <style>
        @media print {
            .no-print { display: none; }
            .page-break { page-break-before: always; }
        }
        
        /* Typography System */
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #1e293b;
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
        }
        
        tbody tr:hover {
            background-color: #f8fafc;
            transition: background-color 0.15s ease;
        }
        
        tbody tr:last-child td {
            border-bottom: none;
        }
        
        /* Alternating row colors for better readability */
        tbody tr:nth-child(even) {
            background-color: #fafbfc;
        }
        
        tbody tr:nth-child(even):hover {
            background-color: #f1f5f9;
        }

        /* Table captions */
        caption {
            caption-side: top;
            padding: 1rem 0;
            font-weight: 600;
            color: #1e293b;
            font-size: 1.1rem;
        }

        /* Introduction section styling */
        .intro-section {
            background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
            padding: 2rem;
            border-radius: 12px;
            margin: 2rem 0;
            border-left: 4px solid #0ea5e9;
        }

        /* Content sections */
        .content-section {
            margin: 3rem 0;
            padding: 0 1rem;
        }

        /* Responsive design */
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
        
        .toc-item:hover {
            background-color: #f1f5f9;
            transform: translateX(4px);
        }
        
        .toc-item a {
            color: #475569;
            text-decoration: none;
            font-weight: 500;
        }
        
        .toc-item a:hover {
            color: #2563eb;
        }
        
        .highlight-box {
            background: #eff6ff;
            border-left: 4px solid #2563eb;
            padding: 1.5rem;
            margin: 1.5rem 0;
            border-radius: 0 8px 8px 0;
        }
        
        .warning-box {
            background: #fffbeb;
            border-left: 4px solid #d97706;
            padding: 1.5rem;
            margin: 1.5rem 0;
            border-radius: 0 8px 8px 0;
        }
        
        /* Syntax Highlighting Styles */
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
        
        /* Logic Model Diagram Styles */
        .logic-model-diagram {
            margin: 3rem 0;
            padding: 2rem;
            background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
            border-radius: 12px;
            border: 1px solid #0ea5e9;
            text-align: center;
        }
        
        .logic-model-diagram h4 {
            color: #0c4a6e;
            margin-bottom: 1.5rem;
            font-size: 1.25rem;
            font-weight: 600;
        }
        
        .logic-model-svg {
            max-width: 100%;
            height: auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
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
        
        /* Enhanced Callout Boxes */
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
        
        /* Error message styling */
        .error-message {
            background: #fee2e2;
            border: 1px solid #fca5a5;
            color: #dc2626;
            padding: 1rem;
            border-radius: 8px;
            margin: 1rem 0;
        }
        
        /* Responsive Improvements */
        @media (max-width: 768px) {
            .logic-model-diagram {
                padding: 1rem;
                margin: 2rem 0;
            }
            
            .logic-model-svg {
                width: 100%;
                height: auto;
            }
            
            /* Enhanced table responsive design */
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
    </style>
</head>
<body class="bg-white">
    <!-- Navigation Header -->
    <nav class="bg-slate-900 text-white px-6 py-4 no-print sticky top-0 z-50">
        <div class="max-w-6xl mx-auto flex items-center justify-between">
            <div class="flex items-center space-x-3">
                <div>
                    <h1 class="text-lg font-semibold">Evaluation Plan Report</h1>
                    <p class="text-sm text-slate-300">${DOMPurify.sanitize(programData.organizationName)}</p>
                </div>
            </div>
            <div class="flex items-center space-x-4">
                <button onclick="window.print()" class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm font-medium transition-colors">
                    Print / Save PDF
                </button>
            </div>
        </div>
    </nav>

    <!-- Table of Contents Sidebar -->
    <div class="flex max-w-6xl mx-auto">
        <aside class="w-64 bg-slate-50 min-h-screen p-6 no-print">
            <h3 class="font-semibold text-slate-900 mb-4">Table of Contents</h3>
            <nav class="space-y-1 text-sm">
                ${tocHtml}
            </nav>
        </aside>

        <!-- Main Content -->
        <main class="flex-1 p-6">
            <div class="max-w-none">
                ${contentHtml}
            </div>
        </main>
    </div>

    <!-- Footer -->
    <footer class="bg-slate-900 text-white mt-16">
        <div class="max-w-6xl mx-auto px-6 py-8">
            <div class="text-center">
                <!-- Footer content removed -->
            </div>
        </div>
    </footer>
</body>
</html>
      `;

      setHtmlContent(htmlReport);
      setRenderStatus('complete');
      setIsProcessing(false);
      onComplete();
    } catch (error) {
      console.error('Error rendering HTML report:', error);
      setRenderStatus('idle');
      setIsProcessing(false);
      alert('Failed to render HTML report. Please try again.');
    }
  };

  // Download HTML functionality
  const downloadHtml = useCallback(() => {
    try {
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${programData.organizationName}_${programData.programName}_Evaluation_Plan.html`.replace(/[^a-zA-Z0-9._-]/g, '_');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading HTML:', error);
      alert('Failed to download HTML file. Please try again.');
    }
  }, [htmlContent, programData.organizationName, programData.programName]);

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Download className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Document Generation</h2>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Status Card */}
        <div className={`p-6 rounded-lg border ${
          renderStatus === 'rendering' ? 'bg-blue-50 border-blue-200' :
          renderStatus === 'complete' ? 'bg-green-50 border-green-200' :
          'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center space-x-3">
            {renderStatus === 'rendering' && <Loader2 className="h-6 w-6 animate-spin text-blue-600" />}
            {renderStatus === 'complete' && <CheckCircle className="h-6 w-6 text-green-600" />}
            
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                {renderStatus === 'rendering' && 'Rendering HTML Report...'}
                {renderStatus === 'complete' && 'HTML Report Ready'}
                {renderStatus === 'idle' && 'Preparing HTML Render...'}
              </h3>
              <p className="text-slate-600">
                {renderStatus === 'rendering' && 'Converting evaluation plan to beautifully formatted HTML document'}
                {renderStatus === 'complete' && 'Your evaluation plan has been formatted as a professional HTML report'}
                {renderStatus === 'idle' && 'Setting up HTML rendering process'}
              </p>
            </div>
          </div>
        </div>

        {/* Success Actions */}
        {renderStatus === 'complete' && (
          <>
            <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6 border border-green-200">
              <div className="text-center">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  Evaluation Plan Complete!
                </h3>
                <p className="text-slate-600 mb-6">
                  Your comprehensive evaluation plan for {programData.programName} has been successfully generated 
                  and formatted as a professional HTML document.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    onClick={downloadHtml}
                    className="flex items-center justify-center space-x-2 px-8 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-200"
                  >
                    <Download className="h-5 w-5" />
                    <span>Download Evaluation Plan</span>
                  </button>
                </div>
              </div>
            </div>

          </>
        )}
      </div>
    </div>
  );
};

export default StepSix;