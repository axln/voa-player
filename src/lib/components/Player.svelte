<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { buildTimeline, findWordIndex, type Piece } from '../align';
	import { WebAudioPlayer } from '../web-audio-player';

	type Props = {
		episodeId: number;
		audioSrc: string;
		paragraphs: Piece[][];
		weights: number[];
		timingsSrc: string; // optional aligned timings: { "starts": number[] } in word order
	};

	let { episodeId, audioSrc, paragraphs, weights, timingsSrc }: Props = $props();

	const RATES = [0.75, 1, 1.25, 1.5];
	// The page re-keys this component per episode, so the initial props are the right ones.
	const POSITION_KEY = untrack(() => `voa-player:position:${episodeId}`);
	const AUTOSCROLL_KEY = 'voa-player:autoscroll';
	const REMEMBER_KEY = 'voa-player:remember';
	const POSITION_PREFIX = 'voa-player:position:';

	const player = new WebAudioPlayer(untrack(() => audioSrc));
	let status = $state<'loading' | 'ready' | 'error'>('loading');
	let playing = $state(false);
	let duration = $state(0);
	let current = $state(0); // position in seconds, updated every animation frame while playing
	let dragging = false;
	let rate = $state(1);
	let autoScroll = $state(true);
	let remember = $state(true);
	let settingsOpen = $state(false);
	let gearEl = $state<HTMLElement>();
	let popupEl = $state<HTMLElement>();
	let popupPos = $state({ left: 0, bottom: 0 });
	const POPUP_WIDTH = 288; // matches .popup width (18rem)
	let clearMessage = $state('');

	// Real aligned starts when a timings file exists; otherwise a mock estimate from word lengths.
	let alignedStarts = $state<Float64Array | null>(null);
	let alignedEnds = $state<Float64Array | null>(null);
	let estimated = $state(true);

	const starts = $derived.by(() => {
		if (!duration) return null;
		if (alignedStarts) {
			const s = new Float64Array(alignedStarts.length + 1);
			s.set(alignedStarts);
			s[alignedStarts.length] = duration;
			return s;
		}
		return buildTimeline(weights, duration);
	});

	// Word ends are known only from aligned timings; the mock estimate runs each word up to the next one.
	const ends = $derived.by(() => {
		if (!starts || !alignedEnds) return undefined;
		const e = new Float64Array(alignedEnds.length);
		e.set(alignedEnds);
		return e;
	});
	// The word being spoken right now (-1 in pauses, intro, or outro).
	const active = $derived(starts ? findWordIndex(starts, current, ends) : -1);
	// The last word that has started; used to dim words already read, including during pauses.
	const reached = $derived(starts ? findWordIndex(starts, current) : -1);
	// The word that will be spoken next. The cursor under it shows only in a long pause (music, intro, outro),
	// judged by the whole silence before that word, so it does not flicker between words.
	const LONG_PAUSE = 1; // seconds
	const next = $derived(starts ? reached + 1 : -1);
	const cursorWord = $derived.by(() => {
		if (!starts || next < 0 || next >= weights.length || active >= 0) return -1;
		const silenceStart = reached < 0 ? 0 : (ends?.[reached] ?? starts[reached]);
		return starts[next] - silenceStart >= LONG_PAUSE ? next : -1;
	});

	let frame = 0;
	let lastSave = 0;

	function tick(now: number) {
		if (!dragging) current = player.update();
		if (now - lastSave > 1500) {
			lastSave = now;
			savePosition();
		}
		frame = requestAnimationFrame(tick);
	}

	function savePosition() {
		if (!remember) return;
		try {
			localStorage.setItem(POSITION_KEY, String(current));
		} catch {
			// storage unavailable
		}
	}

	onMount(() => {
		try {
			autoScroll = localStorage.getItem(AUTOSCROLL_KEY) !== 'off';
			remember = localStorage.getItem(REMEMBER_KEY) !== 'off';
		} catch {
			// storage unavailable: keep the default
		}
		fetch(timingsSrc)
			.then((res) => (res.ok ? res.json() : null))
			.then((data: { starts: number[]; ends?: number[] } | null) => {
				if (data && data.starts.length === weights.length && data.ends?.length === weights.length) {
					alignedStarts = Float64Array.from(data.starts);
					alignedEnds = Float64Array.from(data.ends);
					estimated = false;
				}
			})
			.catch(() => {
				// no timings file: keep the estimate
			});
		player.onEnded(() => {
			playing = false;
			cancelAnimationFrame(frame);
		});
		player
			.load()
			.then((d) => {
				duration = d;
				status = 'ready';
				try {
					const saved = remember ? Number(localStorage.getItem(POSITION_KEY)) : 0;
					if (saved > 0 && saved < d - 1) player.seek(saved);
				} catch {
					// storage unavailable: start at 0
				}
				current = player.update();
			})
			.catch(() => (status = 'error'));

		return () => {
			cancelAnimationFrame(frame);
			player.dispose();
		};
	});

	// Remember the "remember position" choice.
	$effect(() => {
		try {
			localStorage.setItem(REMEMBER_KEY, remember ? 'on' : 'off');
		} catch {
			// storage unavailable
		}
	});

	function clearSavedPositions() {
		let removed = 0;
		try {
			for (const key of Object.keys(localStorage)) {
				if (key.startsWith(POSITION_PREFIX)) {
					localStorage.removeItem(key);
					removed++;
				}
			}
			clearMessage = removed
				? `Forgot ${removed} saved position${removed === 1 ? '' : 's'}.`
				: 'No saved positions.';
		} catch {
			clearMessage = 'Could not access saved positions.';
		}
	}

	// Remember the auto-scroll choice.
	$effect(() => {
		try {
			localStorage.setItem(AUTOSCROLL_KEY, autoScroll ? 'on' : 'off');
		} catch {
			// storage unavailable
		}
	});

	// Keep the spoken word in view while playing.
	$effect(() => {
		if (!autoScroll || active < 0 || !playing) return;
		document.getElementById(`w${active}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
	});

	function togglePlay() {
		if (status !== 'ready') return;
		if (player.playing) {
			player.pause();
			playing = false;
			cancelAnimationFrame(frame);
			current = player.update();
			savePosition();
		} else {
			player.play();
			playing = true;
			frame = requestAnimationFrame(tick);
		}
	}

	function seek(t: number) {
		player.seek(t);
		current = player.update();
		savePosition();
	}

	function seekToWord(i: number) {
		if (!starts) return;
		seek(starts[i]);
		if (!player.playing) togglePlay();
	}

	function skip(seconds: number) {
		seek(Math.min(duration, Math.max(0, player.update() + seconds)));
	}

	function setRate(r: number) {
		player.setRate(r);
		rate = r;
	}

	function format(t: number) {
		const s = Math.floor(t);
		return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
	}

	function toggleSettings() {
		if (settingsOpen) {
			settingsOpen = false;
			return;
		}
		const r = gearEl?.getBoundingClientRect();
		if (r) {
			const left = Math.min(
				window.innerWidth - POPUP_WIDTH - 8,
				Math.max(8, r.right - POPUP_WIDTH)
			);
			popupPos = { left, bottom: window.innerHeight - r.top + 10 };
		}
		settingsOpen = true;
	}

	function onPointerDown(e: PointerEvent) {
		// Clicks on the gear button or inside the popup keep it open; any other click closes it.
		const t = e.target as Node;
		if (settingsOpen && !gearEl?.contains(t) && !popupEl?.contains(t)) settingsOpen = false;
	}

	function onKey(e: KeyboardEvent) {
		const target = e.target as HTMLElement;
		if (e.key === 'Escape' && settingsOpen) {
			settingsOpen = false;
			return;
		}
		if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
		if (e.key === ' ') {
			e.preventDefault();
			togglePlay();
		} else if (e.key === 'ArrowLeft') skip(-5);
		else if (e.key === 'ArrowRight') skip(5);
	}
</script>

<svelte:window
	onkeydown={onKey}
	onpointerdown={onPointerDown}
	onresize={() => (settingsOpen = false)}
/>

<section class="transcript">
	{#each paragraphs as para, pi (pi)}
		<p>
			{#each para as piece, k (k)}
				{#if piece.word >= 0}
					<button
						type="button"
						id="w{piece.word}"
						class={[
							'word',
							piece.word === active && 'word-active',
							piece.word < reached && 'word-read',
							piece.word === cursorWord && 'word-next'
						]}
						onclick={() => seekToWord(piece.word)}>{piece.text}</button
					>
				{:else}{piece.text}{/if}
			{/each}
		</p>
	{/each}
	{#if estimated}
		<p class="note">Word highlighting is estimated until aligned timings are added.</p>
	{/if}
</section>

<div class="dock" role="region" aria-label="Audio player">
	{#if status === 'error'}
		<p class="status">Could not load the audio.</p>
	{:else if status === 'loading'}
		<p class="status">Loading audio…</p>
	{/if}
	<div class="controls">
		<button class="skip" type="button" onclick={() => skip(-5)} aria-label="Back 5 seconds">
			<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"
				><path
					d="M11 6V2L5 7l6 5V8c3.3 0 6 2.7 6 6s-2.7 6-6 6-6-2.7-6-6H4c0 4.4 3.6 8 8 8s8-3.6 8-8-3.6-8-8-8z"
					fill="currentColor"
				/></svg
			>
		</button>
		<button
			class="play"
			type="button"
			onclick={togglePlay}
			disabled={status !== 'ready'}
			aria-label={playing ? 'Pause' : 'Play'}
		>
			{#if !playing}
				<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"
					><path d="M8 5v14l11-7z" fill="currentColor" /></svg
				>
			{:else}
				<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"
					><path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor" /></svg
				>
			{/if}
		</button>
		<button class="skip" type="button" onclick={() => skip(5)} aria-label="Forward 5 seconds">
			<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"
				><path
					d="M13 6V2l6 5-6 5V8c-3.3 0-6 2.7-6 6s2.7 6 6 6 6-2.7 6-6h2c0 4.4-3.6 8-8 8s-8-3.6-8-8 3.6-8 8-8z"
					fill="currentColor"
				/></svg
			>
		</button>
	</div>

	<div class="progress">
		<span class="time">{format(current)}</span>
		<input
			type="range"
			min="0"
			max={duration || 0}
			step="0.1"
			value={current}
			oninput={(e) => {
				dragging = true;
				current = Number(e.currentTarget.value);
			}}
			onchange={(e) => {
				dragging = false;
				seek(Number(e.currentTarget.value));
			}}
			aria-label="Seek"
		/>
		<span class="time">{format(duration)}</span>
	</div>

	<div class="row">
		<div class="rates" role="group" aria-label="Playback speed">
			{#each RATES as r (r)}
				<button type="button" class:on={rate === r} onclick={() => setRate(r)}>{r}×</button>
			{/each}
		</div>
		<div class="right">
			<label class="auto">
				<input type="checkbox" bind:checked={autoScroll} />
				Auto-scroll
			</label>
			<div class="settings">
				<button
					type="button"
					class="gear"
					aria-label="Settings"
					aria-haspopup="dialog"
					aria-expanded={settingsOpen}
					bind:this={gearEl}
					onclick={toggleSettings}
				>
					<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"
						><path
							d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
						/><circle
							cx="16"
							cy="6"
							r="2"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						/><circle
							cx="10"
							cy="12"
							r="2"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						/><circle
							cx="8"
							cy="18"
							r="2"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						/></svg
					>
				</button>
			</div>
		</div>
	</div>
</div>

{#if settingsOpen}
	<div
		class="popup"
		role="dialog"
		aria-label="Settings"
		bind:this={popupEl}
		style="left: {popupPos.left}px; bottom: {popupPos.bottom}px"
	>
		<h3>Settings</h3>
		<label class="opt">
			<input type="checkbox" bind:checked={remember} />
			<span>
				Remember position
				<small>Resume each episode where you stopped. Stored in this browser only.</small>
			</span>
		</label>
		<button type="button" class="forget" onclick={clearSavedPositions}>
			Forget saved positions
		</button>
		{#if clearMessage}
			<p class="msg">{clearMessage}</p>
		{/if}
	</div>
{/if}

<style>
	.transcript {
		font-family: ui-serif, Georgia, 'Iowan Old Style', serif;
		font-size: 1.2rem;
		line-height: 2;
		color: #292524;
		max-width: 46rem;
		margin: 0 auto;
		padding: 0 1.25rem 9rem;
		overflow-wrap: anywhere;
	}
	.transcript p {
		margin: 0 0 1.1rem;
	}
	.word {
		font: inherit;
		color: #292524;
		background: none;
		border: 0;
		padding: 0.05em 0.12em;
		margin: 0;
		border-radius: 0.35em;
		cursor: pointer;
		transition:
			background-color 160ms ease,
			color 160ms ease;
	}
	.word:hover {
		background: #fef3c7;
	}
	.word-read {
		color: #a8a29e;
	}
	.word-next {
		box-shadow: inset 0 -0.22em 0 #fcd34d;
	}
	.word-active {
		background: #fcd34d;
		color: #1c1917;
	}
	.note {
		font-family: system-ui, sans-serif;
		font-size: 0.8rem;
		color: #a8a29e;
	}
	.status {
		margin: 0;
		font-size: 0.8rem;
		text-align: center;
		color: #78716c;
	}
	.play:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.dock {
		position: fixed;
		left: 0;
		right: 0;
		margin: 0 auto;
		bottom: 1rem;
		width: min(94vw, 40rem);
		display: grid;
		gap: 0.6rem;
		padding: 0.9rem 1.1rem;
		background: rgba(255, 255, 255, 0.92);
		border: 1px solid #e7e5e4;
		border-radius: 1.25rem;
		box-shadow: 0 12px 40px -12px rgba(120, 53, 15, 0.25);
		font-family: system-ui, sans-serif;
		z-index: 10;
	}
	.controls {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.9rem;
	}
	.play {
		width: 3.1rem;
		height: 3.1rem;
		display: grid;
		place-items: center;
		border-radius: 999px;
		border: 0;
		background: #b45309;
		color: #fff;
		cursor: pointer;
		box-shadow: 0 6px 16px -6px rgba(180, 83, 9, 0.6);
	}
	.skip {
		width: 2.3rem;
		height: 2.3rem;
		display: grid;
		place-items: center;
		border-radius: 999px;
		border: 1px solid #e7e5e4;
		background: #fff;
		color: #57534e;
		cursor: pointer;
	}
	.progress {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.progress input {
		flex: 1;
		accent-color: #b45309;
	}
	.time {
		font-variant-numeric: tabular-nums;
		font-size: 0.8rem;
		color: #78716c;
		min-width: 2.6rem;
		text-align: center;
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.rates {
		display: flex;
		gap: 0.4rem;
	}
	.right {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.settings {
		position: relative;
	}
	.gear {
		width: 2.1rem;
		height: 2.1rem;
		display: grid;
		place-items: center;
		border-radius: 999px;
		border: 1px solid #e7e5e4;
		background: #fff;
		color: #57534e;
		cursor: pointer;
	}
	.gear[aria-expanded='true'] {
		background: #1c1917;
		color: #fff;
		border-color: #1c1917;
	}
	.popup {
		position: fixed;
		z-index: 20;
		width: 18rem;
		box-sizing: border-box;
		padding: 0.9rem 1rem;
		background: #fffdf8;
		border: 1px solid #e7e5e4;
		border-radius: 1rem;
		box-shadow: 0 16px 40px -14px rgba(28, 25, 23, 0.35);
		display: grid;
		gap: 0.7rem;
		color: #1c1917;
	}

	.popup h3 {
		margin: 0;
		font-size: 0.85rem;
		font-weight: 700;
	}
	.opt {
		display: flex;
		gap: 0.6rem;
		align-items: flex-start;
		font-size: 0.85rem;
		cursor: pointer;
	}
	.opt input {
		margin-top: 0.2rem;
		accent-color: #b45309;
	}
	.opt small {
		display: block;
		color: #78716c;
		font-size: 0.75rem;
		margin-top: 0.15rem;
	}
	.forget {
		justify-self: start;
		font-size: 0.8rem;
		padding: 0.35rem 0.7rem;
		border-radius: 0.6rem;
		border: 1px solid #fecaca;
		background: #fef2f2;
		color: #991b1b;
		cursor: pointer;
	}
	.msg {
		margin: 0;
		font-size: 0.75rem;
		color: #78716c;
	}
	.auto {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.8rem;
		color: #57534e;
		cursor: pointer;
		user-select: none;
	}
	.auto input {
		accent-color: #b45309;
	}
	.rates button {
		font-size: 0.8rem;
		padding: 0.25rem 0.6rem;
		border-radius: 999px;
		border: 1px solid #e7e5e4;
		background: #fff;
		color: #57534e;
		cursor: pointer;
	}
	.rates button.on {
		background: #1c1917;
		color: #fff;
		border-color: #1c1917;
	}
</style>
