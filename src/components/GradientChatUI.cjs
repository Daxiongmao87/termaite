const blessed = require('blessed');

class GradientChatUI {
  constructor() {
    // Create a screen object.
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'TERMAITE',
      mouse: true  // Enable mouse support for scrolling
    });

    // Track raw messages with tags for proper rendering
    this.rawMessages = [];
    
    // Track spinner state
    this.spinnerShowing = false;
    this.messagesBeforeSpinner = [];

    // Define gradient colors (simplified for terminal)
    // Using a range of blue to cyan colors
    this.gradientColors = [
      '#0000FF', // Blue
      '#0033FF',
      '#0066FF',
      '#0099FF',
      '#00CCFF',
      '#00FFFF'  // Cyan
    ];

    // Create main container with double-line border
    // Using 'double' type which now properly renders double-line characters
    this.mainContainer = blessed.box({
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      tags: true,
      border: {
        type: 'double'
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: this.gradientColors[this.gradientColors.length - 1] // Cyan border
        }
      }
    });

    // Create a custom title box that overlays the top border
    this.titleBox = blessed.box({
      parent: this.mainContainer,
      top: -1, // Position on the border
      left: 'center',
      width: 14, // Width of " [ termaite ] "
      height: 1,
      content: this.getGradientTitleText(),
      tags: true,
      style: {
        fg: 'white',
        bg: 'black',
        transparent: true
      }
    });

    // Create the chat box inside the main container
    // Note: Width is -2 to account for left and right borders of parent
    this.chatBox = blessed.log({
      parent: this.mainContainer,
      top: 0,
      left: 0,
      width: '100%-2',
      height: '100%-4', // Leave space for input with margins
      content: '',
      tags: true,
      padding: {
        left: 2,
        right: 2,
        top: 1,
        bottom: 1
      },
      style: {
        fg: 'white',
        bg: 'black'
      },
      // Enable scrolling
      scrollable: true,
      alwaysScroll: true,
      mouse: true,  // Enable mouse wheel support
      scrollbar: {
        ch: ' ',
        inverse: true
      }
    });


    // Create a container for the prompt and input
    this.inputContainer = blessed.box({
      parent: this.mainContainer,
      bottom: 1, // Add 1 line margin from bottom
      left: 1,   // Add 1 char margin from left
      width: '100%-4', // Account for borders (2) and margins (2)
      height: 3,
      border: {
        type: 'line' // Single line border for input
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: '#808080' // Gray border for input
        }
      }
    });

    // Create the prompt character
    this.promptChar = blessed.text({
      parent: this.inputContainer,
      content: ' > ',
      top: 0,
      left: 0,
      height: 1,
      width: 3,
      style: {
        fg: 'green',
        bg: 'black'
      }
    });

    // Create the input box next to the prompt
    // Using textarea for better cursor control but limiting to single line
    this.inputBox = blessed.textarea({
      parent: this.inputContainer,
      top: 0,
      left: 3, // Start after the prompt with space
      right: 0, // Extend to the right edge of container's content area
      height: 1,
      tags: true,
      inputOnFocus: true, // Enable input when focused
      keys: true,         // Enable keyboard input
      mouse: true,        // Enable mouse support
      style: {
        fg: 'white',
        bg: 'black',
        focus: {
          fg: 'white',
          bg: 'black'
        }
      }
    });
    
    // Setup enhanced keyboard navigation for the input box
    this.setupInputNavigation();
    
    // Add submit functionality to textarea and prevent multiline
    this.inputBox.key(['enter'], () => {
      const value = this.inputBox.getValue();
      // Don't allow newlines, use enter for submit
      if (value !== undefined) {
        this.inputBox.emit('submit', value.replace(/\n/g, ''));
      }
      return false; // Prevent default enter behavior (newline)
    });

    // Append main container to the screen
    this.screen.append(this.mainContainer);

    // Setup scrolling event handlers
    this.setupScrollHandlers();

    // Handle Ctrl+C to exit - set this up before focusing input
    this.screen.key(['C-c'], () => {
      this.screen.leave();
      process.exit(0);
    });

    // Also handle escape and q
    this.screen.key(['escape', 'q'], () => {
      this.screen.leave();
      process.exit(0);
    });

    // Focus our input box
    this.inputBox.focus();

    // Render the screen.
    this.screen.render();
  }

  /**
   * Setup enhanced keyboard navigation for input box
   */
  setupInputNavigation() {
    // The blessed.textarea already supports:
    // - Left/Right arrow keys for cursor movement
    // - Home/End keys for beginning/end of line
    // - Ctrl+A for beginning of line
    // - Ctrl+E for end of line
    // - Ctrl+Left/Right for word navigation (may need to add)
    
    // Add Ctrl+Left for word navigation backwards
    this.inputBox.key(['C-left'], () => {
      const value = this.inputBox.getValue();
      let pos = this.inputBox.screen.program.x - this.inputBox.aleft - 1; // Current cursor position
      
      // Move cursor to previous word boundary
      if (pos > 0) {
        // Skip current whitespace
        while (pos > 0 && /\s/.test(value[pos - 1])) {
          pos--;
        }
        // Skip word characters
        while (pos > 0 && !/\s/.test(value[pos - 1])) {
          pos--;
        }
      }
      
      // Set cursor position
      this.inputBox.screen.program.cup(this.inputBox.atop, this.inputBox.aleft + pos);
      this.screen.render();
    });
    
    // Add Ctrl+Right for word navigation forwards
    this.inputBox.key(['C-right'], () => {
      const value = this.inputBox.getValue();
      let pos = this.inputBox.screen.program.x - this.inputBox.aleft - 1; // Current cursor position
      const len = value.length;
      
      // Move cursor to next word boundary
      if (pos < len) {
        // Skip word characters
        while (pos < len && !/\s/.test(value[pos])) {
          pos++;
        }
        // Skip whitespace
        while (pos < len && /\s/.test(value[pos])) {
          pos++;
        }
      }
      
      // Set cursor position
      this.inputBox.screen.program.cup(this.inputBox.atop, this.inputBox.aleft + pos);
      this.screen.render();
    });
  }
  
  /**
   * Setup scroll handlers for the chat box
   */
  setupScrollHandlers() {
    // Handle PageUp/PageDown on the INPUT BOX since it always has focus
    // This ensures they work no matter what
    this.inputBox.key(['pageup'], () => {
      const scrollAmount = Math.floor(this.chatBox.height * 0.8); // Scroll 80% of visible height
      this.chatBox.scroll(-scrollAmount);
      this.screen.render();
      return false; // Prevent event from bubbling
    });

    this.inputBox.key(['pagedown'], () => {
      const scrollAmount = Math.floor(this.chatBox.height * 0.8); // Scroll 80% of visible height
      this.chatBox.scroll(scrollAmount);
      this.screen.render();
      return false; // Prevent event from bubbling
    });

    // For true single-line scrolling, we need to override blessed's default behavior
    // First clear any existing wheel handlers
    const wheelDownListeners = this.chatBox.listeners('wheeldown');
    const wheelUpListeners = this.chatBox.listeners('wheelup');
    
    // Remove blessed's default handlers (they scroll by height/2)
    wheelDownListeners.forEach(listener => {
      this.chatBox.removeListener('wheeldown', listener);
    });
    wheelUpListeners.forEach(listener => {
      this.chatBox.removeListener('wheelup', listener);
    });
    
    // Add our own single-line scroll handlers
    this.chatBox.on('wheeldown', () => {
      this.chatBox.scroll(1); // Exactly 1 line down
      this.screen.render();
      return false; // Prevent default behavior
    });

    this.chatBox.on('wheelup', () => {
      this.chatBox.scroll(-1); // Exactly 1 line up
      this.screen.render();
      return false; // Prevent default behavior
    });
  }

  /**
   * Get the title text with gradient colors
   * @returns {string} The formatted title text
   */
  getGradientTitleText() {
    // Apply gradient: t=red, e=yellow, r=green, m=cyan, ai=white, t=blue, e=magenta
    const t1 = '{red-fg}t{/red-fg}';
    const e1 = '{yellow-fg}e{/yellow-fg}';
    const r = '{green-fg}r{/green-fg}';
    const m = '{cyan-fg}m{/cyan-fg}';
    const ai = '{white-fg}ai{/white-fg}';
    const t2 = '{blue-fg}t{/blue-fg}';
    const e2 = '{magenta-fg}e{/magenta-fg}';
    
    return ` [ ${t1}${e1}${r}${m}${ai}${t2}${e2} ] `;
  }

  /**
   * Add a message to the chat box
   * @param {string} message - The message to add
   * @param {string} sender - The sender of the message ('user', 'system', 'agent')
   */
  addMessage(message, sender) {
    let formattedMessage = '';
    switch (sender) {
      case 'user':
        formattedMessage = `{bold}You:{/bold} ${message}`;
        break;
      case 'agent':
        formattedMessage = `{bold}Agent:{/bold} ${message}`;
        break;
      case 'system':
      default:
        formattedMessage = `{gray-fg}System:{/gray-fg} ${message}`;
        break;
    }
    
    // If spinner is showing, we need to remove it first
    if (this.spinnerShowing) {
      this.clearProgressBar();
    }
    
    // Track the message
    this.messagesBeforeSpinner.push(formattedMessage);
    
    // Use the log widget's add method which properly handles tags
    this.chatBox.add(formattedMessage);
    this.screen.render();
  }

  /**
   * Clear the chat display
   */
  clearChat() {
    this.chatBox.setContent('');
    this.rawMessages = [];
    this.messagesBeforeSpinner = [];
    this.spinnerShowing = false;
    this.screen.render();
  }

  /**
   * Get the input box element
   * @returns {object} The input box element
   */
  getInputBox() {
    return this.inputBox;
  }

  /**
   * Get the screen element
   * @returns {object} The screen element
   */
  getScreen() {
    return this.screen;
  }

  /**
   * Get the chat box element
   * @returns {object} The chat box element
   */
  getChatBox() {
    return this.chatBox;
  }

  /**
   * Set the spinner animation character
   * @param {string} content - The spinner character to display
   */
  setProgressBar(content) {
    // If spinner is already showing, we need to redraw everything
    if (this.spinnerShowing) {
      // Restore messages without spinner
      this.chatBox.setContent('');
      this.messagesBeforeSpinner.forEach(msg => {
        this.chatBox.add(msg);
      });
    }
    
    // Add the new spinner line
    this.chatBox.add(content);
    this.spinnerShowing = true;
    this.screen.render();
  }

  /**
   * Clear the spinner animation
   */
  clearProgressBar() {
    if (this.spinnerShowing) {
      // Restore all messages without the spinner
      this.chatBox.setContent('');
      this.messagesBeforeSpinner.forEach(msg => {
        this.chatBox.add(msg);
      });
      this.spinnerShowing = false;
    }
    this.screen.render();
  }

  /**
   * Display the welcome message with ASCII art
   */
  displayWelcomeMessage() {
    const asciiArt = this.generateAsciiArt();
    const welcomeText = '{center}{bold}Welcome to{/bold}{/center}\n\n';
    const helpText = '\n\n{center}Type {bold}/help{/bold} to see available commands{/center}\n';
    
    // Set initial content for the log widget
    const welcomeContent = welcomeText + asciiArt + helpText;
    this.chatBox.setContent(welcomeContent);
    this.screen.render();
  }

  /**
   * Generate ASCII art for TERMAITE with gradient colors
   * @returns {string} The formatted ASCII art
   */
  generateAsciiArt() {
    // Large ASCII art for TERMAITE with gradient colors
    // T = red, E = yellow, R = green, M = cyan, AI = white, T = blue, E = magenta
    const lines = [
      '{center}{red-fg}███████████{/red-fg} {yellow-fg}██████████{/yellow-fg} {green-fg}███████████{/green-fg}   {cyan-fg}██████   ██████{/cyan-fg}   {white-fg}█████████   █████{/white-fg} {blue-fg}███████████{/blue-fg} {magenta-fg}██████████{/magenta-fg}{/center}',
      '{center}{red-fg}░█░░░███░░░█{/red-fg}{yellow-fg}░░███░░░░░█{/yellow-fg}{green-fg}░░███░░░░░███{/green-fg} {cyan-fg}░░██████ ██████{/cyan-fg}   {white-fg}███░░░░░███ ░░███{/white-fg} {blue-fg}░█░░░███░░░█{/blue-fg}{magenta-fg}░░███░░░░░█{/magenta-fg}{/center}',
      '{center}{red-fg}░   ░███  ░{/red-fg}  {yellow-fg}░███  █ ░{/yellow-fg}  {green-fg}░███    ░███{/green-fg}  {cyan-fg}░███░█████░███{/cyan-fg}  {white-fg}░███    ░███  ░███{/white-fg} {blue-fg}░   ░███  ░{/blue-fg}  {magenta-fg}░███  █ ░{/magenta-fg} {/center}',
      '{center}    {red-fg}░███{/red-fg}     {yellow-fg}░██████{/yellow-fg}    {green-fg}░██████████{/green-fg}   {cyan-fg}░███░░███ ░███{/cyan-fg}  {white-fg}░███████████  ░███{/white-fg}     {blue-fg}░███{/blue-fg}     {magenta-fg}░██████{/magenta-fg}   {/center}',
      '{center}    {red-fg}░███{/red-fg}     {yellow-fg}░███░░█{/yellow-fg}    {green-fg}░███░░░░░███{/green-fg}  {cyan-fg}░███ ░░░  ░███{/cyan-fg}  {white-fg}░███░░░░░███  ░███{/white-fg}     {blue-fg}░███{/blue-fg}     {magenta-fg}░███░░█{/magenta-fg}   {/center}',
      '{center}    {red-fg}░███{/red-fg}     {yellow-fg}░███ ░   █{/yellow-fg} {green-fg}░███    ░███{/green-fg}  {cyan-fg}░███      ░███{/cyan-fg}  {white-fg}░███    ░███  ░███{/white-fg}     {blue-fg}░███{/blue-fg}     {magenta-fg}░███ ░   █{/magenta-fg}{/center}',
      '{center}    {red-fg}█████{/red-fg}    {yellow-fg}██████████{/yellow-fg} {green-fg}█████   █████{/green-fg} {cyan-fg}█████     █████{/cyan-fg} {white-fg}█████   █████ █████{/white-fg}    {blue-fg}█████{/blue-fg}    {magenta-fg}██████████{/magenta-fg}{/center}',
      '{center}   {red-fg}░░░░░{/red-fg}    {yellow-fg}░░░░░░░░░░{/yellow-fg} {green-fg}░░░░░   ░░░░░{/green-fg} {cyan-fg}░░░░░     ░░░░░{/cyan-fg} {white-fg}░░░░░   ░░░░░ ░░░░░{/white-fg}    {blue-fg}░░░░░{/blue-fg}    {magenta-fg}░░░░░░░░░░{/magenta-fg} {/center}'
    ];
    
    return lines.join('\n');
  }
}

module.exports = GradientChatUI;