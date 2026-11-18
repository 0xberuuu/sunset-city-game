// All sound is synthesized with the WebAudio API: engine hum, sirens,
// gunshots, pickups and a small procedural music loop. No audio files.

export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    muted: false,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    musicTimer: 0,
    musicStep: 0,
    started: false,
  };

  function ensure() {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      return true;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audio.ctx = new Ctx();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.5;
      audio.master.connect(audio.ctx.destination);
      audio.started = true;
      return true;
    } catch {
      return false;
    }
  }

  function noiseBuffer(seconds) {
    const len = Math.floor(audio.ctx.sampleRate * seconds);
    const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function burst({ duration, frequency, type, gain, slideTo, noise, filterFreq }) {
    if (!ensure() || audio.muted) return;
    const t = audio.ctx.currentTime;
    const out = audio.ctx.createGain();
    out.gain.setValueAtTime(gain, t);
    out.gain.exponentialRampToValueAtTime(0.001, t + duration);
    let source;
    if (noise) {
      source = audio.ctx.createBufferSource();
      source.buffer = noiseBuffer(duration);
      const filter = audio.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq || 1200;
      source.connect(filter);
      filter.connect(out);
    } else {
      source = audio.ctx.createOscillator();
      source.type = type || 'sine';
      source.frequency.setValueAtTime(frequency, t);
      if (slideTo) source.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
      source.connect(out);
    }
    out.connect(audio.master);
    source.start(t);
    source.stop(t + duration + 0.02);
  }

  function note(frequency, start, duration, type, gain) {
    const t = audio.ctx.currentTime + start;
    const osc = audio.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    const g = audio.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(g);
    g.connect(audio.master);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  return {
    unlock() { ensure(); },
    get ready() { return audio.started; },
    toggleMute() {
      audio.muted = !audio.muted;
      if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.5;
      return audio.muted;
    },

    shoot(big) {
      burst({ duration: 0.14, gain: 0.5, noise: true, filterFreq: big ? 900 : 2200 });
      burst({ duration: 0.07, frequency: 180, slideTo: 60, type: 'square', gain: 0.25 });
    },
    punch() { burst({ duration: 0.08, gain: 0.35, noise: true, filterFreq: 500 }); },
    crash(strength) {
      burst({ duration: 0.22, gain: Math.min(0.6, 0.2 + strength), noise: true, filterFreq: 700 });
    },
    skid() { burst({ duration: 0.3, gain: 0.08, noise: true, filterFreq: 3200 }); },
    horn() { burst({ duration: 0.35, frequency: 370, type: 'square', gain: 0.12 }); },
    pickup() {
      if (!ensure() || audio.muted) return;
      note(660, 0, 0.12, 'sine', 0.25);
      note(880, 0.08, 0.16, 'sine', 0.25);
    },
    cash() {
      if (!ensure() || audio.muted) return;
      note(880, 0, 0.1, 'triangle', 0.3);
      note(1174, 0.07, 0.12, 'triangle', 0.3);
      note(1568, 0.14, 0.2, 'triangle', 0.3);
    },
    missionDone() {
      if (!ensure() || audio.muted) return;
      const seq = [523, 659, 784, 1046];
      seq.forEach((f, i) => note(f, i * 0.11, 0.22, 'triangle', 0.3));
    },
    missionFail() {
      if (!ensure() || audio.muted) return;
      note(392, 0, 0.25, 'sawtooth', 0.18);
      note(311, 0.22, 0.35, 'sawtooth', 0.18);
    },
    busted() {
      if (!ensure() || audio.muted) return;
      note(440, 0, 0.2, 'square', 0.15);
      note(440, 0.25, 0.2, 'square', 0.15);
      note(330, 0.5, 0.4, 'square', 0.15);
    },
    click() { burst({ duration: 0.05, frequency: 700, type: 'sine', gain: 0.15 }); },
    explosion() {
      burst({ duration: 0.8, gain: 0.7, noise: true, filterFreq: 300 });
      burst({ duration: 0.5, frequency: 90, slideTo: 30, type: 'sine', gain: 0.5 });
    },
    door() { burst({ duration: 0.09, gain: 0.3, noise: true, filterFreq: 800 }); },

    setEngine(running, speedNorm) {
      if (!ensure()) return;
      if (!audio.engineOsc) {
        audio.engineOsc = audio.ctx.createOscillator();
        audio.engineOsc.type = 'sawtooth';
        const filter = audio.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        audio.engineGain = audio.ctx.createGain();
        audio.engineGain.gain.value = 0;
        audio.engineOsc.connect(filter);
        filter.connect(audio.engineGain);
        audio.engineGain.connect(audio.master);
        audio.engineOsc.start();
      }
      const target = running && !audio.muted ? 0.05 + speedNorm * 0.06 : 0;
      audio.engineGain.gain.setTargetAtTime(target, audio.ctx.currentTime, 0.1);
      audio.engineOsc.frequency.setTargetAtTime(55 + speedNorm * 130, audio.ctx.currentTime, 0.08);
    },

    setSiren(on) {
      if (!ensure()) return;
      if (!audio.sirenOsc) {
        audio.sirenOsc = audio.ctx.createOscillator();
        audio.sirenOsc.type = 'triangle';
        audio.sirenGain = audio.ctx.createGain();
        audio.sirenGain.gain.value = 0;
        const lfo = audio.ctx.createOscillator();
        lfo.frequency.value = 1.4;
        const lfoGain = audio.ctx.createGain();
        lfoGain.gain.value = 220;
        lfo.connect(lfoGain);
        lfoGain.connect(audio.sirenOsc.frequency);
        audio.sirenOsc.frequency.value = 780;
        audio.sirenOsc.connect(audio.sirenGain);
        audio.sirenGain.connect(audio.master);
        audio.sirenOsc.start();
        lfo.start();
      }
      audio.sirenGain.gain.setTargetAtTime(on && !audio.muted ? 0.045 : 0, audio.ctx.currentTime, 0.2);
    },

    // A slow original loop: warm pad chords with a walking bass line.
    updateMusic(dt, playing) {
      if (!ensure() || audio.muted || !playing) return;
      audio.musicTimer -= dt;
      if (audio.musicTimer > 0) return;
      audio.musicTimer = 0.42;
      const chords = [
        [220.0, 261.6, 329.6], // Am
        [174.6, 220.0, 261.6], // F
        [196.0, 246.9, 293.7], // G
        [164.8, 220.0, 261.6], // Em-ish
      ];
      const bass = [110.0, 87.3, 98.0, 82.4];
      const step = audio.musicStep % 16;
      const chord = chords[Math.floor(audio.musicStep / 4) % 4];
      if (step % 4 === 0) {
        chord.forEach((f) => note(f, 0, 1.5, 'triangle', 0.05));
        note(bass[Math.floor(audio.musicStep / 4) % 4], 0, 0.5, 'sine', 0.12);
      }
      if (step === 6 || step === 14) {
        note(chord[2] * 2, 0, 0.3, 'sine', 0.05);
      }
      audio.musicStep++;
    },
  };
}
