/**
 * Template Service
 * Handles Handlebars template rendering for email notifications
 */

import Handlebars from 'handlebars';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Notification } from '../Models/Notification';
import { NotificationType, NotificationCategory } from '../Models/enums/NotificationTypes';

export interface TemplateData {
  notification: Notification;
  recipientName?: string;
  actionUrl?: string;
  unsubscribeUrl?: string;
  preferencesUrl?: string;
  year: number;
  appName: string;
  appUrl: string;
}

export class TemplateService {
  private templates: Map<string, HandlebarsTemplateDelegate> = new Map();
  private baseTemplate: HandlebarsTemplateDelegate | null = null;
  private templateDir: string;

  constructor() {
    this.templateDir = join(__dirname, '..', 'templates', 'email');
    this.registerHelpers();
    this.loadBaseTemplate();
  }

  /**
   * Register Handlebars helpers
   */
  private registerHelpers(): void {
    // Helper to format dates
    Handlebars.registerHelper('formatDate', (date: Date) => {
      if (!date) return '';
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    });

    // Helper for conditional rendering
    Handlebars.registerHelper('eq', (a, b) => a === b);
    Handlebars.registerHelper('ne', (a, b) => a !== b);
    Handlebars.registerHelper('gt', (a, b) => a > b);
    Handlebars.registerHelper('lt', (a, b) => a < b);

    // Helper to limit array
    Handlebars.registerHelper('limit', (arr: any[], limit: number) => {
      if (!Array.isArray(arr)) return [];
      return arr.slice(0, limit);
    });

    // Helper for math operations
    Handlebars.registerHelper('subtract', (a: number, b: number) => a - b);

    // Helper to capitalize text
    Handlebars.registerHelper('capitalize', (str: string) => {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    });

    // Helper to get category color
    Handlebars.registerHelper('categoryColor', (category: NotificationCategory) => {
      const colors: Record<NotificationCategory, string> = {
        [NotificationCategory.HR_ACTIVITIES]: '#3B82F6',
        [NotificationCategory.SECURITY_ALERTS]: '#EF4444',
        [NotificationCategory.SYSTEM_UPDATES]: '#8B5CF6',
        [NotificationCategory.COMMENTS]: '#10B981',
        [NotificationCategory.INTERVIEWS]: '#F59E0B',
        [NotificationCategory.ADMIN]: '#6B7280'
      };
      return colors[category] || '#6B7280';
    });

    // Helper to get priority badge
    Handlebars.registerHelper('priorityBadge', (priority: string) => {
      const badges: Record<string, string> = {
        CRITICAL: 'Critical',
        HIGH: 'High',
        MEDIUM: 'Medium',
        LOW: 'Low'
      };
      return badges[priority] || priority;
    });
  }

  /**
   * Load base template
   */
  private loadBaseTemplate(): void {
    try {
      const basePath = join(this.templateDir, 'base.hbs');
      const baseSource = readFileSync(basePath, 'utf-8');
      this.baseTemplate = Handlebars.compile(baseSource);
      console.log('TemplateService: Base template loaded');
    } catch (error) {
      console.error('TemplateService: Failed to load base template:', error);
      // Create a simple fallback template
      this.baseTemplate = Handlebars.compile(`
        <!DOCTYPE html>
        <html>
          <head><meta charset="utf-8"></head>
          <body>
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              {{{content}}}
            </div>
          </body>
        </html>
      `);
    }
  }

  /**
   * Load and compile a template
   */
  private loadTemplate(templateName: string): HandlebarsTemplateDelegate | null {
    // Check cache first
    if (this.templates.has(templateName)) {
      return this.templates.get(templateName)!;
    }

    try {
      const templatePath = join(this.templateDir, `${templateName}.hbs`);
      const templateSource = readFileSync(templatePath, 'utf-8');
      const template = Handlebars.compile(templateSource);
      
      // Cache the template
      this.templates.set(templateName, template);
      console.log(`TemplateService: Template loaded: ${templateName}`);
      
      return template;
    } catch (error) {
      console.error(`TemplateService: Failed to load template ${templateName}:`, error);
      return null;
    }
  }

