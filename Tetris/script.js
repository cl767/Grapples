const canvas = document.getElementById('tetrisCanvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('nextCanvas');
const nextCtx = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('holdCanvas');
const holdCtx = holdCanvas.getContext('2d');

const BLOCK_SIZE = 30;
const COLS = 10;
const ROWS = 20;

let board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
let score = 0;
let lines = 0;
let level = 1;
let highScore = localStorage.getItem('tetris_highScore') || 0;
document.getElementById('highVal').innerText = highScore;

let gameOver = false;
let isPaused = false;
let gameStarted = false;
let dropInterval = 1000;
let dropCounter = 0;
let lastTime = 0;

let soundEnabled = true;
let audioCtx = null;

// Particle system for line clears
let particles = [];

// Tetromino shapes & colors
const SHAPES = [
    null,
    [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], // I
    [[2, 0, 0], [2, 2, 2], [0, 0, 0]],                           // J
    [[0, 0, 3], [3, 3, 3], [0, 0, 0]],                           // L
    [[4, 4], [4, 4]],                                            // O
    [[0, 5, 5], [5, 5, 0], [0, 0, 0]],                           // S
    [[0, 6, 0], [6, 6, 6], [0, 0, 0]],                           // T
    [[7, 7, 0], [0, 7, 7], [0, 0, 0]]                            // Z
];

const COLORS = [
    null,
    '#00f0ff', // I - Cyan
    '#0044ff', // J - Blue
    '#ff7700', // L - Orange
    '#ffee00', // O - Yellow
    '#00ff66', // S - Green
    '#9d00ff', // T - Purple
    '#ff0055'  // Z - Pink
];

// Active Player Piece State
let player = {
    pos: { x: 0, y: 0 },
    matrix: null,
    shapeId: 0
};

let nextShapeId = Math.floor(Math.random() * 7) + 1;
let holdShapeId = null;
let canHold = true;

// Web Audio Synthesizer
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSound(type) {
    if (!soundEnabled) return;
    try {
        initAudio();
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        const now = audioCtx.currentTime;

        if (type === 'move') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
        } else if (type === 'rotate') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(450, now + 0.08);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
            osc.start(now);
            osc.stop(now + 0.08);
        } else if (type === 'drop') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'clear') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(800, now + 0.2);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        } else if (type === 'gameover') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.linearRampToValueAtTime(60, now + 0.6);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.6);
            osc.start(now);
            osc.stop(now + 0.6);
        }
    } catch (e) {
        console.error('Audio play error:', e);
    }
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    document.getElementById('soundIcon').innerText = soundEnabled ? '🔊' : '🔇';
}

function toggleTheme() {
    const body = document.body;
    const label = document.getElementById('themeLabel');
    if (label.innerText === 'Cyber') {
        label.innerText = 'Matrix';
        body.style.background = 'radial-gradient(circle at center, #021a10 0%, #010805 100%)';
    } else {
        label.innerText = 'Cyber';
        body.style.background = 'radial-gradient(circle at center, #120b29 0%, #05020a 100%)';
    }
}

// Collision Detection
function collide(board, player) {
    const m = player.matrix;
    const o = player.pos;
    for (let r = 0; r < m.length; ++r) {
        for (let c = 0; c < m[r].length; ++c) {
            if (m[r][c] !== 0 &&
               (board[r + o.y] && board[r + o.y][c + o.x]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

// Merge Player Matrix into Board
function merge(board, player) {
    player.matrix.forEach((row, r) => {
        row.forEach((value, c) => {
            if (value !== 0) {
                board[r + player.pos.y][c + player.pos.x] = player.shapeId;
            }
        });
    });
}

// Clear completed lines
function sweepLines() {
    let rowCount = 0;
    outer: for (let r = board.length - 1; r >= 0; --r) {
        for (let c = 0; c < board[r].length; ++c) {
            if (board[r][c] === 0) {
                continue outer;
            }
        }
        const row = board.splice(r, 1)[0].fill(0);
        board.unshift(row);
        ++r;
        rowCount++;

        // Trigger particle explosion for this row
        createRowParticles(r);
    }

    if (rowCount > 0) {
        playSound('clear');
        lines += rowCount;
        const baseScores = [0, 40, 100, 300, 1200];
        score += baseScores[rowCount] * level;
        level = Math.floor(lines / 10) + 1;
        dropInterval = Math.max(100, 1000 - (level - 1) * 90);

        updateStats();
    }
}

// Create Particle Effects on Line Clears
function createRowParticles(rowIdx) {
    for (let c = 0; c < COLS; c++) {
        for (let i = 0; i < 4; i++) {
            particles.push({
                x: (c + 0.5) * BLOCK_SIZE,
                y: (rowIdx + 0.5) * BLOCK_SIZE,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.7) * 8,
                color: COLORS[Math.floor(Math.random() * 7) + 1],
                life: 1.0
            });
        }
    }
}

function updateParticles(dt) {
    particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2; // gravity
        p.life -= 0.03;
    });
    particles = particles.filter(p => p.life > 0);
}

function drawParticles() {
    particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 4, 4);
        ctx.restore();
    });
}

