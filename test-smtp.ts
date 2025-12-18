import { EmailService } from './services/EmailService';

async function testSMTP() {
  console.log('=== SMTP Configuration Test ===\n');
  
  const emailService = new EmailService();
  
  // Test 1: Verify connection
  console.log('1. Testing SMTP connection...');
  const isVerified = await emailService.verifyConnection();
  
  if (!isVerified) {
    console.log('✗ SMTP connection failed');
    console.log('\nPlease check:');
    console.log('- SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD are set in .env.local');
    console.log('- If using Gmail, you need an App Password (not your regular password)');
    console.log('- Your firewall/network allows outbound connections on port 587');
    process.exit(1);
  }
  
  console.log('✓ SMTP connection successful!\n');
  
  // Test 2: Send test email
  console.log('2. Sending test email...');
  console.log('Enter recipient email (or press Enter to skip):');
  
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  readline.question('Recipient email: ', async (email: string) => {
    readline.close();
    
    if (email && email.includes('@')) {
      const result = await emailService.sendEmail({
        to: email,
        subject: 'SaLuDo SMTP Test Email',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #4F46E5;">SMTP Configuration Test</h2>
            <p>If you're reading this, your SMTP configuration is working correctly!</p>
            <p style="color: #6B7280; font-size: 14px; margin-top: 20px;">
              Sent from SaLuDo Backend<br>
              ${new Date().toLocaleString()}
            </p>
          </div>
        `,
        text: 'If you\'re reading this, your SMTP configuration is working correctly!'
      });
      
      if (result.success) {
        console.log('✓ Test email sent successfully!');
        console.log('Message ID:', result.messageId);
        console.log('\nCheck your inbox (and spam folder) for the test email.');
      } else {
        console.log('✗ Failed to send test email');
        console.log('Error:', result.error);
      }
    } else {
      console.log('Skipping email send test.');
    }
    
    console.log('\n=== Test Complete ===');
    process.exit(0);
  });
}

testSMTP().catch((error) => {
  console.error('Test failed with error:', error);
  process.exit(1);
});
