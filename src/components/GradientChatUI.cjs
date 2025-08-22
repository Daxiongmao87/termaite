const blessed = require('blessed');

class GradientChatUI {
  constructor() {
    // Create a screen object.
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'TERMAITE'
    });

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
    this.chatBox = blessed.box({
      parent: this.mainContainer,
      top: 0,
      left: 0,
      width: '100%-2',
      height: '100%-5', // Leave space for progress bar and input
      content: '',
      tags: true,
      style: {
        fg: 'white',
        bg: 'black'
      },
      // Enable scrolling
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: ' ',
        inverse: true
      }
    });

    // Create a progress bar for animations inside the main container
    this.progressBar = blessed.box({
      parent: this.mainContainer,
      bottom: 4,
      left: 0,
      width: '100%-2', // Account for parent borders
      height: 1,
      content: ' ',
      tags: true,
      style: {
        fg: 'white',
        bg: 'black'
      }
    });

    // Create the input box inside the main container
    this.inputBox = blessed.textbox({
      parent: this.mainContainer,
      bottom: 0,
      left: 0,
      width: '100%-2', // Account for parent borders
      height: 3,
      tags: true,
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

    // Append main container to the screen
    this.screen.append(this.mainContainer);

    // Focus our input box.
    this.inputBox.focus();

    // Handle Ctrl+C to exit.
    this.screen.key(['escape', 'q', 'C-c'], () => {
      return process.exit(0);
    });

    // Render the screen.
    this.screen.render();
  }

  /**
   * Get the title text with gradient colors
   * @returns {string} The formatted title text
   */
  getGradientTitleText() {
    // Apply colors: TERM = red, AI = white, TE = blue
    const term = '{red-fg}term{/red-fg}';
    const ai = '{white-fg}ai{/white-fg}';
    const te = '{blue-fg}te{/blue-fg}';
    
    return ` [ ${term}${ai}${te} ] `;
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
        formattedMessage = `{bold}You:{/bold} ${message}\n`;
        break;
      case 'agent':
        formattedMessage = `{bold}Agent:{/bold} ${message}\n`;
        break;
      case 'system':
      default:
        formattedMessage = `{italic}System:{/italic} ${message}\n`;
        break;
    }
    
    this.chatBox.content += formattedMessage;
    this.chatBox.setScrollPerc(100); // Scroll to bottom
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
   * Set the progress bar content
   * @param {string} content - The content to display in the progress bar
   */
  setProgressBar(content) {
    this.progressBar.content = content;
    this.screen.render();
  }

  /**
   * Clear the progress bar
   */
  clearProgressBar() {
    this.progressBar.content = ' ';
    this.screen.render();
  }

  /**
   * Display the welcome message with ASCII art
   */
  displayWelcomeMessage() {
    const asciiArt = this.generateAsciiArt();
    const welcomeText = '{center}{bold}Welcome to{/bold}{/center}\n\n';
    this.chatBox.content = welcomeText + asciiArt + '\n\n';
    this.screen.render();
  }

  /**
   * Generate ASCII art for TERMAITE with gradient colors
   * @returns {string} The formatted ASCII art
   */
  generateAsciiArt() {
    // Large ASCII art for TERMAITE with colors: TERM = red, AI = white, TE = blue
    const lines = [
      '{center}{red-fg}███████████ ██████████ ███████████   ██████   ██████{/red-fg}   {white-fg}█████████   █████{/white-fg} {blue-fg}███████████ ██████████{/blue-fg}{/center}',
      '{center}{red-fg}░█░░░███░░░█░░███░░░░░█░░███░░░░░███ ░░██████ ██████{/red-fg}   {white-fg}███░░░░░███ ░░███{/white-fg} {blue-fg}░█░░░███░░░█░░███░░░░░█{/blue-fg}{/center}',
      '{center}{red-fg}░   ░███  ░  ░███  █ ░  ░███    ░███  ░███░█████░███{/red-fg}  {white-fg}░███    ░███  ░███{/white-fg} {blue-fg}░   ░███  ░  ░███  █ ░{/blue-fg} {/center}',
      '{center}    {red-fg}░███     ░██████    ░██████████   ░███░░███ ░███{/red-fg}  {white-fg}░███████████  ░███{/white-fg}     {blue-fg}░███     ░██████{/blue-fg}   {/center}',
      '{center}    {red-fg}░███     ░███░░█    ░███░░░░░███  ░███ ░░░  ░███{/red-fg}  {white-fg}░███░░░░░███  ░███{/white-fg}     {blue-fg}░███     ░███░░█{/blue-fg}   {/center}',
      '{center}    {red-fg}░███     ░███ ░   █ ░███    ░███  ░███      ░███{/red-fg}  {white-fg}░███    ░███  ░███{/white-fg}     {blue-fg}░███     ░███ ░   █{/blue-fg}{/center}',
      '{center}    {red-fg}█████    ██████████ █████   █████ █████     █████{/red-fg} {white-fg}█████   █████ █████{/white-fg}    {blue-fg}█████    ██████████{/blue-fg}{/center}',
      '{center}   {red-fg}░░░░░    ░░░░░░░░░░ ░░░░░   ░░░░░ ░░░░░     ░░░░░{/red-fg} {white-fg}░░░░░   ░░░░░ ░░░░░{/white-fg}    {blue-fg}░░░░░    ░░░░░░░░░░{/blue-fg} {/center}'
    ];
    
    return lines.join('\n');
  }
}

module.exports = GradientChatUI;