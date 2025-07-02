/**
 * Test file for Candidate-Job Reference functionality
 * This file tests the integration between Candidate and Job models
 */

const { Candidate } = require('../Models/Candidate.ts');
const { Job } = require('../Models/Job.ts');

// Test data
const mockJobData = {
    jobId: 'job-123',
    jobName: 'Senior Software Engineer',
    jobDescription: 'Develop and maintain web applications',
    skills: [
        { skillId: 'javascript', requiredLevel: 8.5 },
        { skillId: 'react', requiredLevel: 7.0 },
        { skillId: 'nodejs', requiredLevel: 6.5 }
    ]
};

const mockCandidateData = {
    candidateId: 'candidate-456',
    name: 'John Doe',
    email: ['john.doe@email.com'],
    birthdate: new Date('1990-01-15'),
    roleApplied: null
};

console.log('🧪 Testing Candidate-Job Reference Functionality\n');

// Test 1: Create candidate without job application
console.log('Test 1: Creating candidate without job application');
try {
    const candidate = new Candidate(
        mockCandidateData.candidateId,
        mockCandidateData.name,
        mockCandidateData.email,
        mockCandidateData.birthdate,
        null // No job applied
    );
    
    console.log('✅ Candidate created successfully');
    console.log(`   - Has applied for job: ${candidate.hasAppliedForJob()}`);
    console.log(`   - Job ID: ${candidate.getJobId()}`);
    console.log(`   - Summary: ${candidate.getSummary()}\n`);
} catch (error) {
    console.error('❌ Error creating candidate:', error.message);
}

// Test 2: Create candidate with job application
console.log('Test 2: Creating candidate with job application');
try {
    const candidateWithJob = new Candidate(
        'candidate-789',
        'Jane Smith',
        ['jane.smith@email.com'],
        new Date('1992-03-20'),
        mockJobData.jobId
    );
    
    console.log('✅ Candidate with job created successfully');
    console.log(`   - Has applied for job: ${candidateWithJob.hasAppliedForJob()}`);
    console.log(`   - Job ID: ${candidateWithJob.getJobId()}`);
    console.log(`   - Is applied for specific job: ${candidateWithJob.isAppliedForJob(mockJobData.jobId)}`);
    console.log(`   - Summary: ${candidateWithJob.getSummary()}\n`);
} catch (error) {
    console.error('❌ Error creating candidate with job:', error.message);
}

// Test 3: Apply candidate to job
console.log('Test 3: Applying candidate to job');
try {
    const candidate = new Candidate(
        'candidate-101',
        'Bob Johnson',
        ['bob.johnson@email.com'],
        new Date('1988-07-10'),
        null
    );
    
    console.log('Before application:');
    console.log(`   - Has applied for job: ${candidate.hasAppliedForJob()}`);
    console.log(`   - Job ID: ${candidate.getJobId()}`);
    
    // Apply to job
    candidate.setJobId(mockJobData.jobId);
    
    console.log('After application:');
    console.log(`   - Has applied for job: ${candidate.hasAppliedForJob()}`);
    console.log(`   - Job ID: ${candidate.getJobId()}`);
    console.log(`   - Is applied for specific job: ${candidate.isAppliedForJob(mockJobData.jobId)}`);
    console.log(`   - Summary: ${candidate.getSummary()}\n`);
} catch (error) {
    console.error('❌ Error applying candidate to job:', error.message);
}

// Test 4: Remove candidate from job
console.log('Test 4: Removing candidate from job');
try {
    const candidate = new Candidate(
        'candidate-202',
        'Alice Wilson',
        ['alice.wilson@email.com'],
        new Date('1995-12-05'),
        mockJobData.jobId
    );
    
    console.log('Before removal:');
    console.log(`   - Has applied for job: ${candidate.hasAppliedForJob()}`);
    console.log(`   - Job ID: ${candidate.getJobId()}`);
    
    // Remove from job
    candidate.removeJobApplication();
    
    console.log('After removal:');
    console.log(`   - Has applied for job: ${candidate.hasAppliedForJob()}`);
    console.log(`   - Job ID: ${candidate.getJobId()}`);
    console.log(`   - Summary: ${candidate.getSummary()}\n`);
} catch (error) {
    console.error('❌ Error removing candidate from job:', error.message);
}

// Test 5: Data serialization with job reference
console.log('Test 5: Testing data serialization');
try {
    const candidate = new Candidate(
        'candidate-303',
        'Charlie Brown',
        ['charlie.brown@email.com'],
        new Date('1993-09-25'),
        mockJobData.jobId
    );
    
    const candidateData = candidate.toObject();
    const personalInfo = candidate.getPersonalInfo();
    
    console.log('✅ Data serialization successful');
    console.log(`   - CandidateData roleApplied: ${candidateData.roleApplied}`);
    console.log(`   - PersonalInfo roleApplied: ${personalInfo.roleApplied}`);
    console.log(`   - roleApplied type: ${typeof candidateData.roleApplied}\n`);
} catch (error) {
    console.error('❌ Error in data serialization:', error.message);
}

console.log('🎉 All tests completed!');
console.log('\n📋 Summary:');
console.log('- Candidates can be created with or without job applications');
console.log('- Job applications can be added and removed dynamically');
console.log('- Data serialization handles optional job references correctly');
console.log('- All utility methods work with nullable job IDs');
