// =======================
// LOGOUT FUNCTIONALITY TEST
// =======================
// Purpose: Test JWT token blacklisting and logout endpoint
// Usage: node tests/test-logout-functionality.js
// =======================

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000/api';
const TEST_USER = {
  email: 'admin@saludo.com', // This should be an existing admin user
  password: 'admin123' // Replace with actual admin password
};

async function testLogoutFunctionality() {
  console.log('='.repeat(60));
  console.log('TESTING LOGOUT FUNCTIONALITY');
  console.log('='.repeat(60));

  let authToken = null;
  
  try {
    // Step 1: Login to get a JWT token
    console.log('\n1. Logging in to get JWT token...');
    const loginResponse = await axios.post(`${BASE_URL}/users/auth/login`, TEST_USER);
    
    if (!loginResponse.data.success) {
      throw new Error(`Login failed: ${loginResponse.data.message}`);
    }
    
    authToken = loginResponse.data.token;
    console.log('   ✓ Login successful');
    console.log(`   ✓ Token received: ${authToken.substring(0, 20)}...`);
    
    // Step 2: Make an authenticated request to verify token works
    console.log('\n2. Testing token with authenticated request...');
    const profileResponse = await axios.get(`${BASE_URL}/users/profile`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    console.log('   ✓ Token works - authenticated request successful');
    console.log(`   ✓ User profile: ${profileResponse.data.user.email}`);
    
    // Step 3: Logout (blacklist the token)
    console.log('\n3. Logging out (blacklisting token)...');
    const logoutResponse = await axios.post(`${BASE_URL}/users/auth/logout`, {}, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (!logoutResponse.data.success) {
      throw new Error(`Logout failed: ${logoutResponse.data.message}`);
    }
    
    console.log('   ✓ Logout successful');
    console.log(`   ✓ Message: ${logoutResponse.data.message}`);
    
    // Step 4: Try to use the blacklisted token (should fail)
    console.log('\n4. Testing blacklisted token (should fail)...');
    try {
      await axios.get(`${BASE_URL}/users/profile`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      // If we reach here, the test failed
      console.log('   ❌ FAILED: Blacklisted token still works!');
      return false;
      
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('   ✓ Blacklisted token correctly rejected');
        console.log(`   ✓ Error message: ${error.response.data.message}`);
      } else {
        throw error;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✓ ALL LOGOUT TESTS PASSED');
    console.log('='.repeat(60));
    return true;
    
  } catch (error) {
    console.log('\n' + '='.repeat(60));
    console.log('❌ LOGOUT TEST FAILED');
    console.log('='.repeat(60));
    
    if (error.response) {
      console.log('Error Status:', error.response.status);
      console.log('Error Message:', error.response.data.message || error.response.data);
    } else {
      console.log('Error:', error.message);
    }
    
    return false;
  }
}

// Helper function to test multiple logout scenarios
async function testLogoutScenarios() {
  console.log('\n' + '='.repeat(60));
  console.log('TESTING LOGOUT EDGE CASES');
  console.log('='.repeat(60));
  
  try {
    // Test logout without token
    console.log('\n1. Testing logout without token...');
    try {
      await axios.post(`${BASE_URL}/users/auth/logout`);
      console.log('   ❌ Should have failed without token');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('   ✓ Correctly rejected request without token');
      }
    }
    
    // Test logout with invalid token
    console.log('\n2. Testing logout with invalid token...');
    try {
      await axios.post(`${BASE_URL}/users/auth/logout`, {}, {
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      });
      console.log('   ❌ Should have failed with invalid token');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('   ✓ Correctly rejected invalid token');
      }
    }
    
  } catch (error) {
    console.log('Edge case testing error:', error.message);
  }
}

// Run the tests
async function runTests() {
  const basicTestPassed = await testLogoutFunctionality();
  await testLogoutScenarios();
  
  if (basicTestPassed) {
    console.log('\n🎉 Logout functionality is working correctly!');
    process.exit(0);
  } else {
    console.log('\n💥 Logout functionality has issues that need fixing.');
    process.exit(1);
  }
}

// Check if server is running
async function checkServer() {
  try {
    await axios.get(`${BASE_URL}/users`);
    return true;
  } catch (error) {
    console.log('❌ Server is not running or not accessible.');
    console.log('   Please start the server first: npm start');
    return false;
  }
}

// Main execution
checkServer().then(serverRunning => {
  if (serverRunning) {
    runTests();
  } else {
    process.exit(1);
  }
});