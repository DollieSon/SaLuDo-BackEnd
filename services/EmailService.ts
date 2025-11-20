/**
 * Email Service
 * Handles email sending using NodeMailer with SMTP configuration
 */

import nodemailer, { Transporter, SendMailOptions } from 'nodemailer';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    path?: string;
    content?: Buffer | string;
  }>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class EmailService {
  private transporter: Transporter | null = null;
  private isConfigured: boolean = false;
  private fromAddress: string;
  private fromName: string;

  constructor() {
    this.fromAddress = process.env.EMAIL_FROM || 'noreply@saludo.com';
    this.fromName = process.env.EMAIL_FROM_NAME || 'SaLuDo Notifications';
    this.initialize();
  }

  /**
   * Initialize NodeMailer transporter with SMTP configuration
   */
  private initialize(): void {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587');
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;
    const smtpSecure = process.env.SMTP_SECURE === 'true';

    // Check if SMTP is configured
    if (!smtpHost || !smtpUser || !smtpPassword) {
      console.warn('EmailService: SMTP not configured. Email sending will be disabled.');
      console.warn('  Required environment variables: SMTP_HOST, SMTP_USER, SMTP_PASSWORD');
      this.isConfigured = false;
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPassword
        },
        // Connection timeout
        connectionTimeout: 10000,
        // Greeting timeout
        greetingTimeout: 10000,
        // Socket timeout
        socketTimeout: 15000
      });

      this.isConfigured = true;
      console.log(`EmailService: Configured with SMTP ${smtpHost}:${smtpPort}`);
    } catch (error) {
      console.error('EmailService: Failed to initialize transporter:', error);
      this.isConfigured = false;
    }
  }

  /**
   * Send email
   */
  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    if (!this.isConfigured || !this.transporter) {
      console.warn('EmailService: Cannot send email - SMTP not configured');
      return {
        success: false,
        error: 'SMTP not configured'
      };
    }

    try {
      const mailOptions: SendMailOptions = {
        from: `"${this.fromName}" <${this.fromAddress}>`,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.htmlToText(options.html),
        attachments: options.attachments
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      console.log('EmailService: Email sent successfully', {
        messageId: info.messageId,
        to: options.to,
        subject: options.subject
      });

      return {
        success: true,
        messageId: info.messageId
      };
    } catch (error) {
      console.error('EmailService: Failed to send email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Send bulk emails
   */
  async sendBulkEmails(emails: EmailOptions[]): Promise<EmailResult[]> {
    const results: EmailResult[] = [];

    for (const email of emails) {
      const result = await this.sendEmail(email);
      results.push(result);
      
      // Small delay to avoid overwhelming SMTP server
      await this.delay(100);
    }

    return results;
  }

  /**
   * Verify SMTP connection
   */
  async verifyConnection(): Promise<boolean> {
    if (!this.isConfigured || !this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      console.log('EmailService: SMTP connection verified');
      return true;
    } catch (error) {
      console.error('EmailService: SMTP connection failed:', error);
      return false;
    }
  }

  /**
   * Check if email service is configured and ready
   */
  isReady(): boolean {
    return this.isConfigured;
  }

  /**
   * Simple HTML to plain text conversion
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<style[^>]*>.*?<\/style>/gi, '')
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get from address
   */
  getFromAddress(): string {
    return `"${this.fromName}" <${this.fromAddress}>`;
  }
}

// Export singleton instance
export const emailService = new EmailService();
