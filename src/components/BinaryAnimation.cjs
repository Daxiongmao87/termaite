class BinaryAnimation {
  constructor(chatUI) {
    this.chatUI = chatUI;
    this.animationInterval = null;
    this.currentPrompt = '';
    this.words = [];
    this.currentWordIndex = 0;
    this.currentBinary = '';
    this.currentPosition = 0;
    this.isTyping = true;
    this.pauseTimer = null;
    this.currentColor = 'white';
    
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
  }
  
  /**
   * Convert a word to binary representation with spaces between letters
   * @param {string} word - The word to convert
   * @returns {string} Binary representation with spaces
   */
  wordToBinary(word) {
    return word.split('').map(char => {
      const binary = char.charCodeAt(0).toString(2).padStart(8, '0');
      return binary;
    }).join(' ');
  }
  
  /**
   * Get a random color from the palette
   * @returns {string} Color name
   */
  getRandomColor() {
    return this.colors[Math.floor(Math.random() * this.colors.length)];
  }
  
  /**
   * Start the binary animation with the given prompt
   * @param {string} prompt - The prompt text to animate
   */
  start(prompt = '') {
    // Clear any existing animation
    this.stop();
    
    // Set up the prompt and words
    this.currentPrompt = prompt || 'Loading';
    this.words = this.currentPrompt.split(/\s+/).filter(word => word.length > 0);
    
    // If no words, use a default
    if (this.words.length === 0) {
      this.words = ['Processing'];
    }
    
    // Initialize animation state
    this.currentWordIndex = 0;
    this.prepareNextWord();
    
    // Start the animation loop
    this.animate();
  }
  
  /**
   * Prepare the next word for animation
   */
  prepareNextWord() {
    if (this.words.length === 0) return;
    
    // Loop back to start if we've gone through all words
    if (this.currentWordIndex >= this.words.length) {
      this.currentWordIndex = 0;
    }
    
    // Get the current word and convert to binary
    const word = this.words[this.currentWordIndex];
    this.currentBinary = this.wordToBinary(word);
    this.currentColor = this.getRandomColor();
    this.currentPosition = 0;
    this.isTyping = true;
  }
  
  /**
   * Perform one step of the animation
   */
  animate() {
    if (this.pauseTimer) return;
    
    if (this.isTyping) {
      // Typing phase
      if (this.currentPosition <= this.currentBinary.length) {
        // Display the typed portion with colors
        const typed = this.currentBinary.substring(0, this.currentPosition);
        const display = this.formatBinary(typed);
        this.chatUI.setProgressBar(display);
        this.currentPosition++;
        
        // Schedule next typing frame (4fps = 250ms)
        this.animationInterval = setTimeout(() => this.animate(), 250);
      } else {
        // Finished typing, pause for 2 seconds
        this.pauseTimer = setTimeout(() => {
          this.pauseTimer = null;
          this.isTyping = false;
          this.currentPosition = this.currentBinary.length;
          this.animate();
        }, 2000);
      }
    } else {
      // Erasing phase
      if (this.currentPosition > 0) {
        this.currentPosition--;
        const remaining = this.currentBinary.substring(0, this.currentPosition);
        const display = this.formatBinary(remaining);
        this.chatUI.setProgressBar(display);
        
        // Schedule next erasing frame (8fps = 125ms)
        this.animationInterval = setTimeout(() => this.animate(), 125);
      } else {
        // Finished erasing, pause for 1 second then move to next word
        this.pauseTimer = setTimeout(() => {
          this.pauseTimer = null;
          this.currentWordIndex++;
          this.prepareNextWord();
          this.animate();
        }, 1000);
      }
    }
  }
  
  /**
   * Format binary string with colors
   * @param {string} binary - The binary string to format
   * @returns {string} Formatted string with color tags
   */
  formatBinary(binary) {
    if (!binary) return ' ';
    
    // During typing, newly typed bits are white then settle to color
    // For simplicity, we'll show all typed bits in the word's color
    return `{${this.currentColor}-fg}${binary}{/${this.currentColor}-fg}`;
  }
  
  /**
   * Stop the binary animation
   */
  stop() {
    if (this.animationInterval) {
      clearTimeout(this.animationInterval);
      this.animationInterval = null;
    }
    
    if (this.pauseTimer) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }
    
    // Clear the progress bar
    this.chatUI.clearProgressBar();
  }
}

module.exports = BinaryAnimation;