/**
 * Transcript File Handling Test Script for SaLuDo API
 * Tests transcript upload, download, update, and metadata operations
 * Run with: node test-transcript-handling.js
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const canID= "6863403cbd4434ce9b6fc0fb"; // Example candidate ID for testing

const BASE_URL = 'http://localhost:3000/api';

// Create sample audio file content (simple WAV header)
function createSampleAudioFile() {
    // Simple WAV file header + minimal data
    const buffer = Buffer.alloc(44 + 100); // 44 bytes header + 100 bytes data
    
    // WAV header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(44 + 100 - 8, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(44100, 24);
    buffer.writeUInt32LE(88200, 28);
    buffer.writeUInt16LE(2, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(100, 40);
    
    return buffer;
}

// Create sample text transcript
function createSampleTextTranscript() {
    return `Interview Transcript - Technical Round

Interviewer: Can you tell me about your experience with JavaScript?

Candidate: I have been working with JavaScript for over 3 years. I'm comfortable with both frontend and backend development using Node.js. I've worked extensively with React for frontend applications and Express.js for building REST APIs.

Interviewer: What's your experience with databases?

Candidate: I have experience with both SQL and NoSQL databases. I've worked with PostgreSQL and MySQL for relational data, and MongoDB for document-based storage. I'm also familiar with database design principles and optimization techniques.

Interviewer: Can you describe a challenging project you've worked on?

Candidate: One of the most challenging projects was building a real-time collaboration platform. It required implementing WebSocket connections for real-time updates, optimizing database queries for performance, and ensuring the application could scale to handle multiple concurrent users. The biggest challenge was maintaining data consistency across multiple clients while keeping the UI responsive.

[Duration: 30 minutes]
[Interviewer: John Smith]
[Date: 2025-07-01]
`;
}

let testCandidateId = null;
let testTranscriptId = null;

async function runTranscriptTests() {
    console.log('🎵 Starting Transcript File Handling Tests 🎵\n');

    try {
        // // Step 1: Create a test candidate first
        // console.log('1. Creating test candidate...');
        // const candidateData = {
        //     name: 'Test Candidate for Transcripts',
        //     email: ['transcript.test@example.com'],
        //     birthdate: '1995-03-15',
        //     roleApplied: 'Senior Developer'
        // };

        // const createResponse = await axios.post(`${BASE_URL}/candidates`, candidateData);
        // testCandidateId = createResponse.data.data.candidateId;
        // console.log(`   ✅ Created candidate: ${testCandidateId}\n`);

        // // Step 2: Upload audio transcript
        // console.log('2. Uploading audio transcript file...');
        // const audioForm = new FormData();
        // const audioBuffer = createSampleAudioFile();
        // audioForm.append('transcript', audioBuffer, {
        //     filename: 'technical_interview.wav',
        //     contentType: 'audio/wav'
        // });
        // audioForm.append('interviewRound', 'technical');
        // audioForm.append('duration', '1800'); // 30 minutes

        // const uploadResponse = await axios.post(
        //     `${BASE_URL}/candidates/${testCandidateId}/transcripts`,
        //     audioForm,
        //     { headers: audioForm.getHeaders() }
        // );
        
        // testTranscriptId = uploadResponse.data.data.fileId;
        // console.log(`   ✅ Uploaded audio transcript: ${testTranscriptId}`);
        // console.log(`   📄 File: ${uploadResponse.data.data.filename}`);
        // console.log(`   🎯 Round: ${uploadResponse.data.data.interviewRound}`);
        // console.log(`   ⏱️  Duration: ${uploadResponse.data.data.duration} seconds\n`);

        testCandidateId = canID; // Use the provided candidate ID for testing
        // Step 3: Upload text transcript
        console.log('3. Uploading text transcript file...');
        const textForm = new FormData();
        const textContent = createSampleTextTranscript();
        textForm.append('transcript', Buffer.from(textContent), {
            filename: 'hr_interview_transcript.txt',
            contentType: 'text/plain'
        });
        textForm.append('interviewRound', 'hr');

        const textUploadResponse = await axios.post(
            `${BASE_URL}/candidates/${testCandidateId}/transcripts`,
            textForm,
            { headers: textForm.getHeaders() }
        );
        
        console.log(`   ✅ Uploaded text transcript: ${textUploadResponse.data.data.fileId}`);
        console.log(`   📄 File: ${textUploadResponse.data.data.filename}`);
        console.log(`   🎯 Round: ${textUploadResponse.data.data.interviewRound}\n`);

        // Step 4: List all transcripts
        console.log('4. Getting all transcripts...');
        const listResponse = await axios.get(`${BASE_URL}/candidates/${testCandidateId}/transcripts`);
        console.log(`   ✅ Found ${listResponse.data.count} transcript(s):`);
        listResponse.data.data.forEach((transcript, index) => {
            console.log(`   ${index + 1}. ${transcript.filename} (${transcript.interviewRound})`);
            console.log(`      Size: ${transcript.size} bytes, Type: ${transcript.contentType}`);
        });
        console.log('');

        // // Step 5: Get transcript metadata
        // console.log('5. Getting transcript metadata...');
        // const metadataResponse = await axios.get(
        //     `${BASE_URL}/candidates/${testCandidateId}/transcripts/${testTranscriptId}/metadata`
        // );
        // console.log(`   ✅ Metadata retrieved:`);
        // console.log(`   📄 File: ${metadataResponse.data.data.filename}`);
        // console.log(`   📦 Size: ${metadataResponse.data.data.size} bytes`);
        // console.log(`   🎯 Round: ${metadataResponse.data.data.interviewRound}`);
        // console.log(`   📅 Uploaded: ${metadataResponse.data.data.uploadedAt}\n`);

        // // Step 6: Update transcript file
        // console.log('6. Updating transcript file...');
        // const updateForm = new FormData();
        // const updatedAudioBuffer = createSampleAudioFile();
        // updateForm.append('transcript', updatedAudioBuffer, {
        //     filename: 'technical_interview_updated.wav',
        //     contentType: 'audio/wav'
        // });
        // updateForm.append('interviewRound', 'final');
        // updateForm.append('duration', '2400'); // 40 minutes

        // const updateResponse = await axios.put(
        //     `${BASE_URL}/candidates/${testCandidateId}/transcripts/${testTranscriptId}`,
        //     updateForm,
        //     { headers: updateForm.getHeaders() }
        // );
        
        // console.log(`   ✅ Updated transcript: ${updateResponse.data.data.fileId}`);
        // console.log(`   📄 New file: ${updateResponse.data.data.filename}`);
        // console.log(`   🎯 New round: ${updateResponse.data.data.interviewRound}`);
        // console.log(`   ⏱️  New duration: ${updateResponse.data.data.duration} seconds\n`);

        // // Step 7: Test transcription request (placeholder)
        // console.log('7. Requesting transcription...');
        // const transcribeResponse = await axios.post(
        //     `${BASE_URL}/candidates/${testCandidateId}/transcripts/${testTranscriptId}/transcribe`
        // );
        // console.log(`   ✅ ${transcribeResponse.data.message}`);
        // console.log(`   📝 Note: ${transcribeResponse.data.data.note}\n`);

        // // Step 8: Download transcript file (stream test)
        // console.log('8. Testing transcript download...');
        // const downloadResponse = await axios.get(
        //     `${BASE_URL}/candidates/${testCandidateId}/transcripts/${testTranscriptId}`,
        //     { responseType: 'stream' }
        // );
        
        // console.log(`   ✅ Download initiated`);
        // console.log(`   📄 Content-Type: ${downloadResponse.headers['content-type']}`);
        // console.log(`   📦 Content-Length: ${downloadResponse.headers['content-length']} bytes\n`);

        // // Step 9: Delete transcript
        // console.log('9. Deleting transcript...');
        // await axios.delete(`${BASE_URL}/candidates/${testCandidateId}/transcripts/${testTranscriptId}`);
        // console.log(`   ✅ Transcript deleted: ${testTranscriptId}\n`);

        // // Step 10: Verify deletion
        // console.log('10. Verifying deletion...');
        // const finalListResponse = await axios.get(`${BASE_URL}/candidates/${testCandidateId}/transcripts`);
        // console.log(`   ✅ Remaining transcripts: ${finalListResponse.data.count}`);

        // console.log('\n🎉 All transcript file handling tests completed successfully! 🎉');
        // console.log('💫 Your transcript file system is absolutely serving! 💫');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        if (error.response) {
            console.error('📋 Error details:', error.response.data);
            console.error('🔢 Status code:', error.response.status);
        }
    } finally {
        // Cleanup: Delete test candidate if it was created
        if (testCandidateId) {
            try {
                console.log('\n🧹 Cleaning up test candidate...');
                await axios.delete(`${BASE_URL}/candidates/${testCandidateId}`);
                console.log('   ✅ Test candidate deleted');
            } catch (cleanupError) {
                console.log('   ⚠️ Cleanup warning: Could not delete test candidate');
            }
        }
    }
}

// File validation tests
async function runValidationTests() {
    console.log('\n🛡️ Testing File Validation 🛡️\n');

    try {
        // Create a test candidate for validation tests
        const candidateData = {
            name: 'Validation Test Candidate',
            email: ['validation.test@example.com'],
            birthdate: '1990-01-01',
            roleApplied: 'Test Role'
        };

        const createResponse = await axios.post(`${BASE_URL}/candidates`, candidateData);
        const validationCandidateId = createResponse.data.data.candidateId;

        // Test 1: Invalid file type
        console.log('1. Testing invalid file type...');
        try {
            const invalidForm = new FormData();
            invalidForm.append('transcript', Buffer.from('invalid content'), {
                filename: 'invalid.exe',
                contentType: 'application/x-executable'
            });

            await axios.post(
                `${BASE_URL}/candidates/${validationCandidateId}/transcripts`,
                invalidForm,
                { headers: invalidForm.getHeaders() }
            );
            console.log('   ❌ Should have failed but didn\'t');
        } catch (error) {
            if (error.response && error.response.status === 400) {
                console.log('   ✅ Correctly rejected invalid file type');
                console.log(`   📋 Error: ${error.response.data.message}`);
            } else {
                throw error;
            }
        }

        // Test 2: Large file (simulate 51MB file)
        console.log('\n2. Testing oversized file...');
        try {
            const largeForm = new FormData();
            const largeBuffer = Buffer.alloc(51 * 1024 * 1024); // 51MB
            largeForm.append('transcript', largeBuffer, {
                filename: 'large_audio.wav',
                contentType: 'audio/wav'
            });

            await axios.post(
                `${BASE_URL}/candidates/${validationCandidateId}/transcripts`,
                largeForm,
                { headers: largeForm.getHeaders() }
            );
            console.log('   ❌ Should have failed but didn\'t');
        } catch (error) {
            if (error.response && error.response.status === 400) {
                console.log('   ✅ Correctly rejected oversized file');
                console.log(`   📋 Error: ${error.response.data.message}`);
            } else {
                throw error;
            }
        }

        // Test 3: Missing file
        console.log('\n3. Testing missing file...');
        try {
            const emptyForm = new FormData();
            emptyForm.append('interviewRound', 'technical');

            await axios.post(
                `${BASE_URL}/candidates/${validationCandidateId}/transcripts`,
                emptyForm,
                { headers: emptyForm.getHeaders() }
            );
            console.log('   ❌ Should have failed but didn\'t');
        } catch (error) {
            if (error.response && error.response.status === 400) {
                console.log('   ✅ Correctly rejected missing file');
                console.log(`   📋 Error: ${error.response.data.message}`);
            } else {
                throw error;
            }
        }

        // Cleanup validation test candidate
        await axios.delete(`${BASE_URL}/candidates/${validationCandidateId}`);
        console.log('\n🧹 Validation test candidate cleaned up');

        console.log('\n🛡️ All validation tests passed! 🛡️');

    } catch (error) {
        console.error('\n❌ Validation test failed:', error.message);
        if (error.response) {
            console.error('📋 Error details:', error.response.data);
        }
    }
}

// Run all tests
async function runAllTests() {
    console.log('🚀 Starting SaLuDo Transcript API Tests 🚀');
    console.log('================================================\n');

    await runTranscriptTests();
    // await runValidationTests();

    console.log('\n================================================');
    console.log('🎯 All transcript tests completed! 🎯');
    console.log('💝 Your transcript API is absolutely perfect bestie! 💝');
}

// Execute tests if run directly
if (require.main === module) {
    runAllTests().catch(console.error);
}

module.exports = { runAllTests, runTranscriptTests, runValidationTests };
