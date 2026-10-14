import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { CatalogDocument, DocumentValue } from './Reviews';
it('renders untrusted catalog strings as text without HTML execution', () => {
    const payload = '<img src=x onerror="window.compromised=true">';
    const { container } = render(<DocumentValue value={{ details: [payload, true, null] }} />);
    expect(screen.getByText(payload)).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('Yes')).toBeInTheDocument();
});

it('preserves flexible availability values instead of assuming every slot is a row', () => {
    render(
        <CatalogDocument
            record={{
                id: 'test',
                availability_slots: [null, { nested: ['on call', true] }],
                medication_details: null,
            }}
        />
    );
    expect(screen.getByText('on call')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
});
