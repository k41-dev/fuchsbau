import { describe, expect, it } from 'vitest';
import {
	MAX_PROJECT_IMAGE_BYTES,
	validateProjectImageFile
} from './project-images';

describe('validateProjectImageFile', () => {
	it('accepts supported image types within the size limit', () => {
		const file = new File([new Uint8Array(1024)], 'site.jpg', { type: 'image/jpeg' });
		expect(() => validateProjectImageFile(file)).not.toThrow();
	});

	it('rejects unsupported mime types', () => {
		const file = new File([new Uint8Array(1024)], 'site.gif', { type: 'image/gif' });
		expect(() => validateProjectImageFile(file)).toThrow(/jpg, png, or webp/i);
	});

	it('rejects files larger than the limit', () => {
		const file = new File([new Uint8Array(MAX_PROJECT_IMAGE_BYTES + 1)], 'big.jpg', {
			type: 'image/jpeg'
		});
		expect(() => validateProjectImageFile(file)).toThrow(/5 mb/i);
	});
});