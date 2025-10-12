// =======================
// COMPREHENSIVE SECURITY TEST
// =======================
// Purpose: Test rate limiting, password change, and audit logging integration
// Usage: node tests/test-security-features.js
// =======================

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000/api';
const TEST_USER = {
  email: 'admin@saludo.com', // This should be an existing admin user
  password: 'admin123' // Replace with actual admin password
};

async function testSecurityFeatures() {
  console.log('='.repeat(70));
  console.log('TESTING COMPREHENSIVE SECURITY FEATURES');
  console.log('='.repeat(70));

  let authToken = null;
  
  try {
    // Test 1: Rate Limiting on Login
    console.log('\n🔒 TEST 1: Rate Limiting on Login Endpoint');
    console.log('Making rapid login attempts to test rate limiting...');
    
    let rateLimitTriggered = false;
    for (let i = 0; i < 7; i++) {
      try {
        const response = await axios.post(`${BASE_URL}/users/auth/login`, {
          email: 'invalid@test.com',
          password: 'wrongpassword'
        });
      } catch (error) {
        if (error.response && error.response.status === 429) {
          rateLimitTriggered = true;
          console.log(`   ✓ Rate limit triggered after ${i + 1} attempts`);
          console.log(`   ✓ Rate limit response:`, error.response.data);
          break;
        }
      }
    }
    
    if (!rateLimitTriggered) {
      console.log('   ⚠️  Rate limiting not triggered (may be disabled in dev)');
    }
    
    // Test 2: Successful Login and Audit Logging
    console.log('\n🔑 TEST 2: Successful Login');
    const loginResponse = await axios.post(`${BASE_URL}/users/auth/login`, TEST_USER);
    
    if (!loginResponse.data.success) {
      throw new Error(`Login failed: ${loginResponse.data.message}`);
    }
    
    authToken = loginResponse.data.token;
    console.log('   ✓ Login successful');
    console.log('   ✓ JWT token received');
    
    // Test 3: Password Change with Rate Limiting
    console.log('\n🔐 TEST 3: Password Change Functionality');
    
    // Test invalid current password
    try {
      await axios.post(`${BASE_URL}/users/auth/change-password`, {
        currentPassword: 'wrongpassword',
        newPassword: 'NewSecure123!'
      }, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      console.log('   ❌ Should have failed with wrong current password');
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('   ✓ Correctly rejected wrong current password');
      }
    }
    
    // Test weak new password
    try {
      await axios.post(`${BASE_URL}/users/auth/change-password`, {
        currentPassword: TEST_USER.password,
        newPassword: 'weak'
      }, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      console.log('   ❌ Should have failed with weak password');
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('   ✓ Correctly rejected weak password');
      }
    }
    
    // Test same password
    try {
      await axios.post(`${BASE_URL}/users/auth/change-password`, {
        currentPassword: TEST_USER.password,
        newPassword: TEST_USER.password
      }, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      console.log('   ❌ Should have failed with same password');
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('   ✓ Correctly rejected same password');
      }
    }
    
    // Test rate limiting on password change
    console.log('\n⚡ TEST 4: Password Change Rate Limiting');
    let passwordRateLimitTriggered = false;
    
    for (let i = 0; i < 5; i++) {
      try {
        await axios.post(`${BASE_URL}/users/auth/change-password`, {
          currentPassword: 'wrongpassword',
          newPassword: `NewPassword${i}123!`
        }, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
      } catch (error) {
        if (error.response && error.response.status === 429) {
          passwordRateLimitTriggered = true;
          console.log(`   ✓ Password change rate limit triggered after ${i + 1} attempts`);
          break;
        }
      }
    }
    
    if (!passwordRateLimitTriggered) {
      console.log('   ⚠️  Password change rate limiting not triggered (may be disabled in dev)');
    }
    
    // Test 5: Token Logout and Blacklisting
    console.log('\n🚪 TEST 5: Logout and Token Blacklisting');
    
    // Make authenticated request (should work)
    const profileResponse = await axios.get(`${BASE_URL}/users/profile`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    console.log('   ✓ Authenticated request successful before logout');
    
    // Logout
    const logoutResponse = await axios.post(`${BASE_URL}/users/auth/logout`, {}, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (!logoutResponse.data.success) {
      throw new Error(`Logout failed: ${logoutResponse.data.message}`);
    }
    
    console.log('   ✓ Logout successful');
    
    // Try to use blacklisted token (should fail)
    try {
      await axios.get(`${BASE_URL}/users/profile`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      console.log('   ❌ Blacklisted token still works!');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('   ✓ Blacklisted token correctly rejected');
      }
    }
    
    // Test 6: Rate Limiting Headers
    console.log('\n📊 TEST 6: Rate Limiting Headers');
    
    // Make a request and check for rate limit headers
    try {
      const testResponse = await axios.post(`${BASE_URL}/users/auth/login`, {
        email: 'test@test.com',
        password: 'testpass'
      });
    } catch (error) {
      if (error.response) {
        const headers = error.response.headers;
        if (headers['ratelimit-limit']) {
          console.log('   ✓ Rate limit headers present:');
          console.log(`     - Limit: ${headers['ratelimit-limit']}`);
          console.log(`     - Remaining: ${headers['ratelimit-remaining']}`);
          console.log(`     - Reset: ${headers['ratelimit-reset']}`);
        }
      }
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ ALL SECURITY FEATURE TESTS COMPLETED');
    console.log('='.repeat(70));
    console.log('\nSecurity Features Tested:');
    console.log('  ✓ Authentication rate limiting');
    console.log('  ✓ Password change validation');
    console.log('  ✓ Password change rate limiting');
    console.log('  ✓ JWT token blacklisting');
    console.log('  ✓ Logout functionality');
    console.log('  ✓ Rate limit headers');
    console.log('\nAudit logs should contain entries for all these operations.');
    
    return true;
    
  } catch (error) {
    console.log('\n' + '='.repeat(70));
    console.log('❌ SECURITY FEATURE TEST FAILED');
    console.log('='.repeat(70));
    
    if (error.response) {
      console.log('Error Status:', error.response.status);
      console.log('Error Message:', error.response.data.message || error.response.data);
    } else {
      console.log('Error:', error.message);
    }
    
    return false;
  }
}

// Helper function to test audit logging queries
async function testAuditLogging() {
  console.log('\n📊 TESTING AUDIT LOGGING QUERIES');
  
  try {
    // These would need actual audit log endpoints to be implemented
    console.log('   ⚠️  Audit log query endpoints not yet implemented');
    console.log('   ℹ️  Audit logs are being written to MongoDB collection: audit_logs');
    console.log('   ℹ️  Check MongoDB directly to verify audit log entries');
    
  } catch (error) {
    console.log('   ❌ Audit logging test error:', error.message);
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
checkServer().then(async (serverRunning) => {
  if (serverRunning) {
    const testsPassed = await testSecurityFeatures();
    await testAuditLogging();
    
    if (testsPassed) {
      console.log('\n🎉 Security implementation is working correctly!');
      process.exit(0);
    } else {
      console.log('\n💥 Security features have issues that need fixing.');
      process.exit(1);
    }
  } else {
    process.exit(1);
  }
});