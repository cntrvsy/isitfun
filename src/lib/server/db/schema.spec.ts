import { describe, it, expect } from 'vitest';
import { generateNanoID } from './schema';

describe('generateNanoID', () => {
	it('should return a string of the default size 12', () => {
		const id = generateNanoID();
		expect(id).toHaveLength(12);
	});

	it('should return a string of custom size', () => {
		const id = generateNanoID(8);
		expect(id).toHaveLength(8);

		const idLarge = generateNanoID(32);
		expect(idLarge).toHaveLength(32);
	});

	it('should only contain characters from the standard alphabet', () => {
		const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
		const id = generateNanoID(100);
		for (const char of id) {
			expect(alphabet).toContain(char);
		}
	});

	it('should generate reasonably unique values', () => {
		const set = new Set();
		for (let i = 0; i < 100; i++) {
			set.add(generateNanoID());
		}
		expect(set.size).toBe(100);
	});
});
