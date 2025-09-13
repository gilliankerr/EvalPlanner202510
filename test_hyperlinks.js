// Test Feature 2: Hyperlink Rendering with actual marked.js library
const { marked } = require('marked');

console.log('🧪 Testing Feature 2: Hyperlink Rendering with Actual Libraries');
console.log('=============================================================');

// Test markdown content from the actual application template
const testMarkdown = `This plan does not include citations or research references. It is based on the [LogicalOutcomes Evaluation Planning Handbook](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4815131) by Gillian Kerr and Sophie Llewelyn, which describes a structured process that relies on general evidence about effective nonprofit programs, supported by an in-depth web search. 

We recommend that users also carry out a literature review to check that the evaluation plan is supported by peer-reviewed evidence in research journals. Our current recommended AI literature search tools are [Undermind](https://www.undermind.ai/) followed by [FutureHouse Falcon](https://platform.futurehouse.org/) and [Consensus](https://consensus.app/).`;

// Configure marked exactly like the application does
marked.setOptions({
  breaks: true,
  gfm: true
});

try {
  // Generate HTML like StepSix does
  const htmlOutput = marked.parse(testMarkdown);
  console.log('✅ Markdown parsing successful');
  
  // Test for proper link rendering
  const expectedLinks = [
    { text: 'LogicalOutcomes Evaluation Planning Handbook', url: 'https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4815131' },
    { text: 'Undermind', url: 'https://www.undermind.ai/' },
    { text: 'FutureHouse Falcon', url: 'https://platform.futurehouse.org/' },
    { text: 'Consensus', url: 'https://consensus.app/' }
  ];
  
  let allLinksFound = true;
  console.log('\n🔗 Checking hyperlink rendering:');
  
  expectedLinks.forEach((link, index) => {
    // Simple check for link presence in HTML
    const hasLink = htmlOutput.includes(`href="${link.url}"`) && htmlOutput.includes(`>${link.text}</a>`);
    console.log(`   ${index + 1}. ${hasLink ? '✅' : '❌'} "${link.text}" → ${link.url}`);
    if (!hasLink) allLinksFound = false;
  });
  
  // Check for raw URLs (should be none)
  const rawUrlPattern = /\(https?:\/\/[^)]+\)/g;
  const rawUrls = htmlOutput.match(rawUrlPattern);
  
  if (rawUrls && rawUrls.length > 0) {
    console.log(`\n❌ Found ${rawUrls.length} raw URLs that should be converted to links:`);
    rawUrls.forEach(url => console.log(`   - ${url}`));
    allLinksFound = false;
  } else {
    console.log('\n✅ No raw URLs found - all properly converted to links');
  }
  
  // Show sample of generated HTML
  console.log('\n📄 Generated HTML Sample:');
  console.log('---------------------------');
  console.log(htmlOutput.substring(0, 400) + '...');
  
  console.log(`\n🎯 Feature 2 Test Result: ${allLinksFound ? '✅ PASSED' : '❌ FAILED'}`);
  
  process.exit(allLinksFound ? 0 : 1);
  
} catch (error) {
  console.error('❌ Test failed with error:', error.message);
  process.exit(1);
}