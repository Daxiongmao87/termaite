/**
 * CustomInput - A complete input implementation using blessed Box
 */
const blessed = require('blessed');

class CustomInput {
  constructor(options) {
    this.screen = options.screen;
    this.parent = options.parent;
    
    // History management
    this.historyManager = options.historyManager || null;
    this.userMessages = [];
    this.historyIndex = -1;
    this.originalInput = '';
    
    // Create a box instead of textbox
    this.box = blessed.box({
      parent: options.parent,
      top: options.top || 0,
      left: options.left || 0,
      right: options.right || 0,
      height: options.height || 1,
      style: options.style || {
        fg: 'white',
        bg: 'black'
      },
      tags: false,  // We'll handle rendering ourselves
      keys: true,   // Enable key handling
      input: true,  // Mark as input element
      focusable: true  // Make it focusable
    });
    
    // Input state
    this.value = '';
    this.cursorPos = 0;
    this.scrollOffset = 0;
    this.focused = false;
    
    // Load user messages from history if available
    if (this.historyManager) {
      this.loadUserMessages();
    }
    
    // Setup event handlers
    this.setupEventHandlers();
    
    // Defer initial render until after screen is ready
    process.nextTick(() => {
      this.render();
    });
  }
  
  setupEventHandlers() {
    // Handle keypress events when focused
    // Note: blessed forwards keypress to focused element automatically
    this.box.on('keypress', (ch, key) => {
      // Box receives keypress when it's the focused element
      
      let handled = false;
      
      // Navigation keys
      if (key.name === 'left') {
        if (this.cursorPos > 0) {
          if (key.ctrl) {
            this.moveToPreviousWord();
          } else {
            this.cursorPos--;
          }
          handled = true;
        }
      } else if (key.name === 'right') {
        if (this.cursorPos < this.value.length) {
          if (key.ctrl) {
            this.moveToNextWord();
          } else {
            this.cursorPos++;
          }
          handled = true;
        }
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
          handled = true;
        }
      } else if (key.name === 'delete') {
        if (this.cursorPos < this.value.length) {
          this.value = this.value.slice(0, this.cursorPos) + this.value.slice(this.cursorPos + 1);
          handled = true;
        }
      } else if (key.name === 'enter') {
        this.box.emit('submit', this.value);
        this.resetHistoryNavigation();
        handled = true;
      } else if (key.name === 'escape') {
        this.value = '';
        this.cursorPos = 0;
        this.resetHistoryNavigation();
        handled = true;
      } else if (key.name === 'up') {
        this.navigateUp();
        handled = true;
      } else if (key.name === 'down') {
        this.navigateDown();
        handled = true;
      } else if (ch && !key.ctrl && !key.meta) {
        // Regular character input
        if (!/^[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f\x0d]$/.test(ch)) {
          this.value = this.value.slice(0, this.cursorPos) + ch + this.value.slice(this.cursorPos);
          this.cursorPos++;
          handled = true;
        }
      }
      
      if (handled) {
        this.render();
        return false; // Prevent default
      }
    });
    
    // Handle focus
    this.box.on('focus', () => {
      this.focused = true;
      this.render();
    });
    
    this.box.on('blur', () => {
      this.focused = false;
      this.render();
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
  
  render() {
    // Get the actual width we have to work with
    const width = this.box.width;
    if (!width || width <= 0) return;
    
    // Calculate what portion of text to show
    let displayText = this.value;
    let displayCursorPos = this.cursorPos;
    
    // Handle scrolling if text is longer than width
    if (this.value.length >= width) {
      // Ensure cursor is visible
      if (this.cursorPos < this.scrollOffset) {
        // Cursor is before visible area, scroll left
        this.scrollOffset = this.cursorPos;
      } else if (this.cursorPos >= this.scrollOffset + width) {
        // Cursor is after visible area, scroll right
        this.scrollOffset = this.cursorPos - width + 1;
      }
      
      // Extract visible portion
      displayText = this.value.slice(this.scrollOffset, this.scrollOffset + width);
      displayCursorPos = this.cursorPos - this.scrollOffset;
    } else {
      this.scrollOffset = 0;
    }
    
    // Pad with spaces to clear any old content
    displayText = displayText.padEnd(width, ' ');
    
    // Set the box content
    this.box.setContent(displayText);
    
    // Position the cursor if we're focused
    if (this.focused && this.screen.program) {
      try {
        // Get absolute position of the box
        const pos = this.box._getPos();
        if (pos) {
          const absLeft = pos.xi + displayCursorPos;
          const absTop = pos.yi;
          
          // Move and show cursor
          this.screen.program.cup(absTop, absLeft);
          this.screen.program.showCursor();
        }
      } catch (e) {
        // Box not rendered yet, skip cursor positioning
      }
    } else if (this.screen.program) {
      // Hide cursor when not focused
      this.screen.program.hideCursor();
    }
    
    // Trigger screen render
    this.screen.render();
  }
  
  focus() {
    this.box.focus();
  }
  
  clearValue() {
    this.value = '';
    this.cursorPos = 0;
    this.scrollOffset = 0;
    this.resetHistoryNavigation();
    this.render();
  }
  
  getValue() {
    return this.value;
  }
  
  setValue(value) {
    this.value = value || '';
    this.cursorPos = this.value.length;
    this.render();
  }
  
  on(event, handler) {
    this.box.on(event, handler);
  }
  
  key(keys, handler) {
    this.box.key(keys, handler);
  }
  
  /**
   * Load user messages from dedicated user inputs file
   */
  loadUserMessages() {
    if (!this.historyManager) return;
    
    try {
      // Use dedicated user inputs file instead of chat history
      this.userMessages = this.historyManager.readUserInputs();
    } catch (error) {
      // Silently fail if history can't be loaded
      this.userMessages = [];
    }
  }
  
  /**
   * Navigate up in history (older messages)
   */
  navigateUp() {
    // Reload user messages to get latest
    this.loadUserMessages();
    
    if (this.userMessages.length === 0) return;
    
    if (this.historyIndex === -1) {
      // Starting navigation, save current input
      this.originalInput = this.value;
      this.historyIndex = 0;
    } else if (this.historyIndex < this.userMessages.length - 1) {
      // Move to older message
      this.historyIndex++;
    } else {
      // Already at oldest message
      return;
    }
    
    // Load the message from history (reverse order - newest first)
    const messageIndex = this.userMessages.length - 1 - this.historyIndex;
    this.value = this.userMessages[messageIndex];
    this.cursorPos = this.value.length;
    this.render();
  }
  
  /**
   * Navigate down in history (newer messages)
   */
  navigateDown() {
    if (this.historyIndex === -1) return; // Not navigating
    
    this.historyIndex--;
    
    if (this.historyIndex === -1) {
      // Restore original input
      this.value = this.originalInput;
      this.originalInput = '';
    } else {
      // Load the message from history
      const messageIndex = this.userMessages.length - 1 - this.historyIndex;
      this.value = this.userMessages[messageIndex];
    }
    
    this.cursorPos = this.value.length;
    this.render();
  }
  
  /**
   * Reset history navigation state
   */
  resetHistoryNavigation() {
    this.historyIndex = -1;
    this.originalInput = '';
  }
}

module.exports = CustomInput;