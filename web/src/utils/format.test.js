import { describe, expect, it } from 'vitest';
import { parseCopay, validId } from './format';
describe('copay and integer schema validation', () => {
    it.each(['0', '-1', '1.001', 'NaN', 'Infinity', '1e3', '', '100000000.00'])(
        'rejects invalid copay %s',
        (value) => expect(parseCopay(value)).toBeNull()
    );
    it('accepts cents exactly', () => {
        expect(parseCopay('0.10')).toBe(10);
        expect(parseCopay('500.00')).toBe(50000);
    });
    it('retains the SERIAL ID contract', () => {
        expect(validId(10482)).toBe(true);
        expect(validId('abc')).toBe(false);
        expect(validId(-1)).toBe(false);
    });
});
