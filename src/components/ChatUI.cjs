const blessed = require('blessed');

class ChatUI {
  constructor() {
    // Create a screen object.
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'TERMAITE'
    });

    // Create the chat box.
    this.chatBox = blessed.box({
      top: 0,
      left: 0,
      width: '100%',
      height: '90%-1', // Adjust height to accommodate the progress bar
      content: 'Welcome to TERMAITE!',
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: '#f0f0f0'
        }
      },
      // Enable scrolling
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: ' ',
        inverse: true
      }
    });

    // Create a progress bar for animations
    this.progressBar = blessed.box({
      top: '90%-1',
      left: 0,
      width: '100%',
      height: 1,
      content: ' ',
      tags: true,
      style: {
        fg: 'white',
        bg: 'black'
      }
    });

    // Create the input box.
    this.inputBox = blessed.textbox({
      bottom: 0,
      left: 0,
      width: '100%',
      height: '10%',
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: '#f0f0f0'
        }
      }
    });

    // Append our boxes to the screen.
    this.screen.append(this.chatBox);
    this.screen.append(this.progressBar);
    this.screen.append(this.inputBox);

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
   * Add a message to the chat box
   * @param {string} message - The message to add
   * @param {string} sender - The sender of the message ('user', 'system', 'agent')
   */
  addMessage(message, sender) {
    let formattedMessage = '';
    switch (sender) {
      case 'user':
        formattedMessage = `{bold}You:{/bold} ${message}
`;
        break;
      case 'agent':
        formattedMessage = `{bold}Agent:{/bold} ${message}
`;
        break;
      case 'system':
      default:
        formattedMessage = `{italic}System:{/italic} ${message}
`;
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
}

module.exports = ChatUI;

module.exports = ChatUI;