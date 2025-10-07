// Test script to verify report generation works with the fixed table renderer
const { generateFullHtmlDocument } = require('./reportGeneratorServer.cjs');

// Test evaluation plan with tables
const testEvaluationPlan = `
# Evaluation Plan for Test Organization

## Executive Summary
This is a test evaluation plan to verify report generation.

## Timeline Table

| Phase | Timeline | Activities |
|-------|----------|------------|
| Phase 1 | Month 1-3 | Initial setup and baseline data collection |
| Phase 2 | Month 4-6 | Implementation and monitoring |
| Phase 3 | Month 7-9 | Data analysis and reporting |

## Stakeholder Table

| Stakeholder | Role | Responsibility |
|-------------|------|----------------|
| Program Manager | Lead | Overall coordination |
| Evaluator | Support | Data collection and analysis |
| Participants | Beneficiaries | Provide feedback |

## Logic Model Table

| Inputs | Activities | Outputs | Outcomes | Impact |
|--------|------------|---------|----------|--------|
| Funding | Training sessions | 100 participants trained | Increased knowledge | Community improvement |
| Staff time | Workshops | 20 workshops delivered | Skill development | Economic growth |

## Metrics Table

| Metric | Target | Data Source | Frequency |
|--------|--------|-------------|-----------|
| Participation rate | 80% | Attendance records | Monthly |
| Satisfaction score | 4.5/5 | Surveys | Quarterly |

## Conclusion
This test demonstrates that tables are properly rendered in the evaluation report.
`;

// Test data
const testOrgData = {
  organizationName: 'Test Organization',
  programName: 'Test Program',
  programDescription: 'A test program for report generation',
  webUrls: ['https://example.com'],
  additionalUrls: [],
  scrapedData: [],
  prompt1Output: 'Test prompt 1 output',
  prompt2Output: 'Test prompt 2 output',
  prompt3Output: 'Test prompt 3 output',
  prompt4Output: 'Test prompt 4 output',
  prompt5Output: 'Test prompt 5 output'
};

// Generate report
try {
  console.log('Generating test report...');
  const htmlReport = generateFullHtmlDocument(testEvaluationPlan, testOrgData);
  
  // Check if report contains expected content
  const hasContent = htmlReport.includes('Timeline Table') && 
                     htmlReport.includes('Stakeholder Table') &&
                     htmlReport.includes('Logic Model Table') &&
                     htmlReport.includes('Metrics Table') &&
                     htmlReport.includes('table-wrapper');
  
  if (hasContent) {
    console.log('✅ Report generated successfully!');
    console.log('✅ Tables are properly rendered');
    console.log('Report length:', htmlReport.length, 'characters');
    
    // Check for proper table class assignment
    if (htmlReport.includes('timeline-table')) {
      console.log('✅ Timeline table class detected');
    }
    if (htmlReport.includes('stakeholder-table')) {
      console.log('✅ Stakeholder table class detected');
    }
    if (htmlReport.includes('logic-model-table')) {
      console.log('✅ Logic model table class detected');
    }
    if (htmlReport.includes('metrics-table')) {
      console.log('✅ Metrics table class detected');
    }
  } else {
    console.log('❌ Report is missing expected content');
  }
  
} catch (error) {
  console.error('❌ Error generating report:', error);
  console.error('Stack trace:', error.stack);
}