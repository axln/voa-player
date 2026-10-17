<script lang="ts">
	import { fade } from 'svelte/transition';

	// Shown once the page is scrolled down a bit; scrolls back to the top.
	let visible = $state(false);

	function toTop() {
		const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
		window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
	}
</script>

<svelte:window onscroll={() => (visible = window.scrollY > 300)} />

{#if visible}
	<button
		type="button"
		class="scroll-top"
		aria-label="Scroll to top"
		title="Scroll to top"
		transition:fade={{ duration: 150 }}
		onclick={toTop}
	>
		<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"
			><path
				d="M6 14l6-6 6 6"
				fill="none"
				stroke="currentColor"
				stroke-width="2.2"
				stroke-linecap="round"
				stroke-linejoin="round"
			/></svg
		>
	</button>
{/if}

<style>
	.scroll-top {
		position: fixed;
		right: 1.25rem;
		bottom: 1.25rem;
		z-index: 15;
		width: 2.8rem;
		height: 2.8rem;
		display: grid;
		place-items: center;
		border-radius: 999px;
		border: 1px solid #e7e5e4;
		background: #fffdf8;
		color: #57534e;
		box-shadow: 0 8px 22px -10px rgba(28, 25, 23, 0.4);
		cursor: pointer;
	}
	.scroll-top:hover,
	.scroll-top:focus-visible {
		color: #b45309;
		border-color: #fcd34d;
	}
	/* on phones the bottom player bar covers the corner, so move the button above it */
	@media (max-width: 720px) {
		.scroll-top {
			bottom: 12.5rem;
		}
	}
</style>
