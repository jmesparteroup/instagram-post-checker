/**
 * Test script for AI-powered Instagram analysis
 * Run with: npm run test:ai
 * 
 * Note: This script tests the AI analysis by making HTTP requests to the API
 * since direct TypeScript imports require a build step.
 */

const http = require('http');

// Mock Instagram post data for testing
const mockPostData = {
  caption: `🔥 Just tried the new Sneak Eats protein bars and they're incredible! The chocolate chip flavor is my absolute favorite. Perfect for post-workout fuel! 💪 

Use my code SAVE20 for 20% off your first order! Link in bio 👆

#ad #sponsored #fitness #protein #postworkout #sneakeats #discount`,
  mediaType: 'image',
  mediaUrl: 'https://example.com/image.jpg',
  transcript: 'Hey everyone! I just tried these amazing new protein bars from Sneak Eats. This is a sponsored post, but I genuinely love these bars. The chocolate chip flavor is incredible and perfect for post-workout fuel. Make sure to use my discount code SAVE20 for twenty percent off your first order. Check the link in my bio for more details!',
  hashtags: ['ad', 'sponsored', 'fitness', 'protein', 'postworkout', 'sneakeats', 'discount'],
  altText: 'Person holding a chocolate chip protein bar with the Sneak Eats logo visible on the packaging'
};

// Test requirements
const testRequirements = [
  'Must include #ad or #sponsored hashtag',
  'Must mention discount code above the fold',
  'Must disclose sponsorship in first 10 seconds of video',
  'Caption must include link in bio reference',
  'Must include fitness-related hashtags'
];

async function testAIAnalysis() {
  console.log('🧪 Testing AI-powered Instagram Analysis\n');
  
  try {
    console.log('📝 Post Data:');
    console.log(`Caption: ${mockPostData.caption.substring(0, 100)}...`);
    console.log(`Media Type: ${mockPostData.mediaType}`);
    console.log(`Hashtags: ${mockPostData.hashtags.map(tag => `#${tag}`).join(' ')}`);
    console.log(`Alt Text: ${mockPostData.altText}`);
    console.log(`Transcript: ${mockPostData.transcript.substring(0, 100)}...\n`);
    
    console.log('📋 Requirements to Check:');
    testRequirements.forEach((req, index) => {
      console.log(`${index + 1}. ${req}`);
    });
    console.log('');
    
    console.log('🤖 Running AI Analysis...\n');
    
    const startTime = Date.now();
    const result = await analyzeContentWithAI(mockPostData, testRequirements);
    const endTime = Date.now();
    
    console.log('✅ Analysis Complete!\n');
    console.log(`⚡ Processing Time: ${endTime - startTime}ms`);
    console.log(`🧠 AI Model: ${result.model}`);
    console.log(`🎯 Overall Score: ${result.overallScore}%`);
    console.log(`🤖 AI Powered: ${result.aiPowered ? 'Yes' : 'No (Fallback)'}\n`);
    
    console.log('📊 Detailed Results:');
    console.log('='.repeat(80));
    
    result.results.forEach((analysis, index) => {
      const status = analysis.passed ? '✅ PASS' : '❌ FAIL';
      const confidence = Math.round(analysis.confidence * 100);
      
      console.log(`\n${index + 1}. ${analysis.requirement}`);
      console.log(`   Status: ${status} (${confidence}% confidence)`);
      console.log(`   Explanation: ${analysis.explanation}`);
      
      if (analysis.evidence && analysis.evidence.length > 0) {
        console.log(`   Evidence: ${analysis.evidence.join(', ')}`);
      }
      
      if (analysis.reasoning) {
        console.log(`   Reasoning: ${analysis.reasoning}`);
      }
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.message.includes('OPENAI_API_KEY')) {
      console.log('\n💡 Tip: Make sure to set your OPENAI_API_KEY in .env.local');
      console.log('   Example: OPENAI_API_KEY=sk-proj-your-key-here');
    }
    
    process.exit(1);
  }
}

// Test cache functionality
async function testCaching() {
  console.log('\n🗄️  Testing Cache Functionality...\n');
  
  try {
    // First request (should hit AI)
    console.log('1️⃣ First request (should use AI):');
    const start1 = Date.now();
    const result1 = await analyzeContentWithAI(mockPostData, testRequirements.slice(0, 2));
    const time1 = Date.now() - start1;
    console.log(`   Time: ${time1}ms, AI Powered: ${result1.aiPowered}`);
    
    // Second identical request (should hit cache)
    console.log('2️⃣ Second identical request (should use cache):');
    const start2 = Date.now();
    const result2 = await analyzeContentWithAI(mockPostData, testRequirements.slice(0, 2));
    const time2 = Date.now() - start2;
    console.log(`   Time: ${time2}ms, AI Powered: ${result2.aiPowered}`);
    
    if (time2 < time1 / 2) {
      console.log('✅ Cache is working! Second request was significantly faster.');
    } else {
      console.log('⚠️  Cache might not be working as expected.');
    }
    
  } catch (error) {
    console.error('❌ Cache test failed:', error.message);
  }
}

// Run tests
async function runAllTests() {
  await testAIAnalysis();
  await testCaching();
}

// Check if running directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { testAIAnalysis, testCaching }; 