class PuzzleGame {
  constructor() {
    this.canvas = document.getElementById('puzzleCanvas');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.revealOverlay = document.getElementById('revealOverlay');
    this.messageCard = document.getElementById('messageCard');
    this.hint = document.getElementById('hint');

    this.ROWS = 4;
    this.COLS = 3;
    this.TOTAL = this.ROWS * this.COLS;

    this.puzzleImage = new Image();
    this.puzzleImage.src = 'assets/img/pacs.jpg';

    this.pieces = [];
    this.draggedPiece = null;
    this.completedCount = 0;
    this.isComplete = false;

    this.init();
  }

  init() {
    this.setupCanvas();
    this.puzzleImage.onload = () => {
      this.createPieces();
      this.shufflePieces();
      this.render();
    };

    this.setupEventListeners();
    window.addEventListener('resize', () => this.handleResize());
  }

  setupCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    
    this.ctx.scale(dpr, dpr);
    
    this.canvasWidth = rect.width;
    this.canvasHeight = rect.height;
    this.pieceWidth = this.canvasWidth / this.COLS;
    this.pieceHeight = this.canvasHeight / this.ROWS;
  }

  createPieces() {
    this.pieces = [];
    
    for (let row = 0; row < this.ROWS; row++) {
      for (let col = 0; col < this.COLS; col++) {
        this.pieces.push({
          id: row * this.COLS + col,
          row,
          col,
          targetX: col * this.pieceWidth,
          targetY: row * this.pieceHeight,
          currentX: col * this.pieceWidth,
          currentY: row * this.pieceHeight,
          isPlaced: false,
          zIndex: 0
        });
      }
    }
  }

  shufflePieces() {
    // Create grid positions
    const positions = [];
    for (let row = 0; row < this.ROWS; row++) {
      for (let col = 0; col < this.COLS; col++) {
        positions.push({
          x: col * this.pieceWidth,
          y: row * this.pieceHeight
        });
      }
    }

    // Shuffle positions
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }

    // Assign shuffled positions with random offset
    this.pieces.forEach((piece, index) => {
      const pos = positions[index];
      const offsetX = (Math.random() - 0.5) * this.pieceWidth * 0.5;
      const offsetY = (Math.random() - 0.5) * this.pieceHeight * 0.5;
      
      piece.currentX = Math.max(0, Math.min(this.canvasWidth - this.pieceWidth, pos.x + offsetX));
      piece.currentY = Math.max(0, Math.min(this.canvasHeight - this.pieceHeight, pos.y + offsetY));
      piece.zIndex = index;
    });
  }

  render() {
    if (this.isComplete) return;

    this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Draw background
    this.ctx.fillStyle = '#0a0a0a';
    this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Draw target guides for empty slots
    this.pieces.forEach(piece => {
      if (!piece.isPlaced) {
        this.drawGuide(piece);
      }
    });

    // Draw placed pieces first
    this.pieces
      .filter(p => p.isPlaced)
      .forEach(piece => this.drawPiece(piece, true));

    // Draw floating pieces sorted by z-index
    this.pieces
      .filter(p => !p.isPlaced)
      .sort((a, b) => a.zIndex - b.zIndex)
      .forEach(piece => this.drawPiece(piece, false));
  }

  drawGuide(piece) {
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([6, 4]);
    this.ctx.strokeRect(
      piece.targetX + 2,
      piece.targetY + 2,
      this.pieceWidth - 4,
      this.pieceHeight - 4
    );
    this.ctx.setLineDash([]);

    // Draw number
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    this.ctx.font = 'bold 24px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(
      piece.id + 1,
      piece.targetX + this.pieceWidth / 2,
      piece.targetY + this.pieceHeight / 2
    );
    this.ctx.restore();
  }

  drawPiece(piece, isPlaced) {
    const img = this.puzzleImage;
    const srcX = piece.col * (img.width / this.COLS);
    const srcY = piece.row * (img.height / this.ROWS);
    const srcW = img.width / this.COLS;
    const srcH = img.height / this.ROWS;

    this.ctx.save();

    // Shadow for floating pieces
    if (!isPlaced) {
      this.ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      this.ctx.shadowBlur = 12;
      this.ctx.shadowOffsetX = 0;
      this.ctx.shadowOffsetY = 4;
    }

    // Draw image piece
    this.ctx.drawImage(
      img,
      srcX, srcY, srcW, srcH,
      piece.currentX,
      piece.currentY,
      this.pieceWidth,
      this.pieceHeight
    );

    // Border
    this.ctx.strokeStyle = isPlaced ? '#22c55e' : 'rgba(255, 255, 255, 0.7)';
    this.ctx.lineWidth = isPlaced ? 3 : 2;
    this.ctx.strokeRect(
      piece.currentX,
      piece.currentY,
      this.pieceWidth,
      this.pieceHeight
    );

    // Number badge for floating pieces
    if (!isPlaced) {
      const badgeSize = 26;
      const badgeX = piece.currentX + this.pieceWidth - badgeSize - 6;
      const badgeY = piece.currentY + this.pieceHeight - badgeSize - 6;

      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      this.ctx.fillRect(badgeX, badgeY, badgeSize, badgeSize);

      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(badgeX, badgeY, badgeSize, badgeSize);

      this.ctx.fillStyle = 'white';
      this.ctx.font = 'bold 13px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(
        piece.id + 1,
        badgeX + badgeSize / 2,
        badgeY + badgeSize / 2
      );
    }

    this.ctx.restore();
  }

  setupEventListeners() {
    // Mouse events
    this.canvas.addEventListener('mousedown', (e) => this.handleStart(e));
    window.addEventListener('mousemove', (e) => this.handleMove(e));
    window.addEventListener('mouseup', () => this.handleEnd());

    // Touch events
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.handleStart(e.touches[0]);
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (this.draggedPiece) {
        e.preventDefault();
        this.handleMove(e.touches[0]);
      }
    }, { passive: false });

    window.addEventListener('touchend', () => this.handleEnd());
  }

  getCanvasPosition(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  handleStart(event) {
    if (this.isComplete) return;

    const pos = this.getCanvasPosition(event);

    // Find clicked piece (reverse order to get topmost)
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const piece = this.pieces[i];
      if (piece.isPlaced) continue;

      if (this.isPieceHit(piece, pos)) {
        this.draggedPiece = piece;
        this.dragOffset = {
          x: pos.x - piece.currentX,
          y: pos.y - piece.currentY
        };

        // Bring to front
        const maxZ = Math.max(...this.pieces.map(p => p.zIndex));
        piece.zIndex = maxZ + 1;
        break;
      }
    }
  }

  handleMove(event) {
    if (!this.draggedPiece) return;

    const pos = this.getCanvasPosition(event);
    
    this.draggedPiece.currentX = Math.max(
      0,
      Math.min(
        this.canvasWidth - this.pieceWidth,
        pos.x - this.dragOffset.x
      )
    );
    
    this.draggedPiece.currentY = Math.max(
      0,
      Math.min(
        this.canvasHeight - this.pieceHeight,
        pos.y - this.dragOffset.y
      )
    );

    this.render();
  }

  handleEnd() {
    if (!this.draggedPiece) return;

    const piece = this.draggedPiece;
    const dx = piece.currentX - piece.targetX;
    const dy = piece.currentY - piece.targetY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const snapThreshold = Math.min(this.pieceWidth, this.pieceHeight) * 0.25;

    if (distance < snapThreshold) {
      piece.currentX = piece.targetX;
      piece.currentY = piece.targetY;
      
      if (!piece.isPlaced) {
        piece.isPlaced = true;
        this.completedCount++;
        this.createConfetti(piece);

        if (this.completedCount === this.TOTAL) {
          setTimeout(() => this.complete(), 500);
        }
      }
    }

    this.draggedPiece = null;
    this.render();
  }

  isPieceHit(piece, pos) {
    return pos.x >= piece.currentX &&
           pos.x <= piece.currentX + this.pieceWidth &&
           pos.y >= piece.currentY &&
           pos.y <= piece.currentY + this.pieceHeight;
  }

  createConfetti(piece) {
    const colors = ['#fbbf24', '#f59e0b', '#ec4899', '#8b5cf6'];
    const centerX = piece.targetX + this.pieceWidth / 2;
    const centerY = piece.targetY + this.pieceHeight / 2;

    for (let i = 0; i < 20; i++) {
      const particle = document.createElement('div');
      particle.style.cssText = `
        position: fixed;
        width: 8px;
        height: 8px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        border-radius: 50%;
        pointer-events: none;
        z-index: 1000;
      `;

      const rect = this.canvas.getBoundingClientRect();
      particle.style.left = (rect.left + centerX) + 'px';
      particle.style.top = (rect.top + centerY) + 'px';

      document.body.appendChild(particle);

      const angle = Math.random() * Math.PI * 2;
      const velocity = 2 + Math.random() * 3;
      const vx = Math.cos(angle) * velocity;
      const vy = Math.sin(angle) * velocity - 2;

      this.animateConfetti(particle, vx, vy);
    }
  }

  animateConfetti(element, vx, vy) {
    let x = 0, y = 0;
    let opacity = 1;

    const animate = () => {
      x += vx;
      y += vy;
      vy += 0.15;
      opacity -= 0.02;

      element.style.transform = `translate(${x}px, ${y}px)`;
      element.style.opacity = opacity;

      if (opacity > 0) {
        requestAnimationFrame(animate);
      } else {
        element.remove();
      }
    };

    animate();
  }

  complete() {
    this.isComplete = true;
    this.revealOverlay.classList.add('active');
    this.messageCard.classList.add('show');
    this.hint.style.display = 'none';
  }

  handleResize() {
    this.setupCanvas();
    if (this.puzzleImage.complete) {
      this.createPieces();
      if (!this.isComplete) {
        this.shufflePieces();
      }
      this.render();
    }
  }
}

// Start the game
new PuzzleGame();