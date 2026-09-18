/* eslint-disable no-undef -- Web Audio / MediaStream globals are missing from the lint config */
/**
 * Real-time background noise removal for microphone capture, using RNNoise compiled to
 * WASM and run in an AudioWorklet.
 *
 * Pipeline: microphone track → MediaStreamSource → RNNoise worklet → MediaStreamDestination.
 * The returned stream is what callers hand to MediaRecorder, so the cleaned audio is what
 * gets recorded and uploaded — never the raw microphone.
 *
 * Degrades quietly: if the browser has no AudioWorklet, the worklet bundle is missing, or
 * anything throws, the original microphone stream is returned unchanged so recording still
 * works. Callers check `enabled` if they want to say so in the UI.
 *
 * The worklet script is built from `@timephy/rnnoise-wasm` into /worklets/rnnoise-worklet.js
 * by scripts/build-rnnoise-worklet.mjs (npm run build:worklets).
 */

/** Processor name registered inside the worklet bundle. */
const WORKLET_PROCESSOR = 'NoiseSuppressorWorklet';
const WORKLET_URL = '/worklets/rnnoise-worklet.js';
/** RNNoise models are trained at 48 kHz; matching it avoids resampling artefacts. */
const RNNOISE_SAMPLE_RATE = 48000;

export type NoiseSuppressedStream = {
  /** Feed this to MediaRecorder — cleaned when `enabled`, the raw mic otherwise. */
  stream: MediaStream;
  /** False when suppression could not be set up (unsupported browser, load failure). */
  enabled: boolean;
  /**
   * Tears down the audio graph and stops every track, including the source mic tracks.
   * Safe to call more than once.
   */
  stop: () => Promise<void>;
};

/** getUserMedia constraints that pair well with RNNoise (its own denoiser handles the rest). */
export const NOISE_SUPPRESSED_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  // Browser-native cleanup still helps with echo/gain; RNNoise removes what it leaves.
  echoCancellation: true,
  autoGainControl: true,
  noiseSuppression: true,
  channelCount: 1,
};

function audioContextCtor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  const w = window as typeof window & { webkitAudioContext?: typeof AudioContext };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Whether this browser can run the worklet at all. */
export function noiseSuppressionSupported(): boolean {
  const Ctor = audioContextCtor();
  if (!Ctor) return false;
  return typeof AudioWorkletNode !== 'undefined' && 'audioWorklet' in Ctor.prototype;
}

/** Module-level cache: the 1.8 MB worklet only needs fetching and compiling once per context. */
const loadedContexts = new WeakSet<AudioContext>();

async function addWorkletModule(ctx: AudioContext): Promise<void> {
  if (loadedContexts.has(ctx)) return;
  await ctx.audioWorklet.addModule(WORKLET_URL);
  loadedContexts.add(ctx);
}

/**
 * Wraps a microphone stream in RNNoise suppression.
 * Always resolves — never throws — so a failure here can't block recording.
 */
export async function createNoiseSuppressedStream(
  source: MediaStream,
): Promise<NoiseSuppressedStream> {
  const stopSourceTracks = () => source.getTracks().forEach((t) => t.stop());

  if (!noiseSuppressionSupported()) {
    return {
      stream: source,
      enabled: false,
      stop: async () => stopSourceTracks(),
    };
  }

  const Ctor = audioContextCtor()!;
  let ctx: AudioContext | null = null;
  let sourceNode: MediaStreamAudioSourceNode | null = null;
  let worklet: AudioWorkletNode | null = null;
  let destination: MediaStreamAudioDestinationNode | null = null;

  try {
    ctx = new Ctor({ sampleRate: RNNOISE_SAMPLE_RATE });
    // Autoplay policies can start a context suspended even after a user gesture.
    if (ctx.state === 'suspended') await ctx.resume();

    await addWorkletModule(ctx);

    sourceNode = ctx.createMediaStreamSource(source);
    worklet = new AudioWorkletNode(ctx, WORKLET_PROCESSOR, {
      channelCount: 1,
      channelCountMode: 'explicit',
      numberOfInputs: 1,
      numberOfOutputs: 1,
    });
    destination = ctx.createMediaStreamDestination();

    // Mic → RNNoise → destination. Nothing is connected to ctx.destination, so the
    // user never hears themselves while recording.
    sourceNode.connect(worklet).connect(destination);

    const cleaned = destination.stream;
    let stopped = false;

    return {
      stream: cleaned,
      enabled: true,
      stop: async () => {
        if (stopped) return;
        stopped = true;
        try {
          sourceNode?.disconnect();
          worklet?.disconnect();
          destination?.disconnect();
        } catch {
          /* already torn down */
        }
        cleaned.getTracks().forEach((t) => t.stop());
        stopSourceTracks();
        try {
          await ctx?.close();
        } catch {
          /* context may already be closed */
        }
      },
    };
  } catch (err) {
    console.warn('[noise-suppression] falling back to the raw microphone', err);
    try {
      sourceNode?.disconnect();
      worklet?.disconnect();
      destination?.disconnect();
      await ctx?.close();
    } catch {
      /* ignore */
    }
    return {
      stream: source,
      enabled: false,
      stop: async () => stopSourceTracks(),
    };
  }
}
