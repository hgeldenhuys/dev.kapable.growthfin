/// <reference lib="dom" />

/**
 * Example Component Test: SimpleButton
 * Demonstrates Bun's DOM testing with happy-dom and React Testing Library
 */

import { describe, test, expect } from 'bun:test';
import { render, screen, fireEvent } from '@testing-library/react';
import { SimpleButton } from './SimpleButton';

describe('SimpleButton', () => {
  test('should render with default primary variant', () => {
    render(<SimpleButton>Click me</SimpleButton>);

    const button = screen.getByRole('button', { name: 'Click me' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('bg-blue-500');
  });

  test('should render secondary variant', () => {
    render(<SimpleButton variant="secondary">Secondary</SimpleButton>);

    const button = screen.getByRole('button', { name: 'Secondary' });
    expect(button).toHaveClass('bg-gray-500');
  });

  test('should render danger variant', () => {
    render(<SimpleButton variant="danger">Delete</SimpleButton>);

    const button = screen.getByRole('button', { name: 'Delete' });
    expect(button).toHaveClass('bg-red-500');
  });

  test('should handle click events', () => {
    let clicked = false;
    const handleClick = () => { clicked = true; };

    render(<SimpleButton onClick={handleClick}>Click me</SimpleButton>);

    const button = screen.getByRole('button', { name: 'Click me' });
    fireEvent.click(button);

    expect(clicked).toBe(true);
  });

  test('should apply custom className', () => {
    const { container } = render(
      <SimpleButton className="custom-class">Button</SimpleButton>
    );

    const button = container.querySelector('button');
    expect(button).toHaveClass('custom-class');
  });

  test('should pass through HTML button props', () => {
    render(<SimpleButton disabled>Disabled</SimpleButton>);

    const button = screen.getByRole('button', { name: 'Disabled' });
    expect(button).toBeDisabled();
  });
});
