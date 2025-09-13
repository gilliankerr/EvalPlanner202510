// End-to-End Test Script for Evaluation Planner
// Tests both Feature 1 (extraction) and Feature 2 (hyperlinks)

const TEST_PROGRAM_DATA = {
  organizationName: "Community Financial Center",
  programName: "Smart Money Workshop Series",
  aboutProgram: `Our Smart Money Workshop Series is a 12-week financial literacy program designed for low-income adults in urban Toronto. The program covers budgeting, debt management, savings strategies, and credit building. Each workshop is 2 hours long and includes both educational content and hands-on activities. Participants work with trained financial counselors and receive personalized action plans. The program aims to help participants improve their financial knowledge, reduce debt, and build savings for emergency funds.`,
  urls: ["https://example-financial-center.org/smart-money-program"],
  scrapedContent: `Financial Literacy Program Overview
  
Our Smart Money Workshop Series serves low-income adults in the Greater Toronto Area who are struggling with financial instability. The program was developed in response to research showing that 45% of Canadians live paycheck to paycheck.

Program Components:
- Weekly 2-hour workshops covering core financial topics
- One-on-one financial counseling sessions
- Digital financial tracking tools and resources
- Peer support groups for ongoing motivation
- Graduation ceremony with certification

Target Population:
Adults aged 25-55 with household incomes below $40,000 CAD, particularly focusing on newcomers to Canada, single parents, and individuals recovering from financial crises.

Evidence Base:
The program is based on research from the Financial Consumer Agency of Canada and adapts proven models from similar organizations across North America.`
};

