export type FontId =
	| 'default'
	| 'jakarta'
	| 'system'
	| 'serif'
	| 'mono'
	| 'hyperlegible'
	| 'dyslexic';

export type FontOption = {
	id: FontId;
	name: string;
	hint: string;
	stack: string;
	preview: string;
};

const SYSTEM =
	'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export const FONT_OPTIONS: FontOption[] = [
	{
		id: 'default',
		name: 'Allo',
		hint: 'Orchard default',
		stack: `'Allo', ${SYSTEM}`,
		preview: "'Allo', sans-serif"
	},
	{
		id: 'jakarta',
		name: 'Jakarta',
		hint: 'Plus Jakarta Sans',
		stack: `'Plus Jakarta Sans', ${SYSTEM}`,
		preview: "'Plus Jakarta Sans', sans-serif"
	},
	{
		id: 'system',
		name: 'System',
		hint: 'Matches your OS',
		stack: SYSTEM,
		preview: SYSTEM
	},
	{
		id: 'serif',
		name: 'Serif',
		hint: 'Source Serif 4',
		stack: `'Source Serif 4', Georgia, 'Times New Roman', serif`,
		preview: "'Source Serif 4', serif"
	},
	{
		id: 'mono',
		name: 'Mono',
		hint: 'JetBrains Mono',
		stack: `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace`,
		preview: "'JetBrains Mono', monospace"
	},
	{
		id: 'hyperlegible',
		name: 'Hyperlegible',
		hint: 'Built for low vision',
		stack: `'Atkinson Hyperlegible Next', ${SYSTEM}`,
		preview: "'Atkinson Hyperlegible Next', sans-serif"
	},
	{
		id: 'dyslexic',
		name: 'Dyslexic',
		hint: 'Weighted letterforms',
		stack: `'OpenDyslexic', ${SYSTEM}`,
		preview: "'OpenDyslexic', sans-serif"
	}
];

export const DEFAULT_FONT: FontId = 'default';

export function fontById(id: string | null | undefined): FontOption {
	return FONT_OPTIONS.find((f) => f.id === id) ?? FONT_OPTIONS[0];
}
