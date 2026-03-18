/**
 * Format status utility
 * Simple utility for status text formatting
 */

export function formatStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

export function getStatusColor(status: 'pending' | 'running' | 'completed' | 'failed'): string {
  const colors = {
    pending: 'gray',
    running: 'blue',
    completed: 'green',
    failed: 'red',
  };
  return colors[status] || 'gray';
}