// Spawn or Reset Player
function playerReset() {
    player.shapeId = nextShapeId;
    nextShapeId = Math.floor(Math.random() * 7) + 1;
    player.matrix = SHAPES[player.shapeId];
    player.pos.y = 0;
    player.pos.x = Math.floor((board[0].length - player.matrix[0].length) / 2);

    canHold = true;
    drawHoldPiece();
    drawNextPiece();

    if (collide(board, player)) {
        gameOver = true;
        playSound('gameover');
        handleGameOver();
    }
}

// Movement Functions
function playerDrop() {
    player.pos.y++;
    if (collide(board, player)) {
        player.pos.y--;
        merge(board, player);
        sweepLines();
        playerReset();
    }
    dropCounter = 0;
}

function hardDrop() {
    if (gameOver || isPaused || !gameStarted) return;
    while (!collide(board, player)) {
        player.pos.y++;
    }
    player.pos.y--;
    merge(board, player);
    sweepLines();
    playSound('drop');
    playerReset();
    dropCounter = 0;
}

function moveLeft() {
    if (gameOver || isPaused || !gameStarted) return;
    player.pos.x--;
    if (collide(board, player)) {
        player.pos.x++;
    } else {
        playSound('move');
    }
}

function moveRight() {
    if (gameOver || isPaused || !gameStarted) return;
    player.pos.x++;
    if (collide(board, player)) {
        player.pos.x--;
    } else {
        playSound('move');
    }
}

function rotatePiece() {
    if (gameOver || isPaused || !gameStarted) return;
    const posX = player.pos.x;
    let offset = 1;
    rotateMatrix(player.matrix);
    while (collide(board, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.matrix[0].length) {
            rotateMatrix(player.matrix, true); // Rotate back
            player.pos.x = posX;
            return;
        }
    }
    playSound('rotate');
}

function rotateMatrix(matrix, reverse = false) {
    const n = matrix.length;
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < i; j++) {
            [matrix[i][j], matrix[j][i]] = [matrix[j][i], matrix[i][j]];
        }
    }
    if (reverse) {
        matrix.forEach(row => row.reverse());
    } else {
        matrix.reverse();
    }
}

function holdPieceAction() {
    if (gameOver || isPaused || !gameStarted || !canHold) return;
    canHold = false;
    if (holdShapeId === null) {
        holdShapeId = player.shapeId;
        playerReset();
    } else {
        const temp = player.shapeId;
        player.shapeId = holdShapeId;
        holdShapeId = temp;
        player.matrix = SHAPES[player.shapeId];
        player.pos.y = 0;
        player.pos.x = Math.floor((board[0].length - player.matrix[0].length) / 2);
    }
    drawHoldPiece();
    playSound('rotate');
}

// Draw individual block with neon glow
function drawBlock(context, x, y, shapeId, size = BLOCK_SIZE) {
    context.fillStyle = COLORS[shapeId];
    context.shadowColor = COLORS[shapeId];
    context.shadowBlur = 8;
    context.fillRect(x * size, y * size, size - 1, size - 1);
    
    // Inner glossy highlight
    context.fillStyle = 'rgba(255, 255, 255, 0.3)';
    context.fillRect(x * size + 2, y * size + 2, size - 5, 3);
    context.shadowBlur = 0;
}

// Draw ghost piece
function drawGhost() {
    const ghost = {
        pos: { x: player.pos.x, y: player.pos.y },
        matrix: player.matrix,
        shapeId: player.shapeId
    };
    while (!collide(board, ghost)) {
        ghost.pos.y++;
    }
    ghost.pos.y--;

    ghost.matrix.forEach((row, r) => {
        row.forEach((value, c) => {
            if (value !== 0) {
                ctx.strokeStyle = COLORS[ghost.shapeId];
                ctx.lineWidth = 1.5;
                ctx.strokeRect((c + ghost.pos.x) * BLOCK_SIZE + 2, (r + ghost.pos.y) * BLOCK_SIZE + 2, BLOCK_SIZE - 5, BLOCK_SIZE - 5);
            }
        });
    });
}

// Render Game Canvas
function draw() {
    ctx.fillStyle = '#05020a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= COLS; i++) {
        ctx.beginPath();
        ctx.moveTo(i * BLOCK_SIZE, 0);
        ctx.lineTo(i * BLOCK_SIZE, canvas.height);
        ctx.stroke();
    }
    for (let j = 0; j <= ROWS; j++) {
        ctx.beginPath();
        ctx.moveTo(0, j * BLOCK_SIZE);
        ctx.lineTo(canvas.width, j * BLOCK_SIZE);
        ctx.stroke();
    }

    // Draw board blocks
    board.forEach((row, r) => {
        row.forEach((value, c) => {
            if (value !== 0) {
                drawBlock(ctx, c, r, value);
            }
        });
    });

    if (gameStarted && !gameOver) {
        drawGhost();
        player.matrix.forEach((row, r) => {
            row.forEach((value, c) => {
                if (value !== 0) {
                    drawBlock(ctx, c + player.pos.x, r + player.pos.y, player.shapeId);
                }
            });
        });
    }

    drawParticles();
}

