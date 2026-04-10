const WORD_POOL = [
    "JAVASCRIPT", "PYTHON", "REACT", "ANGULAR", "VUE", 
    "NODEJS", "TYPESCRIPT", "GRAPHQL", "DOCKER", "KUBERNETES", 
    "DEVOPS", "SERVERLESS", "ALGORITHM", "DATABASE", "FRONTEND", 
    "BACKEND", "API", "RUST", "GO", "SWIFT"
];
const GRID_SIZE = 12;
const WORDS_COUNT = 8;

let grid = [];
let targetWords = [];
let foundWords = [];
let wordPlacements = {};

let isDragging = false;
let startCell = null;
let currentSelection = [];

let score = 0;
let points = 0;
let highScore = localStorage.getItem("techWordHuntHighScore") || 0;

let timerInterval = null;
let secondsElapsed = 0;

// DOM Elements
const gridEl = document.getElementById("word-grid");
const wordListEl = document.getElementById("word-list");
const scoreDisplay = document.getElementById("score-display");
const pointsDisplay = document.getElementById("points-display");
const timerDisplay = document.getElementById("timer-display");
const hintBtn = document.getElementById("hint-btn");
const resetBtn = document.getElementById("reset-btn");
const newGameBtn = document.getElementById("new-game-btn");
const highScoreEl = document.getElementById("high-score");
const winModal = document.getElementById("win-modal");
const playAgainBtn = document.getElementById("play-again-btn");
const finalScoreEl = document.getElementById("final-score");
const finalTimeEl = document.getElementById("final-time");
const toastEl = document.getElementById("toast");

const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

function formatTime(totalSeconds) {
    if (totalSeconds === null) return "--:--";
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function startTimer() {
    clearInterval(timerInterval);
    secondsElapsed = 0;
    timerDisplay.textContent = "00:00";
    timerInterval = setInterval(() => {
        secondsElapsed++;
        timerDisplay.textContent = formatTime(secondsElapsed);
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}

function playDing() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime); 
    osc.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.1); 
    
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
}

function initGame() {
    score = 0;
    points = 0;
    foundWords = [];
    isDragging = false;
    startCell = null;
    currentSelection = [];
    targetWords = [];
    wordPlacements = {};

    highScoreEl.textContent = highScore;
    winModal.classList.add("hidden");

    startTimer();

    let poolCopy = [...WORD_POOL];
    for (let i = 0; i < WORDS_COUNT; i++) {
        let idx = Math.floor(Math.random() * poolCopy.length);
        targetWords.push(poolCopy.splice(idx, 1)[0]);
    }

    createGrid();
    renderGrid();
    renderWordList();
    updateStats();
}

function createGrid() {
    grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(''));
    
    // Horizontal (0,1), Vertical (1,0), Diagonal (1,1)
    const dirs = [[0, 1], [1, 0], [1, 1]];

    targetWords.forEach(word => {
        let placed = false;
        let attempts = 0;
        
        while (!placed && attempts < 50) {
            attempts++;
            const dir = dirs[Math.floor(Math.random() * dirs.length)];
            const dr = dir[0], dc = dir[1];
            
            const r = Math.floor(Math.random() * GRID_SIZE);
            const c = Math.floor(Math.random() * GRID_SIZE);
            
            const endR = r + dr * (word.length - 1);
            const endC = c + dc * (word.length - 1);
            
            if (endR < GRID_SIZE && endC < GRID_SIZE) {
                let canPlace = true;
                for (let i = 0; i < word.length; i++) {
                    const cellLetter = grid[r + dr * i][c + dc * i];
                    if (cellLetter !== '' && cellLetter !== word[i]) {
                        canPlace = false;
                        break;
                    }
                }
                
                if (canPlace) {
                    wordPlacements[word] = [];
                    for (let i = 0; i < word.length; i++) {
                        grid[r + dr * i][c + dc * i] = word[i];
                        wordPlacements[word].push({r: r + dr * i, c: c + dc * i});
                    }
                    placed = true;
                }
            }
        }
    });

    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            if (grid[r][c] === '') {
                grid[r][c] = alphabet[Math.floor(Math.random() * alphabet.length)];
            }
        }
    }
}

function renderGrid() {
    gridEl.innerHTML = "";
    
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const cell = document.createElement("div");
            cell.classList.add("cell");
            cell.textContent = grid[r][c];
            cell.dataset.r = r;
            cell.dataset.c = c;
            
            gridEl.appendChild(cell);
        }
    }
}

function renderWordList() {
    wordListEl.innerHTML = "";
    targetWords.forEach(word => {
        const li = document.createElement("li");
        li.textContent = word;
        li.dataset.word = word;
        if (foundWords.includes(word)) {
            li.classList.add("found");
            li.innerHTML += " <span>✔ Found</span>";
        }
        wordListEl.appendChild(li);
    });
}

function updateStats() {
    scoreDisplay.textContent = `${score}/${targetWords.length}`;
    pointsDisplay.textContent = points;
    hintBtn.textContent = `💡 Hint (5 pts)`;
    hintBtn.disabled = points < 5 || score === targetWords.length;
}

