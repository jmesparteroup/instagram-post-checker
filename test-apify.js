/**
 * Simple test script to demonstrate Apify Instagram scraping
 * 
 * Usage:
 * 1. Set APIFY_API_KEY environment variable
 * 2. Run: node test-apify.js
 * 
 * This script will test the Instagram service with a real Instagram URL
 */

const { getInstagramPostData } = require('./src/lib/instagram-service.ts');

async function testApifyIntegration() {
  console.log('🧪 Testing Apify Instagram Integration...\n');

  // Test URLs (you can replace these with any public Instagram post/reel URLs)
  const testUrls = [
    'https://www.instagram.com/p/C7xBALsvCAi/',
    'https://www.instagram.com/reel/DDIJAfeyemG/',
  ];

  for (const url of testUrls) {
    console.log(`📱 Testing URL: ${url}`);
    
    try {
      const startTime = Date.now();
      const result = await getInstagramPostData(url);
      const endTime = Date.now();
      
      console.log('✅ Success!');
      console.log(`⏱️  Time taken: ${endTime - startTime}ms`);
      console.log(`📝 Caption length: ${result.caption.length} characters`);
      console.log(`🎬 Media type: ${result.mediaType}`);
      console.log(`🔗 Media URL: ${result.mediaUrl ? 'Available' : 'Not available'}`);
      console.log(`🎙️  Transcript length: ${result.transcript.length} characters`);
      
      // Show first 100 characters of caption
      if (result.caption) {
        console.log(`📄 Caption preview: "${result.caption.substring(0, 100)}..."`);
      }
      
      console.log('---\n');
      
    } catch (error) {
      console.log('❌ Error:', error.message);
      console.log('---\n');
    }
  }

  console.log('🏁 Test completed!');
  console.log('\n💡 Tips:');
  console.log('- If you see "falling back to mock data", make sure APIFY_API_KEY is set');
  console.log('- Get your API key from: https://console.apify.com/account/integrations');
  console.log('- The first run might be slower as Apify initializes the scraper');
}

// Run the test
testApifyIntegration().catch(console.error); 