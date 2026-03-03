// Test script to verify backend API endpoints
// Run with: node test-api.js

const API_URL = process.env.API_URL || 'https://storybit-backend.onrender.com';

async function testProcessTopic() {
  console.log('\n=== Testing Process Topic API ===');
  console.log('Backend URL:', `${API_URL}/process-topic`);
  
  try {
    const startTime = Date.now();
    
    const response = await fetch(`${API_URL}/process-topic`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ topic: 'Flying Cars' }),
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\nResponse Status:', response.status, response.statusText);
    console.log('Response Time:', elapsed, 'seconds');
    console.log('Response Headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('\n❌ ERROR Response:', errorText);
      console.error('\nStatus Code:', response.status);
      return { success: false, status: response.status, error: errorText };
    }

    const data = await response.json();
    console.log('\n✅ SUCCESS Response:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.ideas && Array.isArray(data.ideas)) {
      console.log(`\n✅ Received ${data.ideas.length} ideas`);
      if (data.descriptions && Array.isArray(data.descriptions)) {
        console.log(`✅ Received ${data.descriptions.length} descriptions`);
      }
    }
    
    return { success: true, status: response.status, data };
  } catch (error) {
    console.error('\n❌ Network/Request Error:');
    console.error('Error Type:', error.name);
    console.error('Error Message:', error.message);
    console.error('Full Error:', error);
    
    if (error.message.includes('fetch')) {
      console.error('\n💡 This might be a network connectivity issue or the backend server is down.');
    }
    
    return { success: false, error: error.message };
  }
}

async function testGenerateScript() {
  console.log('\n\n=== Testing Generate Script API ===');
  console.log('Backend URL:', `${API_URL}/generate-script`);
  
  try {
    const startTime = Date.now();
    
    const testParams = {
      topic: 'Flying Cars',
      emotional_tone: 'excited',
      creator_type: 'tech reviewer',
      audience_description: 'technology enthusiasts',
      accent: 'neutral',
      duration_minutes: 10,
      script_structure: 'narrative'
    };
    
    const response = await fetch(`${API_URL}/generate-script`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(testParams),
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\nResponse Status:', response.status, response.statusText);
    console.log('Response Time:', elapsed, 'seconds');
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('\n❌ ERROR Response:', errorText);
      return { success: false, status: response.status, error: errorText };
    }

    const data = await response.json();
    console.log('\n✅ SUCCESS Response received');
    console.log('Script length:', data.script ? data.script.length : 0, 'characters');
    console.log('Estimated word count:', data.estimated_word_count || 'N/A');
    
    return { success: true, status: response.status, data };
  } catch (error) {
    console.error('\n❌ Network/Request Error:');
    console.error('Error Type:', error.name);
    console.error('Error Message:', error.message);
    
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🔍 Backend API Test Suite');
  console.log('========================');
  console.log('Base API URL:', API_URL);
  console.log('Environment:', process.env.NODE_ENV || 'development');
  
  const results = {
    processTopic: await testProcessTopic(),
    generateScript: await testGenerateScript(),
  };
  
  console.log('\n\n=== Test Summary ===');
  console.log('Process Topic:', results.processTopic.success ? '✅ PASSED' : '❌ FAILED');
  console.log('Generate Script:', results.generateScript.success ? '✅ PASSED' : '❌ FAILED');
  
  if (!results.processTopic.success || !results.generateScript.success) {
    console.log('\n⚠️  Some tests failed. Check the errors above.');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
