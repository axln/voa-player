<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import { resolve } from '$app/paths';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>VOA Player</title>
</svelte:head>

<header class="top">
	<a class="brand" href={resolve('/')}>
		<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
			<rect x="3" y="9" width="3" height="6" rx="1.5" fill="#b45309" />
			<rect x="8" y="5" width="3" height="14" rx="1.5" fill="#d97706" />
			<rect x="13" y="7" width="3" height="10" rx="1.5" fill="#f59e0b" />
			<rect x="18" y="10" width="3" height="4" rx="1.5" fill="#fbbf24" />
		</svg>
		VOA Player
	</a>
	<span class="tag">Special English, read & heard</span>
</header>

<main>
	{@render children()}
</main>

<style>
	.top {
		max-width: 64rem;
		margin: 0 auto;
		padding: 1rem 1.25rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 700;
		color: var(--ink);
		text-decoration: none;
		letter-spacing: -0.01em;
	}
	.tag {
		font-size: 0.8rem;
		color: var(--muted);
	}
	@media (max-width: 520px) {
		.tag {
			display: none;
		}
	}
</style>
