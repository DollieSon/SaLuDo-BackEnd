// Video File Storage Test Script
// This file demonstrates how to test the video upload functionality

const API_BASE = "http://localhost:3000/api";

// Test data
const testCandidateId = "test-candidate-id"; // Replace with actual candidate ID

// Helper function to create a test video file (for testing purposes)
function createTestVideoFile() {
  // In a real scenario, this would be a File object from an input element
  // For testing, you would use an actual video file
  const videoInput = document.getElementById("videoInput");
  return videoInput?.files?.[0];
}

// Test 1: Upload Interview Video
async function testInterviewVideoUpload() {
  const videoFile = createTestVideoFile();
  if (!videoFile) {
    console.error("No video file selected");
    return;
  }

  const formData = new FormData();
  formData.append("video", videoFile);
  formData.append("interviewRound", "technical");
  formData.append(
    "description",
    "Technical interview - JavaScript and React questions"
  );
  formData.append("duration", "1800"); // 30 minutes in seconds
  formData.append("resolution", "1920x1080");
  formData.append("frameRate", "30");

  try {
    const response = await fetch(
      `${API_BASE}/candidates/${testCandidateId}/videos/interview/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    const result = await response.json();
    console.log("Interview video upload result:", result);

    if (result.success) {
      console.log("✅ Interview video uploaded successfully!");
      console.log("Video metadata:", result.data);
      return result.data.fileId;
    } else {
      console.error("❌ Interview video upload failed:", result.message);
    }
  } catch (error) {
    console.error("❌ Error uploading interview video:", error);
  }
}

// Test 2: Upload Introduction Video
async function testIntroductionVideoUpload() {
  const videoFile = createTestVideoFile();
  if (!videoFile) {
    console.error("No video file selected");
    return;
  }

  const formData = new FormData();
  formData.append("video", videoFile);
  formData.append(
    "description",
    "Personal introduction - Software Engineer application"
  );
  formData.append("duration", "300"); // 5 minutes in seconds
  formData.append("resolution", "1280x720");
  formData.append("frameRate", "24");

  try {
    const response = await fetch(
      `${API_BASE}/candidates/${testCandidateId}/videos/introduction/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    const result = await response.json();
    console.log("Introduction video upload result:", result);

    if (result.success) {
      console.log("✅ Introduction video uploaded successfully!");
      console.log("Video metadata:", result.data);
      return result.data.fileId;
    } else {
      console.error("❌ Introduction video upload failed:", result.message);
    }
  } catch (error) {
    console.error("❌ Error uploading introduction video:", error);
  }
}

// Test 3: Get All Videos
async function testGetAllVideos() {
  try {
    const response = await fetch(
      `${API_BASE}/candidates/${testCandidateId}/videos/all`
    );
    const result = await response.json();

    if (result.success) {
      console.log("✅ Retrieved all videos successfully!");
      console.log("Interview videos:", result.data.interviewVideos);
      console.log("Introduction videos:", result.data.introductionVideos);
      console.log("Total videos:", result.data.totalCount);
    } else {
      console.error("❌ Failed to retrieve videos:", result.message);
    }
  } catch (error) {
    console.error("❌ Error retrieving videos:", error);
  }
}

// Test 4: Get Video Metadata
async function testGetVideoMetadata(videoId, videoType) {
  try {
    const response = await fetch(
      `${API_BASE}/candidates/${testCandidateId}/videos/${videoType}/${videoId}/metadata`
    );
    const result = await response.json();

    if (result.success) {
      console.log(`✅ Retrieved ${videoType} video metadata successfully!`);
      console.log("Metadata:", result.data);
    } else {
      console.error(
        `❌ Failed to retrieve ${videoType} video metadata:`,
        result.message
      );
    }
  } catch (error) {
    console.error(`❌ Error retrieving ${videoType} video metadata:`, error);
  }
}

// Test 5: Delete Video
async function testDeleteVideo(videoId, videoType) {
  try {
    const response = await fetch(
      `${API_BASE}/candidates/${testCandidateId}/videos/${videoType}/${videoId}`,
      {
        method: "DELETE",
      }
    );

    const result = await response.json();

    if (result.success) {
      console.log(`✅ Deleted ${videoType} video successfully!`);
    } else {
      console.error(`❌ Failed to delete ${videoType} video:`, result.message);
    }
  } catch (error) {
    console.error(`❌ Error deleting ${videoType} video:`, error);
  }
}

// Test 6: Download Video (creates a blob URL for testing)
async function testDownloadVideo(videoId, videoType) {
  try {
    const response = await fetch(
      `${API_BASE}/candidates/${testCandidateId}/videos/${videoType}/${videoId}`
    );

    if (response.ok) {
      const blob = await response.blob();
      const videoUrl = URL.createObjectURL(blob);

      console.log(`✅ Downloaded ${videoType} video successfully!`);
      console.log("Video blob URL:", videoUrl);

      // Create a temporary video element to test playback
      const video = document.createElement("video");
      video.src = videoUrl;
      video.controls = true;
      video.style.maxWidth = "500px";
      document.body.appendChild(video);

      // Clean up URL after 10 seconds
      setTimeout(() => {
        URL.revokeObjectURL(videoUrl);
        document.body.removeChild(video);
      }, 10000);
    } else {
      console.error(
        `❌ Failed to download ${videoType} video:`,
        response.statusText
      );
    }
  } catch (error) {
    console.error(`❌ Error downloading ${videoType} video:`, error);
  }
}

// Comprehensive test suite
async function runVideoTestSuite() {
  console.log("🎬 Starting Video File Storage Test Suite...\n");

  // Test interview video upload
  console.log("1. Testing interview video upload...");
  const interviewVideoId = await testInterviewVideoUpload();

  // Wait a bit between tests
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Test introduction video upload
  console.log("\n2. Testing introduction video upload...");
  const introVideoId = await testIntroductionVideoUpload();

  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Test getting all videos
  console.log("\n3. Testing get all videos...");
  await testGetAllVideos();

  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Test metadata retrieval
  if (interviewVideoId) {
    console.log("\n4. Testing interview video metadata retrieval...");
    await testGetVideoMetadata(interviewVideoId, "interview");
  }

  if (introVideoId) {
    console.log("\n5. Testing introduction video metadata retrieval...");
    await testGetVideoMetadata(introVideoId, "introduction");
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Test video download
  if (interviewVideoId) {
    console.log("\n6. Testing interview video download...");
    await testDownloadVideo(interviewVideoId, "interview");
  }

  // Cleanup - delete test videos (uncomment if you want to clean up)
  /*
    if (interviewVideoId) {
        console.log('\n7. Cleaning up - deleting interview video...');
        await testDeleteVideo(interviewVideoId, 'interview');
    }
    
    if (introVideoId) {
        console.log('\n8. Cleaning up - deleting introduction video...');
        await testDeleteVideo(introVideoId, 'introduction');
    }
    */

  console.log("\n🎉 Video File Storage Test Suite completed!");
}

// Export functions for use in HTML test page
window.videoTests = {
  testInterviewVideoUpload,
  testIntroductionVideoUpload,
  testGetAllVideos,
  testGetVideoMetadata,
  testDeleteVideo,
  testDownloadVideo,
  runVideoTestSuite,
};

console.log(
  "Video test functions loaded. Use videoTests.runVideoTestSuite() to run all tests."
);
