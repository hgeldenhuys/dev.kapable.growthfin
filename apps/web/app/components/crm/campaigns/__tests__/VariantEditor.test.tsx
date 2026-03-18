/**
 * Tests for VariantEditor component
 */

import { describe, test, expect, mock } from 'bun:test';
import { render, screen, fireEvent } from '@testing-library/react';
import { VariantEditor, type ABVariant } from '../VariantEditor';

describe('VariantEditor', () => {
  const mockVariant: ABVariant = {
    name: 'Variant A',
    trafficPct: 50,
    subjectLine: 'Test Subject',
    emailContent: 'Test content',
  };

  const mockHandlers = {
    onUpdate: mock(() => {}),
    onClone: mock(() => {}),
    onDelete: mock(() => {}),
    onToggleExpand: mock(() => {}),
  };

  test('renders variant with correct information', () => {
    render(
      <VariantEditor
        variant={mockVariant}
        variantIndex={0}
        totalVariants={2}
        onUpdate={mockHandlers.onUpdate}
        onClone={mockHandlers.onClone}
        onDelete={mockHandlers.onDelete}
      />
    );

    expect(screen.getByText('Variant A')).toBeDefined();
    expect(screen.getByDisplayValue('Test Subject')).toBeDefined();
    expect(screen.getByDisplayValue('Test content')).toBeDefined();
  });

  test('displays traffic percentage correctly', () => {
    render(
      <VariantEditor
        variant={mockVariant}
        variantIndex={0}
        totalVariants={2}
        onUpdate={mockHandlers.onUpdate}
        onClone={mockHandlers.onClone}
        onDelete={mockHandlers.onDelete}
      />
    );

    expect(screen.getByText('50%')).toBeDefined();
  });

  test('calls onUpdate when variant name changes', () => {
    const onUpdate = mock(() => {});

    render(
      <VariantEditor
        variant={mockVariant}
        variantIndex={0}
        totalVariants={2}
        onUpdate={onUpdate}
        onClone={mockHandlers.onClone}
        onDelete={mockHandlers.onDelete}
      />
    );

    const nameInput = screen.getByDisplayValue('Variant A');
    fireEvent.change(nameInput, { target: { value: 'Updated Name' } });

    expect(onUpdate).toHaveBeenCalledWith({ name: 'Updated Name' });
  });

  test('calls onUpdate when subject line changes', () => {
    const onUpdate = mock(() => {});

    render(
      <VariantEditor
        variant={mockVariant}
        variantIndex={0}
        totalVariants={2}
        onUpdate={onUpdate}
        onClone={mockHandlers.onClone}
        onDelete={mockHandlers.onDelete}
      />
    );

    const subjectInput = screen.getByDisplayValue('Test Subject');
    fireEvent.change(subjectInput, { target: { value: 'New Subject' } });

    expect(onUpdate).toHaveBeenCalledWith({ subjectLine: 'New Subject' });
  });

  test('calls onClone when clone button is clicked', () => {
    const onClone = mock(() => {});

    render(
      <VariantEditor
        variant={mockVariant}
        variantIndex={0}
        totalVariants={2}
        onUpdate={mockHandlers.onUpdate}
        onClone={onClone}
        onDelete={mockHandlers.onDelete}
      />
    );

    const cloneButton = screen.getByTitle('Clone variant');
    fireEvent.click(cloneButton);

    expect(onClone).toHaveBeenCalledTimes(1);
  });

  test('shows delete button only when more than 2 variants', () => {
    const { rerender } = render(
      <VariantEditor
        variant={mockVariant}
        variantIndex={0}
        totalVariants={2}
        onUpdate={mockHandlers.onUpdate}
        onClone={mockHandlers.onClone}
        onDelete={mockHandlers.onDelete}
      />
    );

    // With 2 variants, delete button should not be visible
    expect(screen.queryByTitle('Delete variant')).toBeNull();

    // With 3 variants, delete button should be visible
    rerender(
      <VariantEditor
        variant={mockVariant}
        variantIndex={0}
        totalVariants={3}
        onUpdate={mockHandlers.onUpdate}
        onClone={mockHandlers.onClone}
        onDelete={mockHandlers.onDelete}
      />
    );

    expect(screen.getByTitle('Delete variant')).toBeDefined();
  });

  test('disables inputs when readOnly is true', () => {
    render(
      <VariantEditor
        variant={mockVariant}
        variantIndex={0}
        totalVariants={2}
        onUpdate={mockHandlers.onUpdate}
        onClone={mockHandlers.onClone}
        onDelete={mockHandlers.onDelete}
        readOnly={true}
      />
    );

    const nameInput = screen.getByDisplayValue('Variant A') as HTMLInputElement;
    const subjectInput = screen.getByDisplayValue('Test Subject') as HTMLInputElement;

    expect(nameInput.disabled).toBe(true);
    expect(subjectInput.disabled).toBe(true);
  });

  test('renders correctly when collapsed', () => {
    render(
      <VariantEditor
        variant={mockVariant}
        variantIndex={0}
        totalVariants={2}
        onUpdate={mockHandlers.onUpdate}
        onClone={mockHandlers.onClone}
        onDelete={mockHandlers.onDelete}
        isExpanded={false}
        onToggleExpand={mockHandlers.onToggleExpand}
      />
    );

    // When collapsed, form fields should not be visible
    expect(screen.queryByDisplayValue('Test Subject')).toBeNull();
  });

  test('calls onToggleExpand when expand/collapse button is clicked', () => {
    const onToggleExpand = mock(() => {});

    render(
      <VariantEditor
        variant={mockVariant}
        variantIndex={0}
        totalVariants={2}
        onUpdate={mockHandlers.onUpdate}
        onClone={mockHandlers.onClone}
        onDelete={mockHandlers.onDelete}
        isExpanded={true}
        onToggleExpand={onToggleExpand}
      />
    );

    const toggleButton = screen.getByTitle('Collapse');
    fireEvent.click(toggleButton);

    expect(onToggleExpand).toHaveBeenCalledTimes(1);
  });
});
