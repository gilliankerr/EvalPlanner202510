import React, { useEffect, useState } from 'react';
import { Download, Loader2, CheckCircle, FileText } from 'lucide-react';
import type { ProgramData } from '../App';

interface StepSixProps {
  programData: ProgramData;
  updateProgramData: (data: Partial<ProgramData>) => void;
  onComplete: () => void;
  setIsProcessing: (processing: boolean) => void;
}

const StepSix: React.FC<StepSixProps> = ({ programData, updateProgramData, onComplete, setIsProcessing }) => {
  const [renderStatus, setRenderStatus] = useState<'idle' | 'rendering' | 'complete'>('idle');
  const [htmlContent, setHtmlContent] = useState<string>('');

  useEffect(() => {
    renderHtmlReport();
  }, []);

  const renderHtmlReport = async () => {
    setIsProcessing(true);
    setRenderStatus('rendering');

    // Simulate rendering process
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Convert markdown to HTML with enhanced styling
    const htmlReport = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${programData.organizationName} — ${programData.programName} Evaluation Plan</title>
    <script src="https://cdn.tailwindcss.com"></script>
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
    </style>
</head>
<body class="bg-white">
    <!-- Navigation Header -->
    <nav class="bg-slate-900 text-white px-6 py-4 no-print sticky top-0 z-50">
        <div class="max-w-6xl mx-auto flex items-center justify-between">
            <div class="flex items-center space-x-3">
                <div class="p-2 bg-blue-600 rounded">
                    <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"></path>
                        <path fill-rule="evenodd" d="M4 5a2 2 0 012-2v1a1 1 0 001 1h6a1 1 0 001-1V3a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm8 8v2a1 1 0 11-2 0v-2a1 1 0 112 0zm-6 0v2a1 1 0 11-2 0v-2a1 1 0 112 0z" clip-rule="evenodd"></path>
                    </svg>
                </div>
                <div>
                    <h1 class="text-lg font-semibold">Evaluation Plan Report</h1>
                    <p class="text-sm text-slate-300">${programData.organizationName}</p>
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
                <div class="toc-item"><a href="#program-summary-and-analysis">Program Summary and Analysis</a></div>
                <div class="toc-item"><a href="#summary-of-the-program">Summary of the Program</a></div>
                <div class="toc-item"><a href="#program-overview">Program Overview</a></div>
                <div class="toc-item"><a href="#activities">Activities</a></div>
                <div class="toc-item"><a href="#desired-impact">Desired Impact</a></div>
                <div class="toc-item"><a href="#target-population">Target Population</a></div>
                <div class="toc-item"><a href="#community-context">Community Context</a></div>
                <div class="toc-item"><a href="#evidence-based-program-processes">Evidence-based Program Processes</a></div>
                <div class="toc-item"><a href="#critical-success-factors">Critical Success Factors</a></div>
                <div class="toc-item"><a href="#main-interest-groups">Main Interest Groups</a></div>
                <div class="toc-item"><a href="#potential-program-risks">Potential Program Risks</a></div>
                <div class="toc-item"><a href="#areas-of-evaluation-focus">Areas of Evaluation Focus</a></div>
                <div class="toc-item"><a href="#program-evaluation-plan">Program Evaluation Plan</a></div>
                <div class="toc-item"><a href="#overview">Overview</a></div>
                <div class="toc-item"><a href="#evaluation-objectives">Evaluation Objectives</a></div>
                <div class="toc-item"><a href="#evaluation-questions">Evaluation Questions</a></div>
                <div class="toc-item"><a href="#logic-model">Logic Model</a></div>
                <div class="toc-item"><a href="#evaluation-framework-for-${programData.programName.toLowerCase().replace(/\s+/g, '-')}">Evaluation Framework</a></div>
                <div class="toc-item"><a href="#evaluation-phases-roles-and-agendas">Implementation Phases</a></div>
            </nav>
        </aside>

        <!-- Main Content -->
        <main class="flex-1 p-6">
            <div class="max-w-none">
                ${convertMarkdownToHtml(programData.evaluationPlan)}
            </div>
        </main>
    </div>

    <!-- Footer -->
    <footer class="bg-slate-900 text-white mt-16">
        <div class="max-w-6xl mx-auto px-6 py-8">
            <div class="text-center">
                <p class="text-slate-400 mb-2">
                    Generated by LogicalOutcomes Evaluation Planner
                </p>
                <p class="text-sm text-slate-500">
                    AI-enhanced evaluation planning for nonprofit organizations • ${new Date().toLocaleDateString()}
                </p>
            </div>
        </div>
    </footer>

    <script>
        // Smooth scrolling for navigation links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const targetId = this.getAttribute('href');
                const target = document.querySelector(targetId);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } else {
                    console.log('Target not found:', targetId);
                }
            });
        });

        // Debug: Log all headings and their IDs
        document.addEventListener('DOMContentLoaded', function() {
            console.log('Available headings:');
            document.querySelectorAll('h1, h2, h3').forEach(heading => {
                console.log('ID:', heading.id, 'Text:', heading.textContent);
            });
        });
    </script>
