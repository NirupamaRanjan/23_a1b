import { render, screen, fireEvent } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import EmptyState from './EmptyState';
import { State } from './Ui';
it('shows a themed local illustration and usable recovery action', () => {
    const action = vi.fn();
    const { container } = render(<EmptyState title='No nearby nurses' message='Try another location.' action={{ label: 'Retry', onClick: action }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Try another location.');
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' })); expect(action).toHaveBeenCalledOnce();
});
it('keeps loading and errors distinct from empty results', () => {
    const { rerender } = render(<State resource={{ loading: true }} empty />);
    expect(screen.queryByTestId('empty-state')).toBeNull();
    rerender(<State resource={{ error: 'Network failed', retry: vi.fn() }} empty />);
    expect(screen.getByRole('alert')).toHaveTextContent('Network failed');
    expect(screen.queryByTestId('empty-state')).toBeNull();
});
