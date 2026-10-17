// Audio playback on the Web Audio API with Signalsmith Stretch (MIT), which changes tempo without changing pitch.
// The position is computed from AudioContext.currentTime, which is sample-accurate, so the highlight
// does not depend on the <audio> element's coarse timeupdate events.
// Trade-off: the whole file is decoded and copied into memory.

import SignalsmithStretch from 'signalsmith-stretch';

type StretchNode = AudioNode & {
	addBuffers: (buffers: Float32Array[]) => Promise<number>;
	schedule: (change: { output?: number; input?: number; rate?: number; active?: boolean }) => void;
};

export class WebAudioPlayer {
	private ctx: AudioContext | null = null;
	private node: StretchNode | null = null;
	private anchorPos = 0; // position in the file (seconds) at anchorTime
	private anchorTime = 0; // AudioContext time at which anchorPos was valid
	private rate = 1;
	private endedHandler: (() => void) | null = null;
	private length = 0;

	playing = false;

	constructor(private url: string) {}

	async load(): Promise<number> {
		const res = await fetch(this.url);
		if (!res.ok) throw new Error(`Audio request failed: HTTP ${res.status}`);
		const data = await res.arrayBuffer();
		const ctx = new AudioContext();
		const decoded = await ctx.decodeAudioData(data);
		const left = decoded.getChannelData(0);
		const right = decoded.numberOfChannels > 1 ? decoded.getChannelData(1) : left;
		this.length = decoded.duration;

		this.node = (await SignalsmithStretch(ctx)) as StretchNode;
		// One buffer call: the worklet throws on chunked uploads (equal-length pieces did not play either).
		await this.node.addBuffers([left.slice(), right.slice()]);
		this.node.connect(ctx.destination);
		this.ctx = ctx;
		return this.length;
	}

	get duration(): number {
		return this.length;
	}

	// Current position in seconds, corrected for the output latency so it matches what is heard.
	// Also detects the end of the file, since the stretch node does not report it.
	update(): number {
		if (!this.ctx) return 0;
		if (!this.playing) return this.anchorPos;
		const latency = this.ctx.outputLatency ?? this.ctx.baseLatency ?? 0;
		const p = this.anchorPos + (this.ctx.currentTime - latency - this.anchorTime) * this.rate;
		if (p >= this.length) {
			this.anchorPos = this.length;
			this.stop();
			this.endedHandler?.();
			return this.length;
		}
		return Math.max(this.anchorPos, p);
	}

	onEnded(handler: () => void) {
		this.endedHandler = handler;
	}

	// Synchronous on purpose: callers rely on `playing` being true right after play() is called.
	play() {
		if (!this.ctx || !this.node || this.playing) return;
		void this.ctx.resume();
		if (this.anchorPos >= this.length - 0.05) this.anchorPos = 0;
		this.anchorTime = this.ctx.currentTime;
		this.node.schedule({
			output: this.anchorTime,
			input: this.anchorPos,
			rate: this.rate,
			active: true
		});
		this.playing = true;
	}

	pause() {
		if (!this.playing) return;
		this.anchorPos = this.update();
		this.stop();
	}

	seek(t: number) {
		const target = Math.min(this.length, Math.max(0, t));
		if (this.playing && this.ctx && this.node) {
			this.anchorPos = target;
			this.anchorTime = this.ctx.currentTime;
			this.node.schedule({ output: this.anchorTime, input: target, rate: this.rate, active: true });
		} else {
			this.anchorPos = target;
		}
	}

	setRate(rate: number) {
		if (this.playing && this.ctx && this.node) {
			this.anchorPos = this.update();
			this.anchorTime = this.ctx.currentTime;
			this.node.schedule({ output: this.anchorTime, input: this.anchorPos, rate, active: true });
		}
		this.rate = rate;
	}

	dispose() {
		this.stop();
		this.node?.disconnect();
		void this.ctx?.close();
		this.ctx = null;
		this.node = null;
	}

	private stop() {
		if (!this.playing) return;
		this.playing = false;
		this.node?.schedule({ output: this.ctx?.currentTime ?? 0, active: false });
	}
}