</body>
</html>
    `;

    setHtmlContent(htmlReport);
    setRenderStatus('complete');
    setIsProcessing(false);
    onComplete();
  };

  const convertMarkdownToHtml = (markdown: string): string => {
    let html = markdown;
    
    // Step 1: Handle the main title specially
    html = html.replace(/^#\s*(.+?)\s*—\s*(.+?)\s*Draft Evaluation Plan$/gm, (match, org, program) => {
      return `<h1>${org} — ${program} Draft Evaluation Plan</h1>`;
    });
    
    // Handle the subtitle line
    html = html.replace(/^Created on (.+?) by LogicalOutcomes Evaluation Planner$/gm, (match, date) => {
      return `<p class="subtitle">Created on ${date} by LogicalOutcomes Evaluation Planner</p>`;
    });
    
    // Step 2: Convert other headers with proper IDs
    html = html.replace(/^#\s*(.+)$/gm, (match, title) => {
      const id = title.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/^-+|-+$/g, '');
      return `<h1 id="${id}">${title}</h1>`;
    });
    
    html = html.replace(/^##\s*(.+)$/gm, (match, title) => {
      const id = title.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/^-+|-+$/g, '');
      return `<div class="content-section"><h2 id="${id}">${title}</h2>`;
    });
    
    html = html.replace(/^###\s*(.+)$/gm, (match, title) => {
      const id = title.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/^-+|-+$/g, '');
      return `<h3 id="${id}">${title}</h3>`;
    });
    
    html = html.replace(/^####\s*(.+)$/gm, (match, title) => {
      const id = title.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/^-+|-+$/g, '');
      return `<h4 id="${id}">${title}</h4>`;
    });
    
    // Step 3: Convert links - handle markdown links with or without spaces
    html = html.replace(/\[([^\]]+)\]\s*\(([^)]+)\)/g, (match, text, url) => {
      return `<a href="${url}" class="text-blue-600 hover:underline" target="_blank">${text}</a>`;
    });
    
    // Step 4: Convert bold and italic
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // Step 5: Convert bullet points to HTML lists
    const lines = html.split('\n');
    const processedLines = [];
    let inList = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check for bullet points
      if (line.match(/^[•\-\*]\s+(.+)$/)) {
        if (!inList) {
          processedLines.push('<ul>');
          inList = true;
        }
        const content = line.replace(/^[•\-\*]\s+/, '');
        processedLines.push(`<li>${content}</li>`);
      } else if (line.match(/^\d+\.\s+(.+)$/)) {
        // Numbered lists
        if (!inList) {
          processedLines.push('<ol>');
          inList = true;
        }
        const content = line.replace(/^\d+\.\s+/, '');
        processedLines.push(`<li>${content}</li>`);
      } else {
        if (inList) {
          processedLines.push('</ul>');
          inList = false;
        }
        processedLines.push(lines[i]); // Keep original line with spacing
      }
    }
    
    if (inList) {
      processedLines.push('</ul>');
    }
    
    html = processedLines.join('\n');
    
    // Step 6: Handle tables with better formatting
    html = html.replace(/\|(.+)\|\n\|[-\s|]+\|\n((?:\|.+\|\n?)*)/g, (match, headerRow, bodyRows) => {
      const headers = headerRow.split('|')
        .filter(h => h.trim())
        .map(h => `<th>${h.trim()}</th>`)
        .join('');
      
      const rows = bodyRows.split('\n')
        .filter(row => row.trim() && row.includes('|'))
        .map(row => {
          const cells = row.split('|')
            .filter(c => c.trim())
            .map(c => `<td>${c.trim()}</td>`)
            .join('');
          return `<tr>${cells}</tr>`;
        }).join('');
      
      return `</div><table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table><div class="content-section">`;
    });
    
    // Step 7: Handle the introduction section specially
    html = html.replace(/(This evaluation plan is designed to be a living document[\s\S]*?Consensus.*?\.\s*)/g, 
      '<div class="intro-section">$1</div>');
    
    // Step 8: Convert paragraphs
    const paragraphs = html.split('\n\n');
    html = paragraphs.map(paragraph => {
      const trimmed = paragraph.trim();
      if (trimmed && 
          !trimmed.startsWith('<h') && 
          !trimmed.startsWith('<table') && 
          !trimmed.startsWith('<ul') &&
          !trimmed.startsWith('<ol') && 
          !trimmed.startsWith('<li') &&
          !trimmed.startsWith('<div') &&
          !trimmed.includes('<h1') &&
          !trimmed.includes('<h2') &&
          !trimmed.includes('<h3') &&
          !trimmed.includes('<h4')) {
        return `<p>${trimmed}</p>`;
      }
      return trimmed;
    }).join('\n\n');
    
    // Step 9: Close any open content sections
    html = html.replace(/<div class="content-section">(?![\s\S]*<\/div>)[\s\S]*$/g, (match) => {
      return match + '</div>';
    });
    
    // Step 10: Clean up
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/\n{3,}/g, '\n\n');
    html = html.replace(/<\/div>\s*<div class="content-section">/g, '');
    
    return html;
  };

  const downloadHtml = () => {
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${programData.organizationName}-${programData.programName}-Evaluation-Plan.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Download className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">HTML Report Generation</h2>
            <p className="text-slate-600">Creating beautifully formatted HTML report for your evaluation plan</p>
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
                    <span>Download HTML</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Report Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 text-center">
                <FileText className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-slate-900">{Math.ceil(htmlContent.length / 5000)}</div>
                <div className="text-sm text-slate-600">Pages (est.)</div>
              </div>
              
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 text-center">
                <div className="text-2xl font-bold text-slate-900">{programData.evaluationPlan.split('#').length - 1}</div>
                <div className="text-sm text-slate-600">Sections</div>
              </div>
              
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 text-center">
                <div className="text-2xl font-bold text-slate-900">{Math.ceil(programData.evaluationPlan.length / 100)}</div>
                <div className="text-sm text-slate-600">Words (est.)</div>
              </div>
              
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 text-center">
                <div className="text-2xl font-bold text-slate-900">✓</div>
                <div className="text-sm text-slate-600">Print Ready</div>
              </div>
            </div>

            {/* Report Features */}
            <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
              <h4 className="text-lg font-semibold text-slate-900 mb-4">Report Features</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                  <span className="text-sm text-slate-700">Professional formatting and styling</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                  <span className="text-sm text-slate-700">Responsive design for all devices</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                  <span className="text-sm text-slate-700">Interactive table of contents</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                  <span className="text-sm text-slate-700">Print-optimized layout</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                  <span className="text-sm text-slate-700">Embedded navigation and branding</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                  <span className="text-sm text-slate-700">Self-contained HTML file</span>
                </div>
              </div>
            </div>

            {/* Next Steps */}
            <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
              <h4 className="text-lg font-semibold text-slate-900 mb-3">Next Steps</h4>
              <div className="space-y-2 text-sm text-slate-700">
                <div>1. <strong>Review the evaluation plan</strong> with your team and stakeholders</div>
                <div>2. <strong>Customize sections</strong> as needed for your specific context</div>
                <div>3. <strong>Engage evaluation advisory committee</strong> to refine objectives and methods</div>
                <div>4. <strong>Develop data collection tools</strong> based on the evaluation framework</div>
                <div>5. <strong>Begin implementation</strong> following the phases outlined in the plan</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default StepSix;