/** Fanfarria de victoria generada con Web Audio API (sin archivos externos). */
export function playVictoryFanfare() {
  if (typeof window === 'undefined') return;

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;

  let ctx;
  try {
    ctx = new AudioCtx();
  } catch {
    return;
  }

  const run = () => {
    const t0 = ctx.currentTime;
    const notes = [
      { freq: 261.63, at: 0, dur: 0.28 },
      { freq: 329.63, at: 0.22, dur: 0.28 },
      { freq: 392.0, at: 0.44, dur: 0.28 },
      { freq: 523.25, at: 0.66, dur: 0.32 },
      { freq: 659.25, at: 0.92, dur: 0.55 },
      { freq: 783.99, at: 1.2, dur: 0.85 },
    ];

    notes.forEach(({ freq, at, dur }) => {
      const start = t0 + at;
      const stop = start + dur + 0.08;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, start);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(freq * 2.2, start);
      filter.Q.setValueAtTime(4.5, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.22, start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, stop);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(stop);
    });

    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 2800);
  };

  if (ctx.state === 'suspended') {
    ctx.resume().then(run).catch(() => {});
  } else {
    run();
  }
}
