class SpinnerAnimation {
  constructor(chatUI) {
    this.chatUI = chatUI;
    this.animationInterval = null;
    this.isRunning = false;
    
    // Spinner sequence: ◜ ◝ ◞ ◟
    this.spinnerFrames = ['◜ ', ' ◝', ' ◞', '◟ '];
    this.currentFrame = 0;
    
    // Color palette for random selection
    this.colors = [
      'red',
      'green', 
      'yellow',
      'blue',
      'magenta',
      'cyan',
      'white'
    ];
    
    this.currentColor = this.getRandomColor();
  }
  
  /**
   * Get a random color from the palette
   * @returns {string} Color name
   */
  getRandomColor() {
    return this.colors[Math.floor(Math.random() * this.colors.length)];
  }
  
  /**
   * Start the spinner animation
   */
  start() {
    // Clear any existing animation
    this.stop();
    
    this.isRunning = true;
    this.currentFrame = 0;
    this.currentColor = this.getRandomColor();
    
    // Start the animation loop at 15fps (66.67ms)
    this.animate();
  }
  
  /**
   * Perform one step of the animation
   */
  animate() {
    if (!this.isRunning) return;
    
    // Get current spinner frame with color and bold
    const frame = this.spinnerFrames[this.currentFrame];
    const display = `{bold}{${this.currentColor}-fg}${frame}{/${this.currentColor}-fg}{/bold} {gray-fg}Esc to cancel{/gray-fg}`;
    
    // Update spinner in chat log
    this.chatUI.setProgressBar(display);
    
    // Move to next frame
    this.currentFrame = (this.currentFrame + 1) % this.spinnerFrames.length;
    
    // Change color after full revolution
    if (this.currentFrame === 0) {
      this.currentColor = this.getRandomColor();
    }
    
    // Schedule next frame at 15fps (66.67ms)
    this.animationInterval = setTimeout(() => this.animate(), 67);
  }
  
  /**
   * Stop the spinner animation
   */
  stop() {
    this.isRunning = false;
    
    if (this.animationInterval) {
      clearTimeout(this.animationInterval);
      this.animationInterval = null;
    }
    
    // Clear the progress bar
    this.chatUI.clearProgressBar();
  }
}

module.exports = SpinnerAnimation;