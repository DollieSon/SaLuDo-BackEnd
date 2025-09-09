// Test file for candidate comparison feature
// Run this with: node test-candidate-comparison.js

const BASE_URL = "http://localhost:3000/api";

async function testCandidateComparison() {
  try {
    console.log("🧪 Testing Candidate Comparison Feature...\n");

    // First, get all candidates to find some to compare
    console.log("1. Fetching all candidates...");
    const candidatesResponse = await fetch(`${BASE_URL}/candidates`);
    const candidatesData = await candidatesResponse.json();

    if (!candidatesData.success || candidatesData.data.length < 2) {
      console.log("❌ Need at least 2 candidates to test comparison feature");
      return;
    }

    const candidates = candidatesData.data;
    console.log(`✅ Found ${candidates.length} candidates`);

    // Take the first two candidates for comparison
    const candidate1 = candidates[0];
    const candidate2 = candidates[1];

    console.log(`\n2. Comparing candidates:`);
    console.log(
      `   Candidate 1: ${candidate1.name} (ID: ${candidate1.candidateId})`
    );
    console.log(
      `   Candidate 2: ${candidate2.name} (ID: ${candidate2.candidateId})`
    );

    // Test the comparison endpoint
    console.log("\n3. Calling comparison API...");
    const comparisonResponse = await fetch(
      `${BASE_URL}/candidates/${candidate1.candidateId}/compare/${candidate2.candidateId}`
    );

    if (!comparisonResponse.ok) {
      throw new Error(
        `HTTP ${comparisonResponse.status}: ${comparisonResponse.statusText}`
      );
    }

    const comparisonData = await comparisonResponse.json();

    if (!comparisonData.success) {
      throw new Error(
        "Comparison API returned error: " + comparisonData.message
      );
    }

    console.log("✅ Comparison API successful!");

    // Display comparison results
    const comparison = comparisonData.data.comparison;

    console.log("\n📊 Comparison Results:");
    console.log("=".repeat(50));

    // Personal Info
    console.log("\n👤 Personal Information:");
    console.log(
      `   Ages: ${comparison.personalInfo.ageComparison.candidate1Age} vs ${comparison.personalInfo.ageComparison.candidate2Age} (diff: ${comparison.personalInfo.ageComparison.ageDifference})`
    );
    console.log(
      `   Experience: ${comparison.personalInfo.experienceComparison.candidate1Experience} vs ${comparison.personalInfo.experienceComparison.candidate2Experience}`
    );
    console.log(
      `   Certification: ${comparison.personalInfo.certificationComparison.candidate1Certification} vs ${comparison.personalInfo.certificationComparison.candidate2Certification}`
    );

    // Skills
    console.log("\n🎯 Skills Analysis:");
    console.log(`   Common Skills: ${comparison.skills.commonSkills.length}`);
    console.log(
      `   ${candidate1.name} Unique: ${comparison.skills.uniqueToCandidate1.length}`
    );
    console.log(
      `   ${candidate2.name} Unique: ${comparison.skills.uniqueToCandidate2.length}`
    );

    // Personality
    console.log("\n🧠 Personality Scores:");
    console.log(
      `   ${candidate1.name}: ${comparison.personality.candidate1PersonalityScore}/10`
    );
    console.log(
      `   ${candidate2.name}: ${comparison.personality.candidate2PersonalityScore}/10`
    );
    console.log(
      `   Difference: ${comparison.personality.personalityDifference.toFixed(
        1
      )}`
    );

    // Overall Recommendation
    console.log("\n🏆 Recommendation:");
    console.log(
      `   Winner: ${comparison.overallComparison.recommendedCandidate}`
    );
    console.log(`   Reason: ${comparison.overallComparison.recommendation}`);

    console.log(
      "\n✅ All tests passed! Candidate comparison feature is working correctly."
    );
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    console.error("Full error:", error);
  }
}

// Test edge cases
async function testEdgeCases() {
  console.log("\n🧪 Testing Edge Cases...\n");

  try {
    // Test comparing candidate with themselves
    console.log("1. Testing self-comparison (should fail)...");
    const candidatesResponse = await fetch(`${BASE_URL}/candidates`);
    const candidatesData = await candidatesResponse.json();

    if (candidatesData.success && candidatesData.data.length > 0) {
      const candidateId = candidatesData.data[0].candidateId;
      const selfCompareResponse = await fetch(
        `${BASE_URL}/candidates/${candidateId}/compare/${candidateId}`
      );

      if (selfCompareResponse.status === 400) {
        console.log("✅ Self-comparison correctly rejected");
      } else {
        console.log("❌ Self-comparison should have been rejected");
      }
    }

    // Test with invalid candidate ID
    console.log("\n2. Testing invalid candidate ID (should fail)...");
    const invalidResponse = await fetch(
      `${BASE_URL}/candidates/invalid-id-1/compare/invalid-id-2`
    );

    if (!invalidResponse.ok) {
      console.log("✅ Invalid candidate IDs correctly handled");
    } else {
      console.log("❌ Invalid candidate IDs should have been rejected");
    }
  } catch (error) {
    console.error("Edge case test error:", error.message);
  }
}

// Run tests
async function runAllTests() {
  await testCandidateComparison();
  await testEdgeCases();
  console.log("\n🎉 Testing complete!");
}

runAllTests();
