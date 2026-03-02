/**
 * Morse Code Quiz — state machine
 * States: session-start | playing | awaiting | feedback | session-end
 */

document.addEventListener('DOMContentLoaded', () => {

    // --- Elements ---
    const screenStart = document.getElementById('screen-start');
    const screenQuiz  = document.getElementById('screen-quiz');
    const screenEnd   = document.getElementById('screen-end');

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
    const feedbackEl     = document.getElementById('feedback');
    const dots           = [
        document.getElementById('dot0'),
        document.getElementById('dot1'),
        document.getElementById('dot2'),
    ];
    const hintEl         = document.getElementById('hint');

    const reportSummaryEl = document.getElementById('reportSummary');
    const reportBodyEl    = document.getElementById('reportBody');
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

    // --- Settings sliders ---
    function bindSlider(input, display, fmt) {
        const update = () => { display.textContent = fmt(input.value); };
        input.addEventListener('input', update);
        update();
    }
    bindSlider(sQuestions,  sQuestionsVal,  v => v);
    bindSlider(sWpm,        sWpmVal,        v => v);
    bindSlider(sFreq,       sFreqVal,       v => v);
    bindSlider(sTimelimit,  sTimelimitVal,  v => +v === 0 ? 'Off' : v + ' s');

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

    // --- Session start ---
    startSessionBtn.addEventListener('click', () => {
        settings = {
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
        question = {
            char:          pickRandom(),
            attemptsLeft:  3,
            attemptsUsed:  0,
            thinkTime:     0,
            awaitingStart: null,
        };

        questionNumEl.textContent = session.index;
        scoreEl.textContent       = session.correctCount;
        streakEl.textContent      = session.streak;
        feedbackEl.className      = 'feedback hidden';
        updateDots();

        playChar();
    }

    function pickRandom() {
        const pool = [
            ...(settings.includeLetters ? morsePlayer.getLetters() : []),
            ...(settings.includeDigits  ? morsePlayer.getDigits()  : []),
        ];
        return pool[Math.floor(Math.random() * pool.length)];
    }

    async function playChar() {
        if (isPlaying) return;
        state     = 'playing';
        isPlaying = true;
        setHint('playing');

        await morsePlayer.play(question.char);

        isPlaying = false;
        enterAwaiting();
    }

    function enterAwaiting() {
        state = 'awaiting';
        question.awaitingStart = Date.now();
        setHint('awaiting');
        startTimer();
    }

    function pauseThinkTimer() {
        if (question.awaitingStart !== null) {
            question.thinkTime += (Date.now() - question.awaitingStart) / 1000;
            question.awaitingStart = null;
        }
    }

    // --- Timer ---
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

    function stopTimer() {
        clearTimeout(timerHandle);
        clearInterval(timerTickHandle);
        timerHandle     = null;
        timerTickHandle = null;
    }

    // --- Answer handling ---
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
            hintEl.textContent = 'Playing\u2026';
        } else {
            hintEl.innerHTML = 'Press <kbd>Space</kbd> to replay \u00b7 Type any letter or digit to answer';
        }
    }

    // --- Per-character aggregation ---
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

    newSessionBtn.addEventListener('click', () => {
        showScreen(screenStart);
        state = 'session-start';
    });

    // --- Global keyboard ---
    document.addEventListener('keydown', e => {
        if (e.key === ' ') {
            e.preventDefault();
            if (state === 'awaiting' && !isPlaying) {
                stopTimer();
                pauseThinkTimer();
                playChar();
            }
            return;
        }
        if (/^[a-zA-Z0-9]$/.test(e.key)) {
            handleKeyAnswer(e.key);
        }
    });

});