  /**
   * Get template name from notification type
   */
  private getTemplateName(notification: Notification): string {
    // Map notification types to template names
    const typeToTemplate: Partial<Record<NotificationType, string>> = {
      [NotificationType.CANDIDATE_APPLIED]: 'candidate-applied',
      [NotificationType.CANDIDATE_STATUS_CHANGED]: 'candidate-status',
      [NotificationType.JOB_POSTED]: 'job-posted',
      [NotificationType.JOB_UPDATED]: 'job-updated',
      [NotificationType.INTERVIEW_SCHEDULED]: 'interview-scheduled',
      [NotificationType.INTERVIEW_REMINDER]: 'interview-reminder',
      [NotificationType.SECURITY_ALERT]: 'security-alert',
      [NotificationType.SYSTEM_MAINTENANCE]: 'system-maintenance'
    };

    return typeToTemplate[notification.type] || 'default';
  }

  /**
   * Render notification email
   */
  async renderEmail(notification: Notification, data?: Partial<TemplateData>): Promise<string> {
    const templateName = this.getTemplateName(notification);
    let template = this.loadTemplate(templateName);

    // Fallback to default template if specific template not found
    if (!template) {
      template = this.loadTemplate('default');
    }

    // If still no template, use generic fallback
    if (!template) {
      template = this.createFallbackTemplate();
    }

    // Prepare template data
    const templateData: TemplateData = {
      notification,
      recipientName: data?.recipientName,
      actionUrl: notification.action?.url || data?.actionUrl,
      unsubscribeUrl: data?.unsubscribeUrl || process.env.APP_URL + '/settings/notifications',
      preferencesUrl: data?.preferencesUrl || process.env.APP_URL + '/settings/notifications',
      year: new Date().getFullYear(),
      appName: process.env.APP_NAME || 'SaLuDo',
      appUrl: process.env.APP_URL || 'https://saludo.com',
      ...data
    };

    // Render content
    const content = template(templateData);

    // Wrap in base template
    if (this.baseTemplate) {
      return this.baseTemplate({ content, ...templateData });
    }

    return content;
  }

  /**
   * Create fallback template for when no specific template exists
   * I know I sinned my lord
   */
  private createFallbackTemplate(): HandlebarsTemplateDelegate {
    return Handlebars.compile(`
      <div style="background-color: {{categoryColor notification.category}}; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="margin: 0; color: white;">{{notification.title}}</h2>
      </div>
      <div style="padding: 20px; background-color: #f9fafb; border-radius: 8px;">
        <p style="font-size: 16px; line-height: 1.6; color: #374151;">{{notification.message}}</p>
        {{#if actionUrl}}
          <a href="{{actionUrl}}" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background-color: #3B82F6; color: white; text-decoration: none; border-radius: 6px;">
            {{#if notification.action.label}}{{notification.action.label}}{{else}}View Details{{/if}}
          </a>
        {{/if}}
      </div>
      <div style="margin-top: 20px; padding: 20px; border-top: 1px solid #e5e7eb;">
        <p style="font-size: 12px; color: #6b7280;">
          Priority: {{priorityBadge notification.priority}}<br>
          Sent: {{formatDate notification.createdAt}}
        </p>
      </div>
    `);
  }

  /**
   * Render plain text version (for email clients that don't support HTML)
   */
  renderPlainText(notification: Notification, data?: Partial<TemplateData>): string {
    const lines: string[] = [
      `${notification.title}`,
      '='.repeat(notification.title.length),
      '',
      notification.message,
      ''
    ];

    if (notification.action?.url) {
      lines.push(`View: ${notification.action.url}`);
      lines.push('');
    }

    if (data?.unsubscribeUrl) {
      lines.push('---');
      lines.push(`Unsubscribe: ${data.unsubscribeUrl}`);
    }

    return lines.join('\n');
  }

  /**
   * Render template by name with arbitrary data (for digest emails)
   */
  async renderTemplate(templateName: string, data: Record<string, any>): Promise<string> {
    let template = this.loadTemplate(templateName);

    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    return template(data);
  }

  /**
   * Clear template cache
   */
  clearCache(): void {
    this.templates.clear();
    console.log('TemplateService: Template cache cleared');
  }
}

// Export singleton instance
export const templateService = new TemplateService();
