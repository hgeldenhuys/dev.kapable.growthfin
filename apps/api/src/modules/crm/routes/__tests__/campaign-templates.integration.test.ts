/**
 * Campaign Templates Integration Tests
 * US-CAMPAIGN-TEMPLATE-006: Template Library
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import { db } from '@agios/db';
import { campaignTemplateService } from '../../services/campaign-templates';

// Use existing workspace from DB
const WORKSPACE_ID = 'b5fc28d5-90e7-4205-9b25-1a1347dd7858';

describe('Campaign Templates Service', () => {
  let createdTemplateId: string;

  it('should create a template', async () => {
    const template = await campaignTemplateService.create(db, {
      workspaceId: WORKSPACE_ID,
      name: 'Test Welcome Email',
      description: 'Welcome email template for new users',
      category: 'onboarding',
      tags: ['email', 'onboarding', 'welcome'],
      templateData: {
        subject: 'Welcome to {{company_name}}!',
        body: 'Hi {{lead_name}}, welcome aboard!',
        channel: 'email',
      },
      status: 'active',
    });

    expect(template.id).toBeDefined();
    expect(template.name).toBe('Test Welcome Email');
    expect(template.category).toBe('onboarding');
    expect(template.version).toBe(1);
    expect(template.isLatestVersion).toBe(true);

    createdTemplateId = template.id;
  });

  it('should get template by ID', async () => {
    const template = await campaignTemplateService.getById(db, createdTemplateId, WORKSPACE_ID);

    expect(template).toBeDefined();
    expect(template?.name).toBe('Test Welcome Email');
  });

  it('should list templates', async () => {
    const { templates, total } = await campaignTemplateService.list(db, WORKSPACE_ID);

    expect(total).toBeGreaterThan(0);
    expect(templates.length).toBeGreaterThan(0);
    expect(templates.some((t) => t.id === createdTemplateId)).toBe(true);
  });

  it('should filter templates by category', async () => {
    const { templates } = await campaignTemplateService.list(db, WORKSPACE_ID, {
      category: 'onboarding',
    });

    expect(templates.every((t) => t.category === 'onboarding')).toBe(true);
  });

  it('should increment usage count', async () => {
    const before = await campaignTemplateService.getById(db, createdTemplateId, WORKSPACE_ID);
    const initialCount = before?.usageCount || 0;

    await campaignTemplateService.incrementUsageCount(db, createdTemplateId, WORKSPACE_ID);

    const after = await campaignTemplateService.getById(db, createdTemplateId, WORKSPACE_ID);
    expect(after?.usageCount).toBe(initialCount + 1);
  });

  it('should create a new version', async () => {
    const newVersion = await campaignTemplateService.createVersion(
      db,
      createdTemplateId,
      WORKSPACE_ID,
      {
        name: 'Test Welcome Email v2',
        templateData: {
          subject: 'Welcome to {{company_name}} - Updated!',
          body: 'Hi {{lead_name}}, welcome! This is an updated version.',
          channel: 'email',
        },
      }
    );

    expect(newVersion.version).toBe(2);
    expect(newVersion.parentTemplateId).toBe(createdTemplateId);
    expect(newVersion.isLatestVersion).toBe(true);

    // Original should no longer be latest
    const original = await campaignTemplateService.getById(db, createdTemplateId, WORKSPACE_ID);
    expect(original?.isLatestVersion).toBe(false);
  });

  it('should soft delete template', async () => {
    const success = await campaignTemplateService.delete(db, createdTemplateId, WORKSPACE_ID);
    expect(success).toBe(true);

    const deleted = await campaignTemplateService.getById(db, createdTemplateId, WORKSPACE_ID);
    expect(deleted).toBeNull(); // Should not be found after soft delete
  });
});
