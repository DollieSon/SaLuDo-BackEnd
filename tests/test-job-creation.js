// tests/test-job-creation.js
const fetch = require('node-fetch');

async function testJobCreation() {
  const response = await fetch('http://localhost:3000/api/jobs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jobName: 'Frontend Developer',
      jobDescription: `We are hiring a frontend developer proficient in React.js, JavaScript, HTML, and CSS.
      The candidate should have experience with REST APIs, version control using Git, and responsive design.`
    })
  });

  const data = await response.json();

  if (response.ok) {
    console.log('✅ Job created successfully!');
    console.log('📦 Returned Data:', JSON.stringify(data, null, 2));
  } else {
    console.error('❌ Failed to create job:');
    console.error('Status:', response.status);
    console.error('Response:', data);
  }
}

testJobCreation().catch(err => {
  console.error('🚨 Error during request:', err);
});