function drawNextPiece() {
    nextCtx.fillStyle = '#05020a';
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    const matrix = SHAPES[nextShapeId];
    const size = 20;
    const offsetX = (nextCanvas.width - matrix[0].length * size) / 2 / size;
    const offsetY = (nextCanvas.height - matrix.length * size) / 2 / size;
    matrix.forEach((row, r) => {
        row.forEach((value, c) => {
            if (value !== 0) {
                drawBlock(nextCtx, c + offsetX, r + offsetY, nextShapeId, size);
            }
        });
    });
}

function drawHoldPiece() {
    holdCtx.fillStyle = '#05020a';
    holdCtx.fillRect(0, 0, holdCanvas.width, holdCanvas.height);
    if (holdShapeId === null) return;
    const matrix = SHAPES[holdShapeId];
    const size = 20;
    const offsetX = (holdCanvas.width - matrix[0].length * size) / 2 / size;
    const offsetY = (holdCanvas.height - matrix.length * size) / 2 / size;
    matrix.forEach((row, r) => {
        row.forEach((value, c) => {
            if (value !== 0) {
                drawBlock(holdCtx, c + offsetX, r + offsetY, holdShapeId, size);
            }
        });
    });
}

// Game Loop
function gameLoop(time = 0) {
    if (!gameStarted || gameOver || isPaused) return;

    const deltaTime = time - lastTime;
    lastTime = time;
    dropCounter += deltaTime;

    if (dropCounter > dropInterval) {
        playerDrop();
    }

    updateParticles(deltaTime);
    draw();
    requestAnimationFrame(gameLoop);
}

// Stats UI Update
function updateStats() {
    document.getElementById('scoreVal').innerText = score;
    document.getElementById('linesVal').innerText = lines;
    document.getElementById('levelVal').innerText = level;

    if (score > highScore) {
        highScore = score;
        localStorage.setItem('tetris_highScore', highScore);
        document.getElementById('highVal').innerText = highScore;
    }
}

// Game State Controllers
function startGame() {
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = 1000;
    gameOver = false;
    isPaused = false;
    gameStarted = true;
    particles = [];
    holdShapeId = null;

    updateStats();
    document.getElementById('gameOverlay').classList.add('opacity-0', 'pointer-events-none');
    
    playerReset();
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function togglePause() {
    if (!gameStarted || gameOver) return;
    isPaused = !isPaused;
    const overlay = document.getElementById('gameOverlay');
    if (isPaused) {
        overlay.classList.remove('opacity-0', 'pointer-events-none');
        document.getElementById('overlayTitle').innerText = 'PAUSED';
        document.getElementById('overlaySub').innerText = 'Take a breather. Ready to resume?';
        document.getElementById('actionBtn').innerText = 'RESUME';
    } else {
        overlay.classList.add('opacity-0', 'pointer-events-none');
        document.getElementById('actionBtn').innerText = 'START GAME';
        lastTime = performance.now();
        requestAnimationFrame(gameLoop);
    }
}

function handleGameOver() {
    const overlay = document.getElementById('gameOverlay');
    overlay.classList.remove('opacity-0', 'pointer-events-none');
    document.getElementById('overlayTitle').innerText = 'GAME OVER';
    document.getElementById('overlaySub').innerText = `Final Score: ${score} | Lines: ${lines}`;
    document.getElementById('actionBtn').innerText = 'PLAY AGAIN';
}

// Keyboard Event Listeners
document.addEventListener('keydown', event => {
    if (!gameStarted) return;
    if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
        moveLeft();
    } else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
        moveRight();
    } else if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') {
        playerDrop();
    } else if (event.key === 'ArrowUp' || event.key === 'x' || event.key === 'X') {
        rotatePiece();
    } else if (event.code === 'Space') {
        event.preventDefault();
        hardDrop();
    } else if (event.key === 'c' || event.key === 'C' || event.key === 'Shift') {
        holdPieceAction();
    } else if (event.key === 'p' || event.key === 'P' || event.key === 'Escape') {
        togglePause();
    }
});

// Touch action wrapper
function handleTouchAction(action) {
    if (!gameStarted || isPaused || gameOver) return;
    if (action === 'left') moveLeft();
    if (action === 'right') moveRight();
    if (action === 'rotate') rotatePiece();
    if (action === 'drop') hardDrop();
    if (action === 'hold') holdPieceAction();
}

// Initial render preview
draw();