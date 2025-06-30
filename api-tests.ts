import { Request, Response } from 'express';

// Test data for API endpoints
export const testData = {
    // Sample candidate data
    sampleCandidate: {
        name: "John Doe",
        email: ["john.doe@example.com", "john@personal.com"],
        birthdate: "1990-05-15",
        roleApplied: "Full Stack Developer"
    },

    // Sample skill data
    sampleSkill: {
        name: "JavaScript",
        level: 8,
        category: "Programming Language"
    },

    // Sample experience data
    sampleExperience: {
        company: "Tech Solutions Inc",
        position: "Software Engineer",
        startDate: "2021-01-15",
        endDate: "2023-12-30",
        description: "Developed and maintained web applications using React and Node.js"
    },

    // Sample education data
    sampleEducation: {
        institution: "University of Technology",
        degree: "Bachelor of Computer Science",
        startDate: "2016-09-01",
        endDate: "2020-06-30",
        description: "Computer Science with specialization in Software Engineering"
    },

    // Sample certification data
    sampleCertification: {
        name: "AWS Solutions Architect Associate",
        issuedBy: "Amazon Web Services",
        dateIssued: "2023-06-15",
        expiryDate: "2026-06-15",
        credentialId: "AWS-SAA-123456789"
    },

    // Sample strength data
    sampleStrength: {
        type: "strength",
        description: "Excellent problem-solving abilities",
        category: "Technical"
    },

    // Sample weakness data
    sampleWeakness: {
        type: "weakness", 
        description: "Sometimes perfectionist which can slow down delivery",
        category: "Personal"
    }
};

// API endpoint testing functions
export const apiTests = {
    // Test GET /api/candidates
    testGetAllCandidates: async (baseUrl: string) => {
        try {
            const response = await fetch(`${baseUrl}/api/candidates`);
            const data = await response.json();
            console.log('✅ GET /api/candidates:', data);
            return data;
        } catch (error) {
            console.error('❌ GET /api/candidates failed:', error);
        }
    },

    // Test POST /api/candidates
    testCreateCandidate: async (baseUrl: string) => {
        try {
            const response = await fetch(`${baseUrl}/api/candidates`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(testData.sampleCandidate)
            });
            const data = await response.json();
            console.log('✅ POST /api/candidates:', data);
            return data;
        } catch (error) {
            console.error('❌ POST /api/candidates failed:', error);
        }
    },

    // Test GET /api/candidates/:id
    testGetCandidate: async (baseUrl: string, candidateId: string) => {
        try {
            const response = await fetch(`${baseUrl}/api/candidates/${candidateId}`);
            const data = await response.json();
            console.log(`✅ GET /api/candidates/${candidateId}:`, data);
            return data;
        } catch (error) {
            console.error(`❌ GET /api/candidates/${candidateId} failed:`, error);
        }
    },

    // Test POST /api/candidates/:candidateId/skills
    testAddSkill: async (baseUrl: string, candidateId: string) => {
        try {
            const response = await fetch(`${baseUrl}/api/candidates/${candidateId}/skills`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(testData.sampleSkill)
            });
            const data = await response.json();
            console.log(`✅ POST /api/candidates/${candidateId}/skills:`, data);
            return data;
        } catch (error) {
            console.error(`❌ POST /api/candidates/${candidateId}/skills failed:`, error);
        }
    },

    // Test GET /api/candidates/:candidateId/skills
    testGetSkills: async (baseUrl: string, candidateId: string) => {
        try {
            const response = await fetch(`${baseUrl}/api/candidates/${candidateId}/skills`);
            const data = await response.json();
            console.log(`✅ GET /api/candidates/${candidateId}/skills:`, data);
            return data;
        } catch (error) {
            console.error(`❌ GET /api/candidates/${candidateId}/skills failed:`, error);
        }
    },

    // Run all tests in sequence
    runAllTests: async (baseUrl: string = 'http://localhost:3000') => {
        console.log('🚀 Starting API Tests...\n');

        // Test creating a candidate
        const createResult = await apiTests.testCreateCandidate(baseUrl);
        if (!createResult?.data?.candidateId) {
            console.error('❌ Cannot continue tests - candidate creation failed');
            return;
        }

        const candidateId = createResult.data.candidateId;
        console.log(`📝 Using candidate ID: ${candidateId}\n`);

        // Test getting all candidates
        await apiTests.testGetAllCandidates(baseUrl);

        // Test getting specific candidate
        await apiTests.testGetCandidate(baseUrl, candidateId);

        // Test adding a skill
        await apiTests.testAddSkill(baseUrl, candidateId);

        // Test getting skills
        await apiTests.testGetSkills(baseUrl, candidateId);

        console.log('\n✨ API Tests completed!');
    }
};

// Usage example:
// apiTests.runAllTests('http://localhost:3000');
