import './snake.css';

// Snake Game Implementation
class SnakeGame {
	constructor() {
		this.canvas = document.getElementById('gameCanvas');
		this.ctx = this.canvas.getContext('2d');
		this.scoreElement = document.getElementById('score');
		this.highScoreElement = document.getElementById('highScore');

		// Game settings
		this.gridSize = 20;
		this.canvasSize = 400;
		this.canvas.width = this.canvasSize;
		this.canvas.height = this.canvasSize;

		// Game state
		this.snake = [{ x: 200, y: 200 }];
		this.food = this.generateFood();
		this.dx = 0;
		this.dy = 0;
		this.score = 0;
		this.highScore = this.getHighScore();
		this.gameRunning = false;
		this.gamePaused = false;
		this.gameLoop = null;

		// Initialize the game
		this.init();
	}

	init() {
		this.updateScore();
		this.updateHighScore();
		this.setupEventListeners();
		this.draw();
		this.showStartMessage();
	}

	setupEventListeners() {
		// Keyboard controls
		document.addEventListener('keydown', (e) => {
			this.handleKeyPress(e.key.toLowerCase());
		});

		// Mobile controls
		document.querySelectorAll('[data-direction]').forEach((btn) => {
			btn.addEventListener('click', () => {
				this.changeDirection(btn.dataset.direction);
			});
		});

		// Game control buttons
		document.getElementById('pauseBtn').addEventListener('click', () => {
			this.togglePause();
		});

		document.getElementById('restartBtn').addEventListener('click', () => {
			this.restart();
		});
	}

	handleKeyPress(key) {
		switch (key) {
			case 'arrowup':
			case 'w':
				this.changeDirection('up');
				break;
			case 'arrowdown':
			case 's':
				this.changeDirection('down');
				break;
			case 'arrowleft':
			case 'a':
				this.changeDirection('left');
				break;
			case 'arrowright':
			case 'd':
				this.changeDirection('right');
				break;
			case ' ':
				this.togglePause();
				break;
			case 'r':
				this.restart();
				break;
		}
	}

	changeDirection(direction) {
		if (!this.gameRunning && !this.gamePaused) {
			this.start();
		}

		const goingUp = this.dy === -this.gridSize;
		const goingDown = this.dy === this.gridSize;
		const goingRight = this.dx === this.gridSize;
		const goingLeft = this.dx === -this.gridSize;

		switch (direction) {
			case 'up':
				if (!goingDown) {
					this.dx = 0;
					this.dy = -this.gridSize;
				}
				break;
			case 'down':
				if (!goingUp) {
					this.dx = 0;
					this.dy = this.gridSize;
				}
				break;
			case 'left':
				if (!goingRight) {
					this.dx = -this.gridSize;
					this.dy = 0;
				}
				break;
			case 'right':
				if (!goingLeft) {
					this.dx = this.gridSize;
					this.dy = 0;
				}
				break;
		}
	}

	start() {
		if (this.gameRunning) return;

		this.gameRunning = true;
		this.gamePaused = false;
		this.gameLoop = setInterval(() => {
			if (!this.gamePaused) {
				this.update();
				this.draw();
			}
		}, 150);

		this.updatePauseButton();
	}

	togglePause() {
		if (!this.gameRunning) return;

		this.gamePaused = !this.gamePaused;
		this.updatePauseButton();

		if (this.gamePaused) {
			this.showPauseMessage();
		} else {
			this.draw();
		}
	}

	updatePauseButton() {
		const pauseBtn = document.getElementById('pauseBtn');
		pauseBtn.textContent = this.gamePaused ? 'Resume' : 'Pause';
	}

	restart() {
		this.stop();
		this.snake = [{ x: 200, y: 200 }];
		this.food = this.generateFood();
		this.dx = 0;
		this.dy = 0;
		this.score = 0;
		this.updateScore();
		this.draw();
		this.showStartMessage();
	}

	stop() {
		this.gameRunning = false;
		this.gamePaused = false;
		if (this.gameLoop) {
			clearInterval(this.gameLoop);
			this.gameLoop = null;
		}
		this.updatePauseButton();
	}

