import { expect, test } from 'vitest';
import { wordKey } from './word';

test('wordKey normalizes transcript tokens for dictionary lookup', () => {
	expect(wordKey('Watch,')).toBe('watch');
	expect(wordKey('Scientists’')).toBe('scientists');
	expect(wordKey('don’t')).toBe("don't");
	expect(wordKey('“Total”')).toBe('total');
	expect(wordKey('9th.')).toBe('9th');
});
