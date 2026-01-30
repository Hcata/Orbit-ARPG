export class SoundManager {
    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private musicElement: HTMLAudioElement | null = null;
    private musicGain: GainNode | null = null;

    constructor() { }

    private init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.masterGain.gain.value = 0.7; // Increased from 0.3
    }

    private playNoise(duration: number, volume: number, type: 'explosion' | 'laser' | 'collect' | 'fanfare' | 'death') {
        this.init();
        if (!this.ctx || !this.masterGain) return;

        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const noiseFilter = this.ctx.createBiquadFilter();
        const noiseGain = this.ctx.createGain();

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.masterGain);

        const now = this.ctx.currentTime;

        switch (type) {
            case 'explosion':
                noiseFilter.type = 'lowpass';
                noiseFilter.frequency.setValueAtTime(1000, now);
                noiseFilter.frequency.exponentialRampToValueAtTime(10, now + duration);
                noiseGain.gain.setValueAtTime(volume * 2, now); // Doubled volume
                noiseGain.gain.exponentialRampToValueAtTime(0.01, now + duration);
                break;
            case 'death':
                noiseFilter.type = 'lowpass';
                noiseFilter.frequency.setValueAtTime(1500, now);
                noiseFilter.frequency.exponentialRampToValueAtTime(20, now + duration * 1.5);
                noiseGain.gain.setValueAtTime(volume * 2.5, now); // Increased volume
                noiseGain.gain.exponentialRampToValueAtTime(0.01, now + duration * 1.5);
                break;
        }

        noise.start();
        noise.stop(now + duration * 2);
    }

    public playLaser() {
        this.init();
        if (!this.ctx || !this.masterGain) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.2);

        gain.gain.setValueAtTime(0.5, now); // Increased from 0.2
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(now + 0.2);

        // Add a bit of noise for the "rock" impact
        this.playNoise(0.1, 0.3, 'explosion'); // Increased from 0.1
    }

    public playExplosion() {
        this.playNoise(0.5, 0.8, 'explosion'); // Increased from 0.5
    }

    public playDeath() {
        this.playNoise(1.0, 1.2, 'death'); // Increased from 0.8
    }

    public playCollect() {
        this.init();
        if (!this.ctx || !this.masterGain) return;
        const now = this.ctx.currentTime;
        const notes = [880, 1320, 1760]; // A5, E6, A6
        notes.forEach((freq, i) => {
            const osc = this.ctx!.createOscillator();
            const gain = this.ctx!.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.05);
            gain.gain.setValueAtTime(0.3, now + i * 0.05); // Increased from 0.1
            gain.gain.exponentialRampToValueAtTime(0.01, now + (i + 1) * 0.15);
            osc.connect(gain);
            gain.connect(this.masterGain!);
            osc.start(now + i * 0.05);
            osc.stop(now + (i + 1) * 0.15);
        });
    }

    public playFanfare() {
        this.init();
        if (!this.ctx || !this.masterGain) return;
        const now = this.ctx.currentTime;
        const melody = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        melody.forEach((freq, i) => {
            const osc = this.ctx!.createOscillator();
            const gain = this.ctx!.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, now + i * 0.1);
            gain.gain.setValueAtTime(0.15, now + i * 0.1); // Increased from 0.05
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.2);
            osc.connect(gain);
            gain.connect(this.masterGain!);
            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.2);
        });
    }

    public startMusic() {
        this.init();
        if (!this.ctx || !this.masterGain) return;

        // Stop any existing music
        if (this.musicElement) {
            this.musicElement.pause();
            this.musicElement = null;
        }

        // Create HTML audio element for MP3
        this.musicElement = new Audio('music/0-top-battle-game-bgm-264625.mp3');
        this.musicElement.loop = true;
        this.musicElement.volume = 0.4; // Adjust volume (0.0 to 1.0)

        // Play the music
        this.musicElement.play().catch(err => {
            console.warn('Could not play background music:', err);
        });
    }

    public stopMusic() {
        if (this.musicElement) {
            this.musicElement.pause();
            this.musicElement.currentTime = 0;
        }
    }
}

export const soundManager = new SoundManager();
