/**
 * Morse Code Quiz — state machine
 * States: session-start | playing | awaiting | feedback | session-end
 */

document.addEventListener('DOMContentLoaded', () => {

    // --- Elements ---
    const screenStart = document.getElementById('screen-start');
    const screenQuiz  = document.getElementById('screen-quiz');
    const screenEnd   = document.getElementById('screen-end');

    const sModeSingle    = document.getElementById('s-mode-single');
    const sModeMulti     = document.getElementById('s-mode-multi');
    const sCharsPerQRow  = document.getElementById('s-charsPerQ-row');
    const sCharsPerQ     = document.getElementById('s-charsPerQ');
    const sCharsPerQVal  = document.getElementById('s-charsPerQVal');
    const sQuestions     = document.getElementById('s-questions');
    const sQuestionsVal  = document.getElementById('s-questionsVal');
    const sWpm           = document.getElementById('s-wpm');
    const sWpmVal        = document.getElementById('s-wpmVal');
    const sFreq          = document.getElementById('s-freq');
    const sFreqVal       = document.getElementById('s-freqVal');
    const sTimelimit     = document.getElementById('s-timelimit');
    const sTimelimitVal  = document.getElementById('s-timelimitVal');
    const sLetters       = document.getElementById('s-letters');
    const sDigits        = document.getElementById('s-digits');
    const startSessionBtn = document.getElementById('startSessionBtn');

    const questionNumEl  = document.getElementById('questionNum');
    const questionTotalEl = document.getElementById('questionTotal');
    const scoreEl        = document.getElementById('score');
    const streakEl       = document.getElementById('streak');
    const timerBarWrap   = document.getElementById('timerBarWrap');
    const timerBar       = document.getElementById('timerBar');
    const charBoxesEl    = document.getElementById('charBoxes');
    const feedbackEl     = document.getElementById('feedback');
    const dots           = [
        document.getElementById('dot0'),
        document.getElementById('dot1'),
        document.getElementById('dot2'),
    ];
    const hintEl         = document.getElementById('hint');

    const reportSummaryEl = document.getElementById('reportSummary');
    const reportHeadEl    = document.getElementById('reportHead');
    const reportBodyEl    = document.getElementById('reportBody');
    const charStatsHeadEl = document.getElementById('charStatsHead');
    const charStatsBodyEl = document.getElementById('charStatsBody');
    const newSessionBtn   = document.getElementById('newSessionBtn');

    // --- State ---
    let state    = 'session-start';
    let settings = {};
    let session  = {};
    let question = {};
    let isPlaying        = false;
    let timerHandle      = null;
    let timerTickHandle  = null;
    let playbackGen      = 0; // incremented on each new playback to guard stale awaits

    // --- Settings sliders ---
    function bindSlider(input, display, fmt) {
        const update = () => { display.textContent = fmt(input.value); };
        input.addEventListener('input', update);
        update();
    }
    bindSlider(sCharsPerQ, sCharsPerQVal, v => v);
    bindSlider(sQuestions,  sQuestionsVal,  v => v);
    bindSlider(sWpm,        sWpmVal,        v => v);
    bindSlider(sFreq,       sFreqVal,       v => v);
    bindSlider(sTimelimit,  sTimelimitVal,  v => +v === 0 ? 'Off' : v + ' s');

    // Show/hide charsPerQ slider based on mode
    function updateModeUI() {
        sCharsPerQRow.hidden = !sModeMulti.checked;
    }
    sModeSingle.addEventListener('change', updateModeUI);
    sModeMulti.addEventListener('change', updateModeUI);

    function updateStartBtn() {
        const ok = sLetters.checked || sDigits.checked;
        startSessionBtn.disabled  = !ok;
        startSessionBtn.textContent = ok ? 'Start Session' : 'Select at least one character set';
    }
    sLetters.addEventListener('change', updateStartBtn);
    sDigits.addEventListener('change', updateStartBtn);

    // --- Screen helpers ---
    function showScreen(el) {
        [screenStart, screenQuiz, screenEnd].forEach(s => s.classList.add('hidden'));
        el.classList.remove('hidden');
    }

    function isMulti() { return settings.multiChar; }

    // --- Session start ---
    startSessionBtn.addEventListener('click', () => {
        settings = {
            multiChar:          sModeMulti.checked,
            charsPerQuestion:   +sCharsPerQ.value,
            questionsPerSession: +sQuestions.value,
            wpm:           +sWpm.value,
            frequency:     +sFreq.value,
            timeLimitSecs: +sTimelimit.value, // 0 = off
            includeLetters: sLetters.checked,
            includeDigits:  sDigits.checked,
        };
        morsePlayer.wpm       = settings.wpm;
        morsePlayer.frequency = settings.frequency;

        session = {
            log:           [],
            index:         0,
            correctCount:  0,
            streak:        0,
            longestStreak: 0,
        };

        questionTotalEl.textContent = settings.questionsPerSession;
        timerBarWrap.classList.toggle('hidden', settings.timeLimitSecs === 0);

        showScreen(screenQuiz);
        nextQuestion();
    });

    // --- Question lifecycle ---
    function nextQuestion() {
        if (session.index >= settings.questionsPerSession) {
            endSession();
            return;
        }

        session.index++;
        feedbackEl.className = 'feedback hidden';

        if (isMulti()) {
            question = {
                chars:          pickManyRandom(settings.charsPerQuestion),
                inputBuffer:    '',
                attemptBuffers: [], // snapshot of inputBuffer at each evaluation
                attemptStart:   null,
                attemptsLeft:   3,
                attemptsUsed:   0,
                totalTime:      0,
            };
            charBoxesEl.hidden = false;
        } else {
            question = {
                char:          pickRandom(),
                attemptsLeft:  3,
                attemptsUsed:  0,
                thinkTime:     0,
                awaitingStart: null,
            };
            charBoxesEl.hidden = true;
        }
        updateDots();

        questionNumEl.textContent = session.index;
        scoreEl.textContent       = session.correctCount;
        streakEl.textContent      = session.streak;

        playChar();
    }

    function pickRandom() {
        const pool = [
            ...(settings.includeLetters ? morsePlayer.getLetters() : []),
            ...(settings.includeDigits  ? morsePlayer.getDigits()  : []),
        ];
        return pool[Math.floor(Math.random() * pool.length)];
    }

    function pickManyRandom(n) {
        const pool = [
            ...(settings.includeLetters ? morsePlayer.getLetters() : []),
            ...(settings.includeDigits  ? morsePlayer.getDigits()  : []),
        ];
        return Array.from({length: n}, () => pool[Math.floor(Math.random() * pool.length)]);
    }

    async function playChar() {
        if (isPlaying) return;
        state     = 'playing';
        isPlaying = true;
        setHint('playing');

        if (isMulti()) {
            const gen = ++playbackGen;
            question.inputBuffer = '';
            renderCharBoxes('input');
            question.attemptStart = Date.now();
            startTimerMulti();

            await morsePlayer.playSequence(question.chars);

            isPlaying = false;
            // Only proceed if this playback wasn't superseded by a timeout/early-submit
            if (state === 'playing' && playbackGen === gen) {
                enterAwaiting();
            }
        } else {
            await morsePlayer.play(question.char);
            isPlaying = false;
            enterAwaiting();
        }
    }

    function enterAwaiting() {
        state = 'awaiting';
        setHint('awaiting');
        if (!isMulti()) {
            question.awaitingStart = Date.now();
            startTimer();
        }
        // Multi-char: timer already running since playing began
    }

    // --- Think-time tracking (single-char only) ---
    function pauseThinkTimer() {
        if (question.awaitingStart !== null) {
            question.thinkTime += (Date.now() - question.awaitingStart) / 1000;
            question.awaitingStart = null;
        }
    }

    // --- Elapsed-time tracking (multi-char only) ---
    function recordMultiTime() {
        if (question.attemptStart !== null) {
            question.totalTime += (Date.now() - question.attemptStart) / 1000;
            question.attemptStart = null;
        }
    }

    // --- Timer (single-char) ---
    function startTimer() {
        stopTimer();
        if (settings.timeLimitSecs === 0) return;

        const limitMs = settings.timeLimitSecs * 1000;
        const startAt = Date.now();

        function tick() {
            const pct = Math.max(0, 1 - (Date.now() - startAt) / limitMs);
            timerBar.style.width = (pct * 100) + '%';
            timerBar.style.background = `oklch(75% 0.16 ${Math.round(20 + pct * 120)})`;
        }
        tick();
        timerTickHandle = setInterval(tick, 50);

        timerHandle = setTimeout(() => {
            stopTimer();
            if (state === 'awaiting') {
                state = 'feedback';
                pauseThinkTimer();
                handleWrong(true);
            }
        }, limitMs);
    }

    // --- Timer (multi-char) — starts at playing, total = charsPerQuestion × timeLimitSecs ---
    function startTimerMulti() {
        stopTimer();
        if (settings.timeLimitSecs === 0) return;

        const limitMs = settings.charsPerQuestion * settings.timeLimitSecs * 1000;
        const startAt = Date.now();

        function tick() {
            const pct = Math.max(0, 1 - (Date.now() - startAt) / limitMs);
            timerBar.style.width = (pct * 100) + '%';
            timerBar.style.background = `oklch(75% 0.16 ${Math.round(20 + pct * 120)})`;
        }
        tick();
        timerTickHandle = setInterval(tick, 50);

        timerHandle = setTimeout(() => {
            stopTimer();
            if (state === 'playing' || state === 'awaiting') {
                soundEngine.stopAll();
                isPlaying = false;
                state = 'feedback';
                recordMultiTime();
                question.attemptBuffers.push(question.inputBuffer);
                handleMultiWrong(true);
            }
        }, limitMs);
    }

    function stopTimer() {
        clearTimeout(timerHandle);
        clearInterval(timerTickHandle);
        timerHandle     = null;
        timerTickHandle = null;
    }

    // --- Single-char answer handling ---
    function handleKeyAnswer(key) {
        if (state !== 'awaiting' || isPlaying) return;
        state = 'feedback';
        stopTimer();
        pauseThinkTimer();

        if (key.toUpperCase() === question.char) {
            question.attemptsUsed++;
            handleCorrect();
        } else {
            handleWrong(false);
        }
    }

    function handleCorrect() {
        session.correctCount++;
        session.streak++;
        if (session.streak > session.longestStreak) session.longestStreak = session.streak;

        scoreEl.textContent  = session.correctCount;
        streakEl.textContent = session.streak;

        const pattern = morsePlayer.getMorsePattern(question.char);
        setFeedback('correct', `Correct! "${question.char}" is <code>${pattern}</code>`);
        logQuestion(true);
        setTimeout(nextQuestion, 1200);
    }

    function handleWrong(timedOut) {
        question.attemptsLeft--;
        question.attemptsUsed++;
        updateDots();

        const pattern = morsePlayer.getMorsePattern(question.char);

        if (question.attemptsLeft <= 0) {
            session.streak       = 0;
            streakEl.textContent = 0;
            setFeedback('incorrect', `Answer: "${question.char}" (<code>${pattern}</code>)`);
            logQuestion(false);
            setTimeout(nextQuestion, 1800);
        } else {
            const prefix = timedOut ? "Time's up!" : 'Wrong.';
            const n = question.attemptsLeft;
            setFeedback('try-again', `${prefix} Try again — ${n} attempt${n > 1 ? 's' : ''} left`);
            setTimeout(() => {
                feedbackEl.className = 'feedback hidden';
                playChar();
            }, 1200);
        }
    }

    function logQuestion(correct) {
        session.log.push({
            char:      question.char,
            correct,
            attempts:  question.attemptsUsed,
            timeTaken: question.thinkTime,
        });
    }

    // --- Multi-char answer handling ---
    function evaluateMultiAnswer() {
        stopTimer();
        soundEngine.stopAll();
        isPlaying = false;
        state = 'feedback';
        recordMultiTime();
        question.attemptBuffers.push(question.inputBuffer);

        const answer = question.inputBuffer;
        const target = question.chars.join('');

        if (answer === target) {
            question.attemptsUsed++;
            handleMultiCorrect();
        } else {
            handleMultiWrong(false);
        }
    }

    function handleMultiCorrect() {
        session.correctCount++;
        session.streak++;
        if (session.streak > session.longestStreak) session.longestStreak = session.streak;

        scoreEl.textContent  = session.correctCount;
        streakEl.textContent = session.streak;

        renderCharBoxes('correct');
        setFeedback('correct', 'Correct!');
        logMultiQuestion(true);
        setTimeout(nextQuestion, 1200);
    }

    function handleMultiWrong(timedOut) {
        question.attemptsLeft--;
        question.attemptsUsed++;
        updateDots();

        if (question.attemptsLeft <= 0) {
            session.streak       = 0;
            streakEl.textContent = 0;

            renderCharBoxes('wrong-final');
            const answerStr = question.chars
                .map(c => `${c}(${morsePlayer.getMorsePattern(c)})`)
                .join(' ');
            setFeedback('incorrect', `Answer: ${answerStr}`);
            logMultiQuestion(false);
            setTimeout(nextQuestion, 1800);
        } else {
            const prefix = timedOut ? "Time's up!" : 'Wrong.';
            const n = question.attemptsLeft;

            renderCharBoxes('wrong-retry');
            setFeedback('try-again', `${prefix} Try again — ${n} attempt${n > 1 ? 's' : ''} left`);
            setTimeout(() => {
                feedbackEl.className = 'feedback hidden';
                playChar();
            }, 1200);
        }
    }

    function computeCharAttempts() {
        const n        = question.chars.length;
        const resolved = new Array(n).fill(-1); // -1 = not yet resolved
        for (let a = 0; a < question.attemptBuffers.length; a++) {
            const buf = question.attemptBuffers[a];
            for (let i = 0; i < n; i++) {
                if (resolved[i] === -1 && buf[i] === question.chars[i]) {
                    resolved[i] = a + 1;
                }
            }
        }
        return resolved.map(v => v === -1 ? question.attemptsUsed : v);
    }

    function logMultiQuestion(correct) {
        session.log.push({
            chars:        question.chars,
            correct,
            attempts:     question.attemptsUsed,
            timeTaken:    question.totalTime,
            charAttempts: computeCharAttempts(),
        });
    }

    // --- Character box rendering (multi-char only) ---
    function renderCharBoxes(mode) {
        const chars  = question.chars;
        const buffer = question.inputBuffer;
        const boxes  = [];

        for (let i = 0; i < chars.length; i++) {
            const typed    = buffer[i];   // may be undefined
            const expected = chars[i];

            if (mode === 'input') {
                const isFilled = i < buffer.length;
                const isCursor = i === buffer.length;
                let cls = 'char-box';
                if (isCursor) cls += ' cursor';
                boxes.push(`<div class="${cls}">${isFilled ? typed : ''}</div>`);

            } else if (mode === 'correct') {
                boxes.push(`<div class="char-box box-correct">${typed}</div>`);

            } else if (mode === 'wrong-retry') {
                if (typed === expected) {
                    boxes.push(`<div class="char-box box-correct">${typed}</div>`);
                } else {
                    const shown = typed || '_';
                    boxes.push(`<div class="char-box box-wrong">${shown}</div>`);
                }

            } else if (mode === 'wrong-final') {
                if (typed === expected) {
                    boxes.push(`<div class="char-box box-correct">${typed}</div>`);
                } else {
                    const shown = typed || '_';
                    boxes.push(`<div class="char-box box-wrong">${shown}<span class="char-reveal">${expected}</span></div>`);
                }
            }
        }

        charBoxesEl.innerHTML = boxes.join('');
    }

    // --- UI helpers ---
    function setFeedback(type, msg) {
        feedbackEl.innerHTML = msg;
        feedbackEl.className = `feedback ${type}`;
    }

    function updateDots() {
        dots.forEach((dot, i) => {
            dot.className = 'attempt-dot' + (i < question.attemptsLeft ? ' active' : '');
        });
    }

    function setHint(s) {
        if (s === 'playing') {
            if (isMulti()) {
                hintEl.innerHTML = 'Playing\u2026 \u2014 type ahead as you hear the characters \u00b7 <kbd>Backspace</kbd> to delete';
            } else {
                hintEl.textContent = 'Playing\u2026';
            }
        } else { // awaiting
            if (isMulti()) {
                hintEl.innerHTML = 'Press <kbd>Space</kbd> to replay \u00b7 Type characters \u00b7 <kbd>Backspace</kbd> to delete';
            } else {
                hintEl.innerHTML = 'Press <kbd>Space</kbd> to replay \u00b7 Type any letter or digit to answer';
            }
        }
    }

    // --- Per-character aggregation (single-char) ---
    function aggregateByChar(log) {
        const map = {};
        for (const entry of log) {
            if (!map[entry.char]) map[entry.char] = { count: 0, totalTries: 0, totalTime: 0 };
            map[entry.char].count++;
            map[entry.char].totalTries += entry.attempts;
            map[entry.char].totalTime  += entry.timeTaken;
        }
        return Object.entries(map).map(([char, s]) => ({
            char,
            pattern:  morsePlayer.getMorsePattern(char),
            count:    s.count,
            avgTries: s.totalTries / s.count,
            avgTime:  s.totalTime  / s.count,
        })).sort((a, b) => b.avgTime - a.avgTime);
    }

    // --- Per-character aggregation (multi-char) ---
    function aggregateByCharMulti(log) {
        const map = {};
        for (const entry of log) {
            for (let i = 0; i < entry.chars.length; i++) {
                const char = entry.chars[i];
                if (!map[char]) map[char] = { count: 0, totalTries: 0 };
                map[char].count++;
                map[char].totalTries += entry.charAttempts[i];
            }
        }
        return Object.entries(map).map(([char, s]) => ({
            char,
            pattern:  morsePlayer.getMorsePattern(char),
            count:    s.count,
            avgTries: s.totalTries / s.count,
        })).sort((a, b) => b.avgTries - a.avgTries);
    }

    // --- Session end ---
    function endSession() {
        state = 'session-end';
        showScreen(screenEnd);

        const total    = settings.questionsPerSession;
        const correct  = session.correctCount;
        const accuracy = Math.round((correct / total) * 100);

        reportSummaryEl.innerHTML = `
            <div class="stat">
                <strong class="stat-value">${correct}/${total}</strong>
                <small class="stat-label">Correct</small>
            </div>
            <div class="stat">
                <strong class="stat-value">${accuracy}%</strong>
                <small class="stat-label">Accuracy</small>
            </div>
            <div class="stat">
                <strong class="stat-value">${session.longestStreak}</strong>
                <small class="stat-label">Best Streak</small>
            </div>
        `;

        if (isMulti()) {
            reportHeadEl.innerHTML = `
                <th><small>#</small></th>
                <th><small>Chars</small></th>
                <th><small>Result</small></th>
                <th><small>Tries</small></th>
                <th><small>Time</small></th>
            `;
            reportBodyEl.innerHTML = session.log.map((q, i) => `
                <tr class="${q.correct ? 'row-correct' : 'row-incorrect'}">
                    <td>${i + 1}</td>
                    <td><strong>${q.chars.join('')}</strong></td>
                    <td><strong>${q.correct ? '✔' : '✘'}</strong></td>
                    <td>${q.attempts}</td>
                    <td>${q.timeTaken.toFixed(1)}s</td>
                </tr>
            `).join('');

            charStatsHeadEl.innerHTML = `
                <th><small>Char</small></th>
                <th><small>Pattern</small></th>
                <th><small>Asked</small></th>
                <th><small>Avg Tries</small></th>
            `;
            const charStats = aggregateByCharMulti(session.log);
            charStatsBodyEl.innerHTML = charStats.map(s => `
                <tr>
                    <td><strong>${s.char}</strong></td>
                    <td><code>${s.pattern}</code></td>
                    <td>${s.count}</td>
                    <td>${s.avgTries.toFixed(1)}</td>
                </tr>
            `).join('');
        } else {
            reportHeadEl.innerHTML = `
                <th><small>#</small></th>
                <th><small>Char</small></th>
                <th><small>Pattern</small></th>
                <th><small>Result</small></th>
                <th><small>Tries</small></th>
                <th><small>Time</small></th>
            `;
            reportBodyEl.innerHTML = session.log.map((q, i) => `
                <tr class="${q.correct ? 'row-correct' : 'row-incorrect'}">
                    <td>${i + 1}</td>
                    <td><strong>${q.char}</strong></td>
                    <td><code>${morsePlayer.getMorsePattern(q.char)}</code></td>
                    <td><strong>${q.correct ? '✔' : '✘'}</strong></td>
                    <td>${q.attempts}</td>
                    <td>${q.timeTaken.toFixed(1)}s</td>
                </tr>
            `).join('');

            charStatsHeadEl.innerHTML = `
                <th><small>Char</small></th>
                <th><small>Pattern</small></th>
                <th><small>Asked</small></th>
                <th><small>Avg Tries</small></th>
                <th><small>Avg Time</small></th>
            `;
            const charStats = aggregateByChar(session.log);
            charStatsBodyEl.innerHTML = charStats.map(s => `
                <tr>
                    <td><strong>${s.char}</strong></td>
                    <td><code>${s.pattern}</code></td>
                    <td>${s.count}</td>
                    <td>${s.avgTries.toFixed(1)}</td>
                    <td>${s.avgTime.toFixed(1)}s</td>
                </tr>
            `).join('');
        }
    }

    newSessionBtn.addEventListener('click', () => {
        showScreen(screenStart);
        state = 'session-start';
    });

    // --- Global keyboard ---
    document.addEventListener('keydown', e => {
        if (e.key === ' ') {
            e.preventDefault();
            if (state !== 'awaiting') return;

            if (question.attemptsLeft <= 1) {
                hintEl.textContent = 'No replays left — type your answer';
                setTimeout(() => setHint('awaiting'), 1500);
                return;
            }
            question.attemptsLeft--;
            question.attemptsUsed++;
            updateDots();
            stopTimer();

            if (isMulti()) {
                recordMultiTime();
                playChar();
            } else {
                if (isPlaying) return;
                pauseThinkTimer();
                playChar();
            }
            return;
        }

        if (isMulti()) {
            if (e.key === 'Backspace') {
                e.preventDefault();
                if ((state === 'playing' || state === 'awaiting') && question.inputBuffer.length > 0) {
                    question.inputBuffer = question.inputBuffer.slice(0, -1);
                    renderCharBoxes('input');
                }
                return;
            }
            if (/^[a-zA-Z0-9]$/.test(e.key)) {
                if (state === 'playing' || state === 'awaiting') {
                    if (question.inputBuffer.length < question.chars.length) {
                        question.inputBuffer += e.key.toUpperCase();
                        renderCharBoxes('input');
                        if (question.inputBuffer.length === question.chars.length) {
                            evaluateMultiAnswer();
                        }
                    }
                }
            }
        } else {
            if (/^[a-zA-Z0-9]$/.test(e.key)) {
                handleKeyAnswer(e.key);
            }
        }
    });

});
