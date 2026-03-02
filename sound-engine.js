/**
 * Sound Engine for Morse Code Trainer
 * Generates sine wave tones using Web Audio API
 */

class SoundEngine {
    constructor() {
        // Create audio context (will be initialized on first user interaction)
        this.audioContext = null;
        this.masterGain = null;
        this.isInitialized = false;
    }

    /**
     * Initialize the audio context
     * Must be called after user interaction due to browser autoplay policies
     */
    init() {
        if (this.isInitialized) return;

        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // Create master gain node for volume control
        this.masterGain = this.audioContext.createGain();
        this.masterGain.connect(this.audioContext.destination);
        this.masterGain.gain.value = 0.3; // Set volume to 30% to avoid being too loud

        this.activeOscillators = [];
        this.isInitialized = true;
        console.log('Sound engine initialized');
    }

    /**
     * Play a sine wave tone at the specified frequency and duration
     * @param {number} frequency - Frequency in Hz (e.g., 600 for standard morse code)
     * @param {number} duration - Duration in milliseconds
     * @param {number} startTime - When to start (in audio context time, optional)
     * @returns {number} The end time of the tone
     */
    playTone(frequency, duration, startTime = null) {
        if (!this.isInitialized) {
            this.init();
        }

        const currentTime = this.audioContext.currentTime;
        const start = startTime !== null ? startTime : currentTime;
        const end = start + (duration / 1000); // Convert ms to seconds

        // Create oscillator for sine wave
        const oscillator = this.audioContext.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;

        // Create gain node for envelope (attack/release)
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = 0;

        // Connect nodes: oscillator -> gainNode -> masterGain -> destination
        oscillator.connect(gainNode);
        gainNode.connect(this.masterGain);

        // Envelope: quick attack and release to avoid clicks
        const attackTime = 0.005; // 5ms attack
        const releaseTime = 0.005; // 5ms release

        gainNode.gain.setValueAtTime(0, start);
        gainNode.gain.linearRampToValueAtTime(1, start + attackTime);
        gainNode.gain.setValueAtTime(1, end - releaseTime);
        gainNode.gain.linearRampToValueAtTime(0, end);

        // Track oscillator so stopAll() can cancel it; clean up on natural end
        this.activeOscillators.push(oscillator);
        oscillator.addEventListener('ended', () => {
            const idx = this.activeOscillators.indexOf(oscillator);
            if (idx !== -1) this.activeOscillators.splice(idx, 1);
        });

        // Start and stop the oscillator
        oscillator.start(start);
        oscillator.stop(end);

        return end;
    }

    /**
     * Immediately silence and cancel all scheduled/playing oscillators.
     * Ramps master gain to 0 first to avoid a click, then stops oscillators
     * and restores gain for the next playback.
     */
    stopAll() {
        if (!this.audioContext || !this.masterGain) return;
        const now = this.audioContext.currentTime;

        // Ramp master gain to 0 in 10ms to avoid click
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(0.3, now);
        this.masterGain.gain.linearRampToValueAtTime(0, now + 0.01);

        // Stop all tracked oscillators after the ramp completes
        const oscs = this.activeOscillators;
        this.activeOscillators = [];
        oscs.forEach(osc => { try { osc.stop(now + 0.015); } catch (e) {} });

        // Restore gain so the next playback is audible
        this.masterGain.gain.setValueAtTime(0.3, now + 0.02);
    }

    /**
     * Set the master volume
     * @param {number} volume - Volume level (0.0 to 1.0)
     */
    setVolume(volume) {
        if (this.masterGain) {
            this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
        }
    }

    /**
     * Get the current audio context time
     * @returns {number} Current time in seconds
     */
    getCurrentTime() {
        return this.audioContext ? this.audioContext.currentTime : 0;
    }

    /**
     * Resume audio context if suspended (required for some browsers)
     */
    async resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }
}

// Export a singleton instance
const soundEngine = new SoundEngine();
