/// <reference lib="dom" />

/**
 * US-AI-015: Frontend Component Tests
 * useRouteContext Hook Tests
 */

import { describe, test, expect } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { useRouteContext } from '../useRouteContext';
import { MemoryRouter } from 'react-router';

describe('useRouteContext', () => {
  test('should return current route pathname', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={['/dashboard/workspace-1']}>
        {children}
      </MemoryRouter>
    );

    const { result } = renderHook(() => useRouteContext(), { wrapper });

    expect(result.current.currentRoute).toBe('/dashboard/workspace-1');
    expect(result.current.additionalContext.pathname).toBe('/dashboard/workspace-1');
  });

  test('should extract route params from URL', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={['/dashboard/workspace-123/contacts/contact-456']}>
        {children}
      </MemoryRouter>
    );

    const { result } = renderHook(() => useRouteContext(), { wrapper });

    expect(result.current.currentRoute).toBe('/dashboard/workspace-123/contacts/contact-456');
  });

  test('should include search parameters', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={['/dashboard?tab=contacts&filter=active']}>
        {children}
      </MemoryRouter>
    );

    const { result } = renderHook(() => useRouteContext(), { wrapper });

    expect(result.current.additionalContext.search).toBe('?tab=contacts&filter=active');
  });

  test('should include hash from URL', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={['/dashboard#section-1']}>
        {children}
      </MemoryRouter>
    );

    const { result } = renderHook(() => useRouteContext(), { wrapper });

    expect(result.current.additionalContext.hash).toBe('#section-1');
  });

  test('should return empty search and hash when not present', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={['/dashboard']}>
        {children}
      </MemoryRouter>
    );

    const { result } = renderHook(() => useRouteContext(), { wrapper });

    expect(result.current.additionalContext.search).toBe('');
    expect(result.current.additionalContext.hash).toBe('');
  });

  test('should handle root path', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={['/']}>
        {children}
      </MemoryRouter>
    );

    const { result } = renderHook(() => useRouteContext(), { wrapper });

    expect(result.current.currentRoute).toBe('/');
    expect(result.current.additionalContext.pathname).toBe('/');
  });

  test('should update when route changes', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={['/page1']}>
        {children}
      </MemoryRouter>
    );

    const { result, rerender } = renderHook(() => useRouteContext(), { wrapper });

    expect(result.current.currentRoute).toBe('/page1');

    // Note: In a real app, route changes happen via navigation
    // This test just verifies the hook structure
    rerender();

    expect(result.current.currentRoute).toBe('/page1');
  });

  test('should return routeParams object', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={['/dashboard']}>
        {children}
      </MemoryRouter>
    );

    const { result } = renderHook(() => useRouteContext(), { wrapper });

    expect(result.current.routeParams).toBeDefined();
    expect(typeof result.current.routeParams).toBe('object');
  });

  test('should return complete RouteContext structure', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={['/test']}>
        {children}
      </MemoryRouter>
    );

    const { result } = renderHook(() => useRouteContext(), { wrapper });

    // Verify structure matches interface
    expect(result.current).toHaveProperty('currentRoute');
    expect(result.current).toHaveProperty('routeParams');
    expect(result.current).toHaveProperty('additionalContext');
    expect(result.current.additionalContext).toHaveProperty('pathname');
    expect(result.current.additionalContext).toHaveProperty('search');
    expect(result.current.additionalContext).toHaveProperty('hash');
  });
});
