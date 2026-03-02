/**
 * Morse Code Player
 * Converts characters to morse code and plays them using the SoundEngine
 */

const MORSE_CODE = {
    'A': '.-',   'B': '-...', 'C': '-.-.', 'D': '-..',  'E': '.',
    'F': '..-.', 'G': '--.',  'H': '....', 'I': '..',   'J': '.---',
    'K': '-.-',  'L': '.-..', 'M': '--',   'N': '-.',   'O': '---',
    'P': '.--.', 'Q': '--.-', 'R': '.-.',  'S': '...',  'T': '-',
    'U': '..-',  'V': '...-', 'W': '.--',  'X': '-..-', 'Y': '-.--',
    'Z': '--..',
    '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
    '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
};

class MorsePlayer {
    constructor(soundEngine) {
        this.soundEngine = soundEngine;
        this.wpm = 5;       // Words per minute
        this.frequency = 600; // Hz
    }

    /** Dot duration in milliseconds based on WPM (standard PARIS timing) */
    get dotMs() {
        return 1200 / this.wpm;
    }

    /**
     * Play morse code for a single character
     * @param {string} character - The character to play (A-Z, 0-9)
     * @returns {Promise} Resolves when playback finishes
     */
    async play(character) {
        const code = MORSE_CODE[character.toUpperCase()];
        if (!code) return;

        this.soundEngine.init();
        await this.soundEngine.resume();

        const dotMs = this.dotMs;
        const dashMs = dotMs * 3;
        const elementGapSec = dotMs / 1000;

        let time = this.soundEngine.getCurrentTime();
        let endTime = time;

        for (let i = 0; i < code.length; i++) {
            const durationMs = code[i] === '.' ? dotMs : dashMs;
            endTime = this.soundEngine.playTone(this.frequency, durationMs, time);
            time = endTime;
            if (i < code.length - 1) {
                time += elementGapSec; // gap between elements
            }
        }

        // Resolve when playback finishes
        const remainingMs = (endTime - this.soundEngine.getCurrentTime()) * 1000;
        return new Promise(resolve => setTimeout(resolve, Math.max(0, remainingMs)));
    }

    /** Returns the morse pattern string for a character (e.g. ".-" for A) */
    getMorsePattern(character) {
        return MORSE_CODE[character.toUpperCase()] || null;
    }

    /** Returns all supported characters */
    getCharacters() {
        return Object.keys(MORSE_CODE);
    }

    /** Returns only letters (A-Z) */
    getLetters() {
        return Object.keys(MORSE_CODE).filter(c => c >= 'A' && c <= 'Z');
    }

    /** Returns only digits (0-9) */
    getDigits() {
        return Object.keys(MORSE_CODE).filter(c => c >= '0' && c <= '9');
    }
}

const morsePlayer = new MorsePlayer(soundEngine);
