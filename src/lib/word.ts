// Normalizes a transcript token for dictionary lookup: lowercase, typographic apostrophes straightened,
// and leading/trailing punctuation removed. Used by both the build script and the app.
export function wordKey(text: string): string {
	return text
		.toLowerCase()
		.replace(/’/g, "'")
		.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}