	update() {
		const head = { x: this.snake[0].x + this.dx, y: this.snake[0].y + this.dy };

		// Check wall collision
		if (
			head.x < 0 ||
			head.x >= this.canvasSize ||
			head.y < 0 ||
			head.y >= this.canvasSize
		) {
			this.gameOver();
			return;
		}

		// Check self collision
		for (let segment of this.snake) {
			if (head.x === segment.x && head.y === segment.y) {
				this.gameOver();
				return;
			}
		}

		this.snake.unshift(head);

		// Check food collision
		if (head.x === this.food.x && head.y === this.food.y) {
			this.score++;
			this.updateScore();
			this.food = this.generateFood();

			// Update high score
			if (this.score > this.highScore) {
				this.highScore = this.score;
				this.updateHighScore();
				this.saveHighScore();
			}
		} else {
			this.snake.pop();
		}
	}

	generateFood() {
		let food;
		do {
			food = {
				x: Math.floor(Math.random() * (this.canvasSize / this.gridSize)) * this.gridSize,
				y: Math.floor(Math.random() * (this.canvasSize / this.gridSize)) * this.gridSize,
			};
		} while (this.snake.some((segment) => segment.x === food.x && segment.y === food.y));

		return food;
	}

	draw() {
		// Clear canvas
		this.ctx.fillStyle = '#000000';
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

		// Draw snake
		this.ctx.fillStyle = '#00ff88';
		for (let i = 0; i < this.snake.length; i++) {
			const segment = this.snake[i];
			this.ctx.fillRect(segment.x, segment.y, this.gridSize - 2, this.gridSize - 2);

			// Draw snake head differently
			if (i === 0) {
				this.ctx.fillStyle = '#00cc6a';
				this.ctx.fillRect(segment.x + 2, segment.y + 2, this.gridSize - 6, this.gridSize - 6);
				this.ctx.fillStyle = '#00ff88';
			}
		}

		// Draw food
		this.ctx.fillStyle = '#ff3333';
		this.ctx.fillRect(this.food.x, this.food.y, this.gridSize - 2, this.gridSize - 2);

		// Add food glow effect
		this.ctx.shadowColor = '#ff3333';
		this.ctx.shadowBlur = 10;
		this.ctx.fillRect(this.food.x + 2, this.food.y + 2, this.gridSize - 6, this.gridSize - 6);
		this.ctx.shadowBlur = 0;
	}

	showStartMessage() {
		this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

		this.ctx.fillStyle = '#ffffff';
		this.ctx.font = '24px Arial';
		this.ctx.textAlign = 'center';
		this.ctx.fillText('Press any arrow key', this.canvas.width / 2, this.canvas.height / 2 - 20);
		this.ctx.fillText('or WASD to start!', this.canvas.width / 2, this.canvas.height / 2 + 20);
	}

	showPauseMessage() {
		this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

		this.ctx.fillStyle = '#00ff88';
		this.ctx.font = '32px Arial';
		this.ctx.textAlign = 'center';
		this.ctx.fillText('PAUSED', this.canvas.width / 2, this.canvas.height / 2);
	}

	gameOver() {
		this.stop();
		this.showGameOverDialog();
	}

	showGameOverDialog() {
		const overlay = document.createElement('div');
		overlay.className = 'game-over-overlay';

		const content = document.createElement('div');
		content.className = 'game-over-content';

		content.innerHTML = `
			<h2>Game Over!</h2>
			<p>Your Score: ${this.score}</p>
			<p>High Score: ${this.highScore}</p>
			<button onclick="this.parentElement.parentElement.remove(); game.restart();">Play Again</button>
		`;

		overlay.appendChild(content);
		document.body.appendChild(overlay);

		// Auto remove overlay after 5 seconds and restart
		setTimeout(() => {
			if (document.body.contains(overlay)) {
				overlay.remove();
				this.restart();
			}
		}, 5000);
	}

	updateScore() {
		this.scoreElement.textContent = this.score;
	}

	updateHighScore() {
		this.highScoreElement.textContent = this.highScore;
	}

	getHighScore() {
		return parseInt(localStorage.getItem('snakeHighScore')) || 0;
	}

	saveHighScore() {
		localStorage.setItem('snakeHighScore', this.highScore.toString());
	}
}

// Initialize the game when the page loads
let game;

document.addEventListener('DOMContentLoaded', () => {
	game = new SnakeGame();
});

// Make game accessible globally for the game over dialog
window.game = game;