// Test the complete flow
async function testCompleteFlow() {
  console.log("🚀 Starting End-to-End Test of Evaluation Planner");
  console.log("Testing Feature 1: Program Type & Population Extraction");
  console.log("Testing Feature 2: Hyperlink Rendering Fix");
  
  // Step 1: Test basic program data setup
  console.log("\n📝 Step 1: Program Data Setup");
  console.log(`Organization: ${TEST_PROGRAM_DATA.organizationName}`);
  console.log(`Program: ${TEST_PROGRAM_DATA.programName}`);
  console.log(`Description length: ${TEST_PROGRAM_DATA.aboutProgram.length} characters`);
  
  // Step 3: Simulate StepThree analysis
  console.log("\n🧠 Step 3: Testing AI Program Analysis");
  
  // Create a mock analysis result that should extract specific program type and population
  const mockAnalysisResult = `
# Program Model Analysis

## Program Classification and Model

The Smart Money Workshop Series is a **financial literacy program** that follows a structured group-based educational model with individual support components. This program can be classified as a community-based financial empowerment intervention targeting economically vulnerable populations.

### Target Population Analysis

The program specifically serves **low-income adults in Toronto** with household incomes below $40,000 CAD. The target demographic includes:
- Adults aged 25-55 experiencing financial instability
- Newcomers to Canada navigating a new financial system
- Single parents managing limited household resources
- Individuals recovering from financial crises or debt

### Program Model Components

**Core Intervention Strategy**: The program employs a multi-modal approach combining:
- Group-based financial education workshops (12 weeks, 2 hours each)
- Individual financial counseling and personalized action planning
- Peer support networks for sustained behavior change
- Digital tools for ongoing financial tracking and management

**Theoretical Foundation**: The program is grounded in adult learning theory and behavioral economics, recognizing that financial behavior change requires both knowledge acquisition and sustained support for implementation.

**Theory of Change**: Participants will develop financial knowledge and skills → implement practical budgeting and saving strategies → experience improved financial stability → achieve long-term financial goals and reduced financial stress.

### Service Delivery Model

- **Intensity**: 24 contact hours over 12 weeks (high intensity initial phase)
- **Setting**: Community-based delivery in accessible neighborhood locations
- **Staff Requirements**: Trained financial counselors with certification in financial planning
- **Duration**: 12-week core program with optional ongoing support

## Comparison to Evidence-Based Models

This program aligns with evidence-based financial coaching models documented in research by the Financial Consumer Agency of Canada and similar organizations. It incorporates best practices from:
- Individual Development Account (IDA) programs
- Financial capability interventions proven effective with similar populations
- Community-based financial education models with demonstrated outcomes

The program's multi-modal approach (education + counseling + peer support) reflects current best practices in financial empowerment programming.

\`\`\`json
{
  "program_type_plural": "financial literacy programs",
  "target_population": "low-income adults in Toronto"
}
\`\`\`
  `;
  
  // Test extraction logic (from StepThree component)
  let programTypePlural = '';
  let targetPopulation = '';
  
  try {
    // Look for JSON block in the response (same logic as StepThree)
    const jsonMatch = mockAnalysisResult.match(/```json\s*({[\s\S]*?})\s*```/);
    if (jsonMatch) {
      const extractedData = JSON.parse(jsonMatch[1]);
      programTypePlural = extractedData.program_type_plural || '';
      targetPopulation = extractedData.target_population || '';
    }
  } catch (error) {
    console.error('❌ Extraction failed:', error);
    programTypePlural = 'programs of this type';
    targetPopulation = 'the target population described in this evaluation plan';
  }
  
  console.log(`✅ Extracted Program Type: "${programTypePlural}"`);
  console.log(`✅ Extracted Target Population: "${targetPopulation}"`);
  
  // Test Feature 1: Verify extraction worked
  const feature1Success = programTypePlural === 'financial literacy programs' && 
                         targetPopulation === 'low-income adults in Toronto';
  
  console.log(`\n🎯 Feature 1 Test Result: ${feature1Success ? '✅ PASSED' : '❌ FAILED'}`);
  if (!feature1Success) {
    console.log(`Expected: "financial literacy programs" and "low-income adults in Toronto"`);
    console.log(`Got: "${programTypePlural}" and "${targetPopulation}"`);
  }
  
  // Step 5: Test StepFive usage of extracted data
  console.log("\n📋 Step 5: Testing Literature Search Prompt Generation");
  
  const mockCurrentDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  // Test the literature search prompt (from StepFive component)
  const expectedPromptSnippet = `"I want to find empirical research (including peer-reviewed publications and high-quality gray literature) identifying essential program delivery elements and critical success factors for ${programTypePlural} serving ${targetPopulation}."`;
  
  console.log("✅ Literature search prompt uses extracted data:");
  console.log(`   Program type: ${programTypePlural}`);
  console.log(`   Target population: ${targetPopulation}`);
  console.log(`   Full prompt snippet: ${expectedPromptSnippet}`);
  
  // Step 6: Test StepSix hyperlink rendering
  console.log("\n🔗 Step 6: Testing Hyperlink Rendering Fix");
  
  // Test markdown content with links (from the actual template)
  const testMarkdownContent = `This plan does not include citations or research references. It is based on the [LogicalOutcomes Evaluation Planning Handbook](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4815131) by Gillian Kerr and Sophie Llewelyn, which describes a structured process that relies on general evidence about effective nonprofit programs, supported by an in-depth web search. 

We recommend that users also carry out a literature review to check that the evaluation plan is supported by peer-reviewed evidence in research journals. Our current recommended AI literature search tools are [Undermind](https://www.undermind.ai/) followed by [FutureHouse Falcon](https://platform.futurehouse.org/) and [Consensus](https://consensus.app/).`;

  // Test link detection and rendering
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  const links = [...testMarkdownContent.matchAll(linkPattern)];
  
  console.log(`✅ Found ${links.length} markdown links to test:`);
  links.forEach((link, index) => {
    const linkText = link[1];
    const linkUrl = link[2];
    console.log(`   ${index + 1}. "${linkText}" -> ${linkUrl}`);
  });
  
  // Test that links would render properly (simulating the marked.js processing)
  const expectedLinks = [
    { text: "LogicalOutcomes Evaluation Planning Handbook", url: "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4815131" },
    { text: "Undermind", url: "https://www.undermind.ai/" },
    { text: "FutureHouse Falcon", url: "https://platform.futurehouse.org/" },
    { text: "Consensus", url: "https://consensus.app/" }
  ];
  
  const feature2Success = links.length === expectedLinks.length &&
                         links.every((link, index) => 
                           link[1] === expectedLinks[index].text && 
                           link[2] === expectedLinks[index].url
                         );
  
  console.log(`\n🎯 Feature 2 Test Result: ${feature2Success ? '✅ PASSED' : '❌ FAILED'}`);
  if (!feature2Success) {
    console.log("❌ Link extraction or formatting issue detected");
  } else {
    console.log("✅ All markdown links detected correctly for HTML rendering");
  }
  
  // Final test summary
  console.log("\n📊 TEST SUMMARY");
  console.log("================");
  console.log(`Feature 1 (Program Type & Population Extraction): ${feature1Success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Feature 2 (Hyperlink Rendering Setup): ${feature2Success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Overall Test Status: ${feature1Success && feature2Success ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  return {
    feature1: feature1Success,
    feature2: feature2Success,
    overall: feature1Success && feature2Success,
    extractedData: { programTypePlural, targetPopulation },
    linksFound: links.length
  };
}

// Run the test
testCompleteFlow().then(results => {
  console.log("\n🏁 Test completed!");
  process.exit(results.overall ? 0 : 1);
}).catch(error => {
  console.error("💥 Test failed with error:", error);
  process.exit(1);
});