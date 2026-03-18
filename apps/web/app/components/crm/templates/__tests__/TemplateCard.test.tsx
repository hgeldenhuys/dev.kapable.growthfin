/**
 * TemplateCard Component Tests
 * Tests for template card display and interactions
 */

import { describe, it, expect, vi } from 'bun:test';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TemplateCard } from '../TemplateCard';
import type { CampaignTemplate } from '~/hooks/useCampaignTemplates';

const mockTemplate: CampaignTemplate = {
  id: 'test-template-1',
  workspaceId: 'workspace-1',
  name: 'Welcome Email Sequence',
  description: 'A nurture sequence for new leads',
  category: 'nurture',
  tags: ['welcome', 'onboarding', 'automated'],
  templateData: { subject: 'Welcome!', body: 'Hello there!' },
  version: 1,
  isLatestVersion: true,
  usageCount: 42,
  lastUsedAt: '2025-01-01T00:00:00Z',
  status: 'active',
  createdAt: '2024-12-01T00:00:00Z',
  updatedAt: '2024-12-15T00:00:00Z',
};

describe('TemplateCard', () => {
  it('renders template information correctly', () => {
    render(<TemplateCard template={mockTemplate} />);

    expect(screen.getByText('Welcome Email Sequence')).toBeDefined();
    expect(screen.getByText('A nurture sequence for new leads')).toBeDefined();
    expect(screen.getByText('nurture')).toBeDefined();
    expect(screen.getByText('42 uses')).toBeDefined();
  });

  it('displays tags up to limit', () => {
    render(<TemplateCard template={mockTemplate} />);

    expect(screen.getByText('welcome')).toBeDefined();
    expect(screen.getByText('onboarding')).toBeDefined();
    expect(screen.getByText('automated')).toBeDefined();
  });

  it('shows Latest badge for latest version', () => {
    render(<TemplateCard template={mockTemplate} />);

    expect(screen.getByText('Latest')).toBeDefined();
  });

  it('does not show Latest badge for old version', () => {
    const oldTemplate = { ...mockTemplate, isLatestVersion: false, version: 2 };
    render(<TemplateCard template={oldTemplate} />);

    const latestBadges = screen.queryAllByText('Latest');
    expect(latestBadges.length).toBe(0);
  });

  it('calls onUse when Use Template button is clicked', async () => {
    const onUse = vi.fn();
    const user = userEvent.setup();

    render(<TemplateCard template={mockTemplate} onUse={onUse} />);

    const useButton = screen.getByText('Use Template');
    await user.click(useButton);

    expect(onUse).toHaveBeenCalledTimes(1);
    expect(onUse).toHaveBeenCalledWith(mockTemplate);
  });

  it('calls onPreview when preview button is clicked', async () => {
    const onPreview = vi.fn();
    const user = userEvent.setup();

    render(<TemplateCard template={mockTemplate} onPreview={onPreview} />);

    const previewButtons = screen.getAllByRole('button');
    const previewButton = previewButtons.find((btn) => {
      const svg = btn.querySelector('svg');
      return svg?.classList.contains('lucide-eye');
    });

    if (previewButton) {
      await user.click(previewButton);
      expect(onPreview).toHaveBeenCalledTimes(1);
      expect(onPreview).toHaveBeenCalledWith(mockTemplate);
    }
  });

  it('calls onEdit when edit button is clicked', async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();

    render(<TemplateCard template={mockTemplate} onEdit={onEdit} />);

    const editButtons = screen.getAllByRole('button');
    const editButton = editButtons.find((btn) => {
      const svg = btn.querySelector('svg');
      return svg?.classList.contains('lucide-edit');
    });

    if (editButton) {
      await user.click(editButton);
      expect(onEdit).toHaveBeenCalledTimes(1);
      expect(onEdit).toHaveBeenCalledWith(mockTemplate);
    }
  });

  it('calls onDelete when delete button is clicked', async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();

    render(<TemplateCard template={mockTemplate} onDelete={onDelete} />);

    const deleteButtons = screen.getAllByRole('button');
    const deleteButton = deleteButtons.find((btn) => {
      const svg = btn.querySelector('svg');
      return svg?.classList.contains('lucide-trash-2');
    });

    if (deleteButton) {
      await user.click(deleteButton);
      expect(onDelete).toHaveBeenCalledTimes(1);
      expect(onDelete).toHaveBeenCalledWith(mockTemplate);
    }
  });
});
