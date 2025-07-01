/**
 * Simple test script to verify the skills implementation
 * Run with: node test-skills.js
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

async function testSkillsAPI() {
    console.log('🧪 Testing Skills API Implementation...\n');

    try {
        // Test 1: Search for skills in master database
        console.log('1. Testing skill search...');
        try {
            const searchResponse = await axios.get(`${BASE_URL}/skills/search/javascript`);
            console.log('✅ Skill search successful:', searchResponse.data);
        } catch (error) {
            console.log('⚠️ Skill search (expected if no skills exist):', error.response?.data || error.message);
        }

        // Test 2: Add a skill to a candidate (assuming candidate exists)
        console.log('\n2. Testing add skill to candidate...');
        const candidateId = 'test-candidate-123'; // Replace with actual candidate ID
        
        try {
            const addSkillResponse = await axios.post(`${BASE_URL}/candidates/${candidateId}/skills`, {
                skillName: 'JavaScript',
                score: 8,
                evidence: 'Built multiple React applications',
                addedBy: 'HUMAN'
            });
            console.log('✅ Add skill successful:', addSkillResponse.data);
        } catch (error) {
            console.log('⚠️ Add skill failed (expected if candidate doesn\'t exist):', error.response?.data || error.message);
        }

        // Test 3: Get candidate skills
        console.log('\n3. Testing get candidate skills...');
        try {
            const getSkillsResponse = await axios.get(`${BASE_URL}/candidates/${candidateId}/skills`);
            console.log('✅ Get skills successful:', getSkillsResponse.data);
        } catch (error) {
            console.log('⚠️ Get skills failed:', error.response?.data || error.message);
        }

        // Test 4: Bulk add skills
        console.log('\n4. Testing bulk add skills...');
        try {
            const bulkSkillsResponse = await axios.post(`${BASE_URL}/candidates/${candidateId}/skills/bulk`, {
                skills: [
                    { skillName: 'TypeScript', score: 7, evidence: 'Used in backend development', addedBy: 'HUMAN' },
                    { skillName: 'Node.js', score: 9, evidence: 'Primary backend technology', addedBy: 'HUMAN' },
                    { skillName: 'MongoDB', score: 6, evidence: 'Database for several projects', addedBy: 'HUMAN' }
                ]
            });
            console.log('✅ Bulk add skills successful:', bulkSkillsResponse.data);
        } catch (error) {
            console.log('⚠️ Bulk add skills failed:', error.response?.data || error.message);
        }

    } catch (error) {
        console.error('❌ Test setup failed:', error.message);
    }

    console.log('\n🏁 Testing complete!');
    console.log('\n📝 Notes:');
    console.log('- Some tests may fail if no candidates exist in the database');
    console.log('- Create a candidate first using the candidates API');
    console.log('- Skills will be automatically added to the master database');
}

// Run the tests
testSkillsAPI();
