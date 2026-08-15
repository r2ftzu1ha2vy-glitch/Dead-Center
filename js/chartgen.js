/* =========================================================
   Chart Generator
   Analyzes an mp3's audio buffer using onset/energy detection
   (spectral flux over an offline-decoded buffer) to place notes
   that follow the song's actual rhythm & intensity — no manual
   authoring required.

   Output chart format (array of notes), matching spec:
     { type: "normal" | "curve_left" | "curve_right" | "double", time: seconds }
   ========================================================= */

const ChartGen = (function () {

  const NOTE_TYPES = ["normal", "curve_left", "curve_right", "double"];

  async function decodeAudio(url) {
    const resp = await fetch(url);
    const arrayBuffer = await resp.arrayBuffer();
    const AudioCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    // Decode using a throwaway online context (decodeAudioData works on both)
    const decodeCtx = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
    decodeCtx.close();
    return audioBuffer;
  }

  // Compute a spectral-flux based onset strength envelope
  function computeOnsetEnvelope(audioBuffer) {
    const sampleRate = audioBuffer.sampleRate;
    const channelData = audioBuffer.numberOfChannels > 1
      ? mixToMono(audioBuffer)
      : audioBuffer.getChannelData(0);

    const fftSize = 1024;
    const hopSize = 512;
    const numFrames = Math.floor((channelData.length - fftSize) / hopSize);

    const window_ = hannWindow(fftSize);
    let prevSpectrum = new Float32Array(fftSize / 2);
    const envelope = new Float32Array(numFrames);
    const times = new Float32Array(numFrames);

    for (let frame = 0; frame < numFrames; frame++) {
      const start = frame * hopSize;
      const real = new Float32Array(fftSize);
      for (let i = 0; i < fftSize; i++) {
        real[i] = channelData[start + i] * window_[i];
      }
      const spectrum = magnitudeSpectrum(real, fftSize);

      // spectral flux: sum of positive differences
      let flux = 0;
      for (let i = 0; i < spectrum.length; i++) {
        const diff = spectrum[i] - prevSpectrum[i];
        if (diff > 0) flux += diff;
      }
      envelope[frame] = flux;
      times[frame] = start / sampleRate;
      prevSpectrum = spectrum;
    }

    return { envelope, times, hopSize, sampleRate };
  }

  function mixToMono(audioBuffer) {
    const len = audioBuffer.length;
    const out = new Float32Array(len);
    const chs = audioBuffer.numberOfChannels;
    for (let c = 0; c < chs; c++) {
      const data = audioBuffer.getChannelData(c);
      for (let i = 0; i < len; i++) out[i] += data[i] / chs;
    }
    return out;
  }

  function hannWindow(size) {
    const w = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
    }
    return w;
  }

  // Simple radix-2 FFT magnitude spectrum
  function magnitudeSpectrum(real, size) {
    const im = new Float32Array(size);
    fft(real, im);
    const half = size / 2;
    const mag = new Float32Array(half);
    for (let i = 0; i < half; i++) {
      mag[i] = Math.sqrt(real[i] * real[i] + im[i] * im[i]);
    }
    return mag;
  }

  function fft(re, im) {
    const n = re.length;
    if (n <= 1) return;
    // bit reversal
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        [re[i], re[j]] = [re[j], re[i]];
        [im[i], im[j]] = [im[j], im[i]];
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (-2 * Math.PI) / len;
      const wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let curWr = 1, curWi = 0;
        for (let j = 0; j < len / 2; j++) {
          const ur = re[i + j], ui = im[i + j];
          const vr = re[i + j + len / 2] * curWr - im[i + j + len / 2] * curWi;
          const vi = re[i + j + len / 2] * curWi + im[i + j + len / 2] * curWr;
          re[i + j] = ur + vr;
          im[i + j] = ui + vi;
          re[i + j + len / 2] = ur - vr;
          im[i + j + len / 2] = ui - vi;
          const nWr = curWr * wr - curWi * wi;
          const nWi = curWr * wi + curWi * wr;
          curWr = nWr;
          curWi = nWi;
        }
      }
    }
  }

  // Adaptive peak-picking over the onset envelope
  function pickPeaks(envelope, times, minGapSeconds) {
    // normalize
    let max = 0;
    for (let i = 0; i < envelope.length; i++) max = Math.max(max, envelope[i]);
    if (max <= 0) return [];
    const norm = Array.from(envelope, (v) => v / max);

    // local moving average threshold
    const windowSize = 8;
    const peaks = [];
    let lastPeakTime = -Infinity;

    for (let i = 2; i < norm.length - 2; i++) {
      const lo = Math.max(0, i - windowSize);
      const hi = Math.min(norm.length, i + windowSize);
      let sum = 0;
      for (let k = lo; k < hi; k++) sum += norm[k];
      const localAvg = sum / (hi - lo);
      const threshold = localAvg * 1.5 + 0.05;

      const isLocalMax = norm[i] > norm[i - 1] && norm[i] >= norm[i + 1];

      if (isLocalMax && norm[i] > threshold) {
        const t = times[i];
        if (t - lastPeakTime >= minGapSeconds) {
          peaks.push({ time: t, strength: norm[i] });
          lastPeakTime = t;
        }
      }
    }
    return peaks;
  }

  // Assign note types based on local intensity & sequence position
  function assignNoteTypes(peaks) {
    const notes = [];
    let rng = mulberry32(peaks.length * 7919 + 13);

    for (let i = 0; i < peaks.length; i++) {
      const p = peaks[i];
      let type = "normal";

      // High-strength hits are more likely to be "double" (harder)
      // moderate hits alternate curves for variety, driven by intensity + position
      if (p.strength > 0.82 && rng() < 0.5) {
        type = "double";
      } else if (p.strength > 0.55) {
        type = rng() < 0.5 ? "curve_left" : "curve_right";
      } else {
        // low-medium strength: mostly normal, occasional curve for flow
        type = rng() < 0.75 ? "normal" : (rng() < 0.5 ? "curve_left" : "curve_right");
      }

      notes.push({ type, time: roundTime(p.time) });
    }
    return notes;
  }

  function roundTime(t) {
    return Math.round(t * 1000) / 1000;
  }

  // deterministic PRNG so charts are stable across sessions for same song
  function mulberry32(seed) {
    let a = seed;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function estimateDifficultyGap(durationSeconds) {
    // baseline minimum gap between notes, tuned for playability
    if (durationSeconds < 90) return 0.55;
    return 0.42;
  }

  async function generateChart(song) {
    try {
      const audioBuffer = await decodeAudio(song.url);
      const { envelope, times } = computeOnsetEnvelope(audioBuffer);
      const minGap = estimateDifficultyGap(audioBuffer.duration);
      const peaks = pickPeaks(envelope, times, minGap);
      let notes = assignNoteTypes(peaks);

      // trim: no notes in first 1.2s (spawn/travel buffer) or last 1s
      notes = notes.filter((n) => n.time > 1.2 && n.time < audioBuffer.duration - 1.0);

      return {
        duration: audioBuffer.duration,
        notes,
      };
    } catch (err) {
      console.warn("Chart generation failed for", song.filename, err);
      return { duration: 0, notes: [] };
    }
  }

  return { generateChart };
})();
