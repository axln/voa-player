// Section chips get a stable color from the section name. The classes are defined in layout.css.
const PALETTE = ['chip-1', 'chip-2', 'chip-3', 'chip-4', 'chip-5', 'chip-6'];

export function chipClass(section: string): string {
	let h = 0;
	for (const c of section) h = (h * 31 + c.charCodeAt(0)) >>> 0;
	return PALETTE[h % PALETTE.length];
}
