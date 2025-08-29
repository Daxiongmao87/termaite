class SpinnerAnimation {
  constructor(chatUI) {
    this.chatUI = chatUI;
    this.animationInterval = null;
    this.isRunning = false;
    this.startTime = null;
    this.timeoutSeconds = null;
    
    // Spinner sequence: ◜ ◝ ◞ ◟
    this.spinnerFrames = ['◜ ', ' ◝', ' ◞', '◟ '];
    this.currentFrame = 0;
    
    // Color palette for random selection - using hex colors for better terminal compatibility
    this.colors = [
      '#FF6B6B', // Bright red
      '#4ECDC4', // Bright teal
      '#45B7D1', // Bright blue
      '#96CEB4', // Mint green
      '#FFEAA7', // Bright yellow
      '#DDA0DD', // Plum
      '#BB8FCE', // Light purple
      '#85C1E9'  // Sky blue
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
   * Format time in seconds to hh:mm:ss or mm:ss or ss format
   * @param {number} seconds - Time in seconds
   * @returns {string} Formatted time string
   */
  formatTime(seconds) {
    const totalSeconds = Math.floor(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else if (minutes > 0) {
      return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${secs.toString().padStart(2, '0')}`;
    }
  }
  
  /**
   * Start the spinner animation
   * @param {number} timeoutSeconds - Optional timeout in seconds
   */
  start(timeoutSeconds = null) {
    // Clear any existing animation
    this.stop();
    
    this.isRunning = true;
    this.currentFrame = 0;
    this.currentColor = this.getRandomColor();
    this.startTime = Date.now();
    this.timeoutSeconds = timeoutSeconds;
    
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
    
    // Calculate elapsed time and build stopwatch display
    let stopwatchDisplay = '';
    if (this.startTime) {
      const elapsedMs = Date.now() - this.startTime;
      const elapsedSeconds = elapsedMs / 1000;
      const elapsedTime = this.formatTime(elapsedSeconds);
      
      if (this.timeoutSeconds && this.timeoutSeconds > 0) {
        const totalTime = this.formatTime(this.timeoutSeconds);
        stopwatchDisplay = ` (${elapsedTime} / ${totalTime})`;
      } else {
        stopwatchDisplay = ` (${elapsedTime})`;
      }
    }
    
    const display = `{bold}{${this.currentColor}-fg}${frame}{/${this.currentColor}-fg}{/bold}${stopwatchDisplay} {gray-fg}Esc to cancel{/gray-fg}`;
    
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
    
    // Clear timing information
    this.startTime = null;
    this.timeoutSeconds = null;
    
    // Clear the progress bar
    this.chatUI.clearProgressBar();
  }
}

module.exports = SpinnerAnimation;