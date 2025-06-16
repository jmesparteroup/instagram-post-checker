/**
 * Simple test script for AI-powered Instagram analysis
 * Tests the API endpoint with mock data
 * 
 * Prerequisites: 
 * 1. Start the dev server: npm run dev
 * 2. Set OPENAI_API_KEY in .env.local
 * 3. Run this test: node test-ai-simple.js
 */

async function testAIAnalysis() {
  console.log('🧪 Testing AI-powered Instagram Analysis API\n');
  
  const testData = {
    postUrl: 'https://instagram.com/p/test', // This will use mock data
    requirements: `Must include #ad or #sponsored hashtag
Must mention discount code above the fold
Caption must include link in bio reference
Must include fitness-related hashtags`,
    useAI: true
  };

  try {
    console.log('📋 Test Requirements:');
    testData.requirements.split('\n').forEach((req, index) => {
      console.log(`${index + 1}. ${req}`);
    });
    console.log('');

    console.log('🚀 Making API request...\n');
    
    const response = await fetch('http://localhost:3000/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    console.log('✅ Analysis Complete!\n');
    console.log(`🧠 AI Model: ${result.analysis.model}`);
    console.log(`🎯 Overall Score: ${result.analysis.overallScore}%`);
    console.log(`🤖 AI Powered: ${result.analysis.aiPowered ? 'Yes' : 'No (Fallback)'}`);
    console.log(`⚡ Processing Time: ${result.analysis.processingTime}ms\n`);
    
    console.log('📝 Post Data Used:');
    console.log(`Caption: ${result.postData.caption.substring(0, 100)}...`);
    console.log(`Media Type: ${result.postData.mediaType}\n`);
    
    console.log('📊 Detailed Results:');
    console.log('='.repeat(80));
    
    result.analysis.results.forEach((analysis, index) => {
      const status = analysis.passed ? '✅ PASS' : '❌ FAIL';
      const confidence = analysis.confidence ? Math.round(analysis.confidence * 100) + '%' : 'N/A';
      
      console.log(`\n${index + 1}. ${analysis.requirement}`);
      console.log(`   Status: ${status} (Confidence: ${confidence})`);
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
    
    // Test cache functionality
    console.log('\n🗄️  Testing Cache...');
    const start2 = Date.now();
    const response2 = await fetch('http://localhost:3000/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });
    
    const result2 = await response2.json();
    const time2 = Date.now() - start2;
    
    console.log(`Second request time: ${time2}ms`);
    if (time2 < 500) {
      console.log('✅ Cache appears to be working (fast response)');
    } else {
      console.log('⚠️  Cache might not be working (slow response)');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Make sure the development server is running:');
      console.log('   npm run dev');
    }
    
    if (error.message.includes('OPENAI_API_KEY')) {
      console.log('\n💡 Make sure to set your OPENAI_API_KEY in .env.local');
    }
    
    process.exit(1);
  }
}

// Test cache stats endpoint
async function testCacheStats() {
  console.log('\n📊 Testing Cache Stats API...');
  
  try {
    const response = await fetch('http://localhost:3000/api/cache-stats');
    const stats = await response.json();
    
    console.log('Cache Statistics:');
    console.log(`- Total Entries: ${stats.cache.totalEntries}`);
    console.log(`- Active Entries: ${stats.cache.activeEntries}`);
    console.log(`- Hit Rate: ${stats.cache.hitRate}%`);
    console.log(`- Utilization: ${stats.cache.utilizationRate}%`);
    
  } catch (error) {
    console.log('⚠️  Cache stats endpoint not available:', error.message);
  }
}

// Run tests
async function runAllTests() {
  await testAIAnalysis();
  await testCacheStats();
}

if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { testAIAnalysis, testCacheStats }; 