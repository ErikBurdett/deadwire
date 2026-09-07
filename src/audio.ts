export class FieldAudio {
  ctx: AudioContext | null = null;
  volume = 0.25;
  private ambient: GainNode | null = null;
  private lastStep = 0;
  start() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      const ctx = this.ctx,
        buffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate),
        data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.16;
      const wind = ctx.createBufferSource();
      wind.buffer = buffer;
      wind.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 280;
      this.ambient = ctx.createGain();
      this.ambient.gain.value = 0.1;
      wind.connect(filter).connect(this.ambient).connect(ctx.destination);
      wind.start();
    }
    void this.ctx.resume();
  }
  tone(frequency: number, duration = 0.12, gain = 0.15, type: OscillatorType = 'sine') {
    if (!this.ctx) return;
    const ctx = this.ctx,
      t = ctx.currentTime,
      osc = ctx.createOscillator(),
      g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, frequency * 0.4), t + duration);
    g.gain.setValueAtTime(gain * this.volume, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g).connect(ctx.destination);
    osc.start();
    osc.stop(t + duration);
  }
  shot(enemy = false, suppressed = false) {
    if (!this.ctx) return;
    const ctx = this.ctx,
      t = ctx.currentTime,
      buffer = ctx.createBuffer(1, ctx.sampleRate * 0.14, ctx.sampleRate),
      data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / 1600);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = suppressed ? 450 : 2200;
    const gain = ctx.createGain();
    gain.gain.value = this.volume * (enemy ? 0.32 : suppressed ? 0.45 : 1);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(t);
    this.tone(enemy ? 65 : 90, 0.13, enemy ? 0.3 : 0.65, 'triangle');
  }
  step(time: number, sprint: boolean) {
    if (time - this.lastStep > (sprint ? 0.28 : 0.42)) {
      this.tone(55, 0.07, 0.1, 'triangle');
      this.lastStep = time;
    }
  }
  event(kind: string, suppressed: boolean) {
    if (kind === 'shot') this.shot(false, suppressed);
    else if (kind === 'enemyShot') this.shot(true);
    else if (kind === 'loot') this.tone(740, 0.17, 0.4);
    else if (kind === 'hit') this.tone(1200, 0.06, 0.5);
    else if (kind === 'damage') this.tone(50, 0.2, 0.6, 'sawtooth');
    else if (kind === 'reloadStart') this.tone(450, 0.15, 0.2, 'square');
    else if (kind === 'extracted') this.tone(800, 0.6, 0.4);
  }
}
