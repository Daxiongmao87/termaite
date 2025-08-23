/**
 * EnhancedInput - A wrapper around blessed.textbox with proper cursor navigation
 */
class EnhancedInput {
  constructor(textbox, screen) {
    this.textbox = textbox;
    this.screen = screen;
    this.value = '';
    this.cursorPos = 0;
    
    // Override the default textbox behavior
    this.setupKeyHandlers();
    
    // Defer initial display update until after rendering
    process.nextTick(() => {
      this.updateDisplay();
    });
  }
  
  setupKeyHandlers() {
    // Remove default textbox listeners
    this.textbox.removeAllListeners('keypress');
    
    // Add our custom key handler
    this.textbox.on('keypress', (ch, key) => {
      let handled = false;
      let oldValue = this.value;
      let oldPos = this.cursorPos;
      
      // Navigation keys
      if (key.name === 'left') {
        if (this.cursorPos > 0) {
          if (key.ctrl) {
            // Move to previous word boundary
            this.moveToPreviousWord();
          } else {
            this.cursorPos--;
          }
        }
        handled = true;
      } else if (key.name === 'right') {
        if (this.cursorPos < this.value.length) {
          if (key.ctrl) {
            // Move to next word boundary
            this.moveToNextWord();
          } else {
            this.cursorPos++;
          }
        }
        handled = true;
      } else if (key.name === 'home' || (key.ctrl && key.name === 'a')) {
        this.cursorPos = 0;
        handled = true;
      } else if (key.name === 'end' || (key.ctrl && key.name === 'e')) {
        this.cursorPos = this.value.length;
        handled = true;
      } else if (key.name === 'backspace') {
        if (this.cursorPos > 0) {
          this.value = this.value.slice(0, this.cursorPos - 1) + this.value.slice(this.cursorPos);
          this.cursorPos--;
        }
        handled = true;
      } else if (key.name === 'delete') {
        if (this.cursorPos < this.value.length) {
          this.value = this.value.slice(0, this.cursorPos) + this.value.slice(this.cursorPos + 1);
        }
        handled = true;
      } else if (key.name === 'enter') {
        // Emit submit event
        this.textbox.emit('submit', this.value);
        handled = true;
      } else if (key.name === 'escape') {
        // Clear input
        this.value = '';
        this.cursorPos = 0;
        handled = true;
      } else if (ch && !key.ctrl) {
        // Regular character input
        if (!/^[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]$/.test(ch)) {
          this.value = this.value.slice(0, this.cursorPos) + ch + this.value.slice(this.cursorPos);
          this.cursorPos++;
          handled = true;
        }
      }
      
      // Update display if something changed
      if (handled && (this.value !== oldValue || this.cursorPos !== oldPos)) {
        this.updateDisplay();
        this.screen.render();
      }
      
      // Prevent default handling if we handled it
      if (handled) {
        return false;
      }
    });
  }
  
  moveToPreviousWord() {
    let pos = this.cursorPos;
    
    // Skip current whitespace backwards
    while (pos > 0 && /\s/.test(this.value[pos - 1])) {
      pos--;
    }
    
    // Skip word characters backwards
    while (pos > 0 && !/\s/.test(this.value[pos - 1])) {
      pos--;
    }
    
    this.cursorPos = pos;
  }
  
  moveToNextWord() {
    let pos = this.cursorPos;
    const len = this.value.length;
    
    // Skip current word characters forwards
    while (pos < len && !/\s/.test(this.value[pos])) {
      pos++;
    }
    
    // Skip whitespace forwards
    while (pos < len && /\s/.test(this.value[pos])) {
      pos++;
    }
    
    this.cursorPos = pos;
  }
  
  updateDisplay() {
    // Make sure textbox is rendered and has width
    if (!this.textbox.width || !this.screen.program) return;
    
    // Calculate visible portion of text based on textbox width
    const width = this.textbox.width - 2; // Account for padding
    let displayText = this.value;
    let displayCursor = this.cursorPos;
    
    // If text is longer than width, scroll to keep cursor visible
    if (this.value.length > width && width > 0) {
      if (this.cursorPos > width - 1) {
        // Scroll left to keep cursor in view
        const offset = this.cursorPos - width + 1;
        displayText = this.value.slice(offset);
        displayCursor = this.cursorPos - offset;
      } else {
        displayText = this.value.slice(0, width);
      }
    }
    
    // Set the content directly without using setValue to avoid duplication
    this.textbox.setContent(displayText);
    
    // Update the internal value that blessed tracks
    this.textbox.value = this.value;
    
    // Try to position cursor if textbox is visible
    try {
      // Use blessed's absolute positioning if available
      if (this.textbox.screen && this.textbox.visible) {
        const absLeft = this.textbox.aleft + displayCursor;
        const absTop = this.textbox.atop;
        
        // Move cursor to correct position
        this.screen.program.cup(absTop, absLeft);
        this.screen.program.showCursor();
      }
    } catch (e) {
      // Silently ignore positioning errors during initialization
    }
  }
  
  clearValue() {
    this.value = '';
    this.cursorPos = 0;
    this.updateDisplay();
    this.screen.render();
  }
  
  getValue() {
    return this.value;
  }
  
  setValue(value) {
    this.value = value || '';
    this.cursorPos = this.value.length;
    this.updateDisplay();
    this.screen.render();
  }
  
  focus() {
    this.textbox.focus();
    // Only update display if screen is ready
    if (this.textbox.screen) {
      this.updateDisplay();
    }
  }
}

module.exports = EnhancedInput;