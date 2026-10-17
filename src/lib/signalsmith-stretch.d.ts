// The package ships without types. This is the subset the player uses; see node_modules/signalsmith-stretch/README.md.
declare module 'signalsmith-stretch' {
	const SignalsmithStretch: (
		ctx: BaseAudioContext,
		options?: AudioWorkletNodeOptions
	) => Promise<AudioNode>;
	export default SignalsmithStretch;
}