// Check drag inputs seamlessly on web/mobile
gridEl.addEventListener("pointerdown", (e) => {
    if (e.target.classList.contains("cell")) {
        // Required for AudioContext to work dynamically after user interaction
        if (audioCtx.state === 'suspended') audioCtx.resume();
        
        isDragging = true;
        startCell = { r: parseInt(e.target.dataset.r), c: parseInt(e.target.dataset.c) };
        clearSelection();
        highlightLine(startCell, startCell);
        
        // Prevent default text selection during pointer interactions
        e.preventDefault();
    }
});

// Using window level allows dragging outside the grid smoothly
window.addEventListener("pointermove", (e) => {
    if (!isDragging || !startCell) return;
    
    const elem = document.elementFromPoint(e.clientX, e.clientY);
    if (elem && elem.classList.contains("cell")) {
        const endCell = { r: parseInt(elem.dataset.r), c: parseInt(elem.dataset.c) };
        highlightLine(startCell, endCell);
    }
});

window.addEventListener("pointerup", () => {
    if (isDragging) {
        isDragging = false;
        checkSelection();
    }
});

function highlightLine(start, end) {
    clearSelection();
    currentSelection = [];
    
    const dr = end.r - start.r;
    const dc = end.c - start.c;
    
    const steps = Math.max(Math.abs(dr), Math.abs(dc));
    
    if (steps === 0) {
        currentSelection.push(start);
    } else {
        let stepR = dr === 0 ? 0 : dr / Math.abs(dr);
        let stepC = dc === 0 ? 0 : dc / Math.abs(dc);
        
        if (Math.abs(dr) === Math.abs(dc) || dr === 0 || dc === 0) {
            for (let i = 0; i <= steps; i++) {
                currentSelection.push({ r: start.r + stepR * i, c: start.c + stepC * i });
            }
        } else {
            currentSelection.push(start);
        }
    }
    
    currentSelection.forEach(cell => {
        const el = getCellEl(cell.r, cell.c);
        if (el) el.classList.add("selected");
    });
}

function clearSelection() {
    document.querySelectorAll(".cell.selected").forEach(el => el.classList.remove("selected"));
    currentSelection = [];
}

function getCellEl(r, c) {
    return document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
}

function checkSelection() {
    if (currentSelection.length < 2) {
        clearSelection();
        return;
    }
    
    const selectedWord = currentSelection.map(pos => grid[pos.r][pos.c]).join("");
    const selectedWordRev = selectedWord.split("").reverse().join("");
    
    let match = null;
    if (targetWords.includes(selectedWord) && !foundWords.includes(selectedWord)) {
        match = selectedWord;
    } else if (targetWords.includes(selectedWordRev) && !foundWords.includes(selectedWordRev)) {
        match = selectedWordRev;
    }
    
    if (match) {
        foundWords.push(match);
        currentSelection.forEach(cell => {
            const el = getCellEl(cell.r, cell.c);
            if(el) {
                el.classList.remove("selected");
                el.classList.add("found");
            }
        });
        
        score++;
        points += 10;
        playDing();
        renderWordList();
        updateStats();
        showToast("🌟 Nice find! +10 Points");
        
        checkWin();
    } else {
        showToast("❌ Not a match");
        clearSelection();
    }
}

function checkWin() {
    if (score === targetWords.length) {
        stopTimer();
        
        if (points > highScore) {
            highScore = points;
            localStorage.setItem("techWordHuntHighScore", highScore);
        }
        
        finalScoreEl.textContent = points;
        finalTimeEl.textContent = formatTime(secondsElapsed);
        
        setTimeout(() => {
            winModal.classList.remove("hidden");
        }, 500);
    }
}

function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.remove("hidden");
    
    clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(() => {
        toastEl.classList.add("hidden");
    }, 1500);
}

resetBtn.addEventListener("click", clearSelection);
newGameBtn.addEventListener("click", initGame);
playAgainBtn.addEventListener("click", initGame);

hintBtn.addEventListener("click", () => {
    if (points >= 5) {
        points -= 5;
        updateStats();
        
        const unfound = targetWords.filter(w => !foundWords.includes(w));
        if (unfound.length > 0) {
            // Find the hardest (longest) remaining word
            const word = unfound.reduce((a, b) => a.length >= b.length ? a : b);
            const pos = wordPlacements[word];
            
            if (pos && pos.length > 0) {
                const startNode = getCellEl(pos[0].r, pos[0].c);
                if (startNode) {
                    startNode.classList.add("hint");
                    
                    // Add subtle highlighting to the word in the list too
                    let targetLi = null;
                    wordListEl.querySelectorAll('li').forEach(node => {
                        if (node.dataset.word === word) targetLi = node;
                    });
                    if (targetLi) targetLi.classList.add("hinting");
                    
                    setTimeout(() => {
                        startNode.classList.remove("hint");
                        if (targetLi) targetLi.classList.remove("hinting");
                    }, 4000);
                    
                    showToast(`💡 Hint: Look for the pulsing start of "${word}"`);
                }
            } else {
                showToast("Could not find a valid hint, points refunded!");
                points += 5; // Refund logic just in case
                updateStats();
            }
        }
    } else {
        showToast("Needs 5 points. Find more words first!");
    }
});

// Prevent default drag and drop behavior
document.addEventListener('dragstart', (e) => e.preventDefault());

initGame();
