export class AlertAudio {
  constructor() {
    this.ctx = null;
    this.alarmInterval = null;
    this.volume = 0.7;
  }

  ensureCtx() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  beep(freq, dur, base, type = "sine") {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const vol = base * this.volume;
    if (vol <= 0) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  playSoft() {
    this.beep(660, 0.28, 0.16, "sine");
  }

  playAlarmPulse() {
    this.beep(900, 0.16, 0.3, "square");
    setTimeout(() => this.beep(680, 0.18, 0.3, "square"), 190);
  }

  startAlarm() {
    this.stopAlarm();
    this.playAlarmPulse();
    this.alarmInterval = setInterval(() => this.playAlarmPulse(), 850);
  }

  stopAlarm() {
    if (this.alarmInterval) {
      clearInterval(this.alarmInterval);
      this.alarmInterval = null;
    }
  }

  playDisconnect() {
    this.beep(500, 0.18, 0.14, "sine");
    setTimeout(() => this.beep(360, 0.28, 0.14, "sine"), 160);
  }

  dispose() {
    this.stopAlarm();
    if (this.ctx) this.ctx.close?.();
    this.ctx = null;
  }
}
