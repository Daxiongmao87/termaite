class PipeAnimation {
  constructor(chatUI) {
    this.chatUI = chatUI;
    this.characters = {
      '╚': { endpoints: ['up', 'right'] },
      '╔': { endpoints: ['down', 'right'] },
      '╩': { endpoints: ['up', 'left', 'right'] },
      '╦': { endpoints: ['down', 'left', 'right'] },
      '╠': { endpoints: ['right', 'up', 'down'] },
      '═': { endpoints: ['left', 'right'] },
      '╬': { endpoints: ['left', 'right', 'up', 'down'] },
      '╣': { endpoints: ['left', 'up', 'down'] },
      '║': { endpoints: ['up', 'down'] },
      '╗': { endpoints: ['down', 'left'] },
      '╝': { endpoints: ['up', 'left'] }
    };
    
    this.directions = {
      'up': { opposite: 'down', delta: { x: 0, y: -1 } },
      'down': { opposite: 'up', delta: { x: 0, y: 1 } },
      'left': { opposite: 'right', delta: { x: -1, y: 0 } },
      'right': { opposite: 'left', delta: { x: 1, y: 0 } }
    };
    
    this.currentChar = null;
    this.currentEndpoint = null;
    this.animationInterval = null;
  }
  
  /**
   * Get compatible characters for a given endpoint
   * @param {string} endpoint - The endpoint to match
   * @returns {array} Array of compatible characters
   */
  getCompatibleCharacters(endpoint) {
    return Object.keys(this.characters).filter(char => {
      return this.characters[char].endpoints.includes(endpoint);
    });
  }
  
  /**
   * Start the pipe animation
   */
  start() {
    // Clear the progress bar
    this.chatUI.clearProgressBar();
    
    // Choose a random starting character
    const charKeys = Object.keys(this.characters);
    this.currentChar = charKeys[Math.floor(Math.random() * charKeys.length)];
    this.currentEndpoint = this.characters[this.currentChar].endpoints[
      Math.floor(Math.random() * this.characters[this.currentChar].endpoints.length)
    ];
    
    // Update the progress bar with the initial character
    this.chatUI.setProgressBar(this.currentChar);
    
    // Start the animation interval
    this.animationInterval = setInterval(() => {
      this.animate();
    }, 200); // Update every 200ms
  }
  
  /**
   * Perform one step of the animation
   */
  animate() {
    // Get the opposite endpoint (the one we're connecting to)
    const oppositeEndpoint = this.directions[this.currentEndpoint].opposite;
    
    // Get compatible characters for the opposite endpoint
    const compatibleChars = this.getCompatibleCharacters(oppositeEndpoint);
    
    // Choose a random compatible character
    this.currentChar = compatibleChars[Math.floor(Math.random() * compatibleChars.length)];
    
    // Choose a random endpoint from the new character (excluding the one we just used)
    const availableEndpoints = this.characters[this.currentChar].endpoints.filter(
      endpoint => endpoint !== oppositeEndpoint
    );
    
    if (availableEndpoints.length > 0) {
      this.currentEndpoint = availableEndpoints[
        Math.floor(Math.random() * availableEndpoints.length)
      ];
    } else {
      // If no other endpoints, use the opposite endpoint (this will create a straight line)
      this.currentEndpoint = oppositeEndpoint;
    }
    
    // Update the progress bar
    this.chatUI.setProgressBar(this.currentChar);
  }
  
  /**
   * Stop the pipe animation
   */
  stop() {
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.animationInterval = null;
    }
    
    // Clear the progress bar
    this.chatUI.clearProgressBar();
  }
}

module.exports = PipeAnimation;