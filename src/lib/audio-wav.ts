/** Convert any browser-recorded audio blob (e.g. webm/opus) to PCM WAV. */

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i += 1) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function floatTo16BitPCM(view: DataView, offset: number, input: Float32Array) {
  let pos = offset;
  for (let i = 0; i < input.length; i += 1, pos += 2) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(pos, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
}

function interleaveChannels(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) {
    return buffer.getChannelData(0);
  }
  const length = buffer.length * buffer.numberOfChannels;
  const result = new Float32Array(length);
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) =>
    buffer.getChannelData(i),
  );
  let offset = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    for (let ch = 0; ch < channels.length; ch += 1) {
      result[offset] = channels[ch][i];
      offset += 1;
    }
  }
  return result;
}

function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const interleaved = interleaveChannels(buffer);
  const dataLength = interleaved.length * bytesPerSample;
  const headerLength = 44;
  const arrayBuffer = new ArrayBuffer(headerLength + dataLength);
  const view = new DataView(arrayBuffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);
  floatTo16BitPCM(view, 44, interleaved);

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Decode a recorded blob (webm/opus, mp4, etc.) and re-encode as audio/wav.
 */
export async function convertBlobToWav(audioBlob: Blob): Promise<File> {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioContext = new AudioCtx();

  try {
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const wavBlob = audioBufferToWavBlob(audioBuffer);
    return new File([wavBlob], 'voice-clone.wav', { type: 'audio/wav' });
  } finally {
    await audioContext.close().catch(() => {});
  }
}
