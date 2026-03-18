/**
 * Tests for TrafficSplitVisualizer component
 */

import { describe, test, expect } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { TrafficSplitVisualizer } from '../TrafficSplitVisualizer';

describe('TrafficSplitVisualizer', () => {
  test('renders traffic allocation title', () => {
    const variants = [
      { name: 'Variant A', trafficPct: 50 },
      { name: 'Variant B', trafficPct: 50 },
    ];

    render(<TrafficSplitVisualizer variants={variants} />);

    expect(screen.getByText('Traffic Allocation')).toBeDefined();
  });

  test('displays valid allocation when total is 100%', () => {
    const variants = [
      { name: 'Variant A', trafficPct: 50 },
      { name: 'Variant B', trafficPct: 50 },
    ];

    render(<TrafficSplitVisualizer variants={variants} />);

    expect(screen.getByText('100%')).toBeDefined();
    expect(screen.getByText('Traffic allocation valid')).toBeDefined();
  });

  test('displays error when total is not 100%', () => {
    const variants = [
      { name: 'Variant A', trafficPct: 40 },
      { name: 'Variant B', trafficPct: 40 },
    ];

    render(<TrafficSplitVisualizer variants={variants} />);

    expect(screen.getByText('80%')).toBeDefined();
    expect(screen.getByText('Invalid traffic allocation')).toBeDefined();
    expect(screen.getByText(/Add 20% more/)).toBeDefined();
  });

  test('displays error when total exceeds 100%', () => {
    const variants = [
      { name: 'Variant A', trafficPct: 60 },
      { name: 'Variant B', trafficPct: 60 },
    ];

    render(<TrafficSplitVisualizer variants={variants} />);

    expect(screen.getByText('120%')).toBeDefined();
    expect(screen.getByText(/Reduce by 20%/)).toBeDefined();
  });

  test('includes control group in allocation', () => {
    const variants = [
      { name: 'Variant A', trafficPct: 45 },
      { name: 'Variant B', trafficPct: 45 },
    ];

    render(<TrafficSplitVisualizer variants={variants} controlGroupPct={10} />);

    expect(screen.getByText('Control Group')).toBeDefined();
    expect(screen.getByText('100%')).toBeDefined();
  });

  test('displays all variant names in legend', () => {
    const variants = [
      { name: 'Variant A', trafficPct: 33 },
      { name: 'Variant B', trafficPct: 33 },
      { name: 'Variant C', trafficPct: 34 },
    ];

    render(<TrafficSplitVisualizer variants={variants} />);

    expect(screen.getByText('Variant A')).toBeDefined();
    expect(screen.getByText('Variant B')).toBeDefined();
    expect(screen.getByText('Variant C')).toBeDefined();
  });

  test('shows correct percentages for each variant', () => {
    const variants = [
      { name: 'Variant A', trafficPct: 25 },
      { name: 'Variant B', trafficPct: 75 },
    ];

    render(<TrafficSplitVisualizer variants={variants} />);

    // Find percentage values in the legend
    const allText = screen.getAllByText(/\d+%/);
    const percentages = allText.map((el) => el.textContent);

    expect(percentages).toContain('25%');
    expect(percentages).toContain('75%');
  });

  test('handles zero traffic variants correctly', () => {
    const variants = [
      { name: 'Variant A', trafficPct: 100 },
      { name: 'Variant B', trafficPct: 0 },
    ];

    render(<TrafficSplitVisualizer variants={variants} />);

    expect(screen.getByText('Variant A')).toBeDefined();
    expect(screen.getByText('Variant B')).toBeDefined();
    expect(screen.getByText('Traffic allocation valid')).toBeDefined();
  });
});
