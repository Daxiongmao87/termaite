const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const ConfigManager = require('../managers/ConfigManager.cjs');
const HistoryManager = require('../managers/HistoryManager.cjs');
const AgentManager = require('../managers/AgentManager.cjs');
const AgentWrapper = require('../services/AgentWrapper.cjs');
const HistoryCompactor = require('../managers/HistoryCompactor.cjs');

class WebServer {
  constructor() {
    this.server = null;
    this.clients = new Map();
    this.currentWorkingPath = process.cwd();
    this.configManager = null;
    this.historyManager = null;
    this.agentManager = null;
    this.historyCompactor = null;
    this.agentIsRunning = false;
    
    // Initialize managers
    this.initializeManagers();
  }
  
  /**
   * Initialize TERMAITE managers for the current working path
   */
  initializeManagers() {
    this.configManager = new ConfigManager();
    this.historyManager = new HistoryManager(this.currentWorkingPath);
    this.agentManager = new AgentManager(this.configManager);
    this.historyCompactor = new HistoryCompactor(this.configManager, this.historyManager);
  }
  
  /**
   * Update the current working path and reinitialize managers
   */
  updateWorkingPath(newPath) {
    if (fs.existsSync(newPath) && fs.statSync(newPath).isDirectory()) {
      this.currentWorkingPath = newPath;
      this.initializeManagers();
      return true;
    }
    return false;
  }
  
  /**
   * Start the web server
   */
  start(host, port) {
    this.server = http.createServer((req, res) => {
      this.handleHttpRequest(req, res);
    });
    
    // Handle WebSocket upgrade
    this.server.on('upgrade', (request, socket, head) => {
      this.handleWebSocketUpgrade(request, socket, head);
    });
    
    this.server.listen(port, host, () => {
      console.log(`🌐 TERMAITE Web Interface running at http://${host}:${port}/`);
      console.log(`🔧 Current working directory: ${this.currentWorkingPath}`);
      console.log('Press Ctrl+C to stop the server');
    });
    
    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n📡 Shutting down web server...');
      this.server.close(() => {
        console.log('🔒 Server closed');
        process.exit(0);
      });
    });
  }
  
  /**
   * Handle HTTP requests
   */
  handleHttpRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    // Route handling
    if (url.pathname === '/') {
      this.serveStaticFile(res, 'index.html', 'text/html');
    } else if (url.pathname === '/style.css') {
      this.serveStaticFile(res, 'style.css', 'text/css');
    } else if (url.pathname === '/app.js') {
      this.serveStaticFile(res, 'app.js', 'text/javascript');
    } else if (url.pathname === '/api/path' && req.method === 'POST') {
      this.handlePathUpdate(req, res);
    } else if (url.pathname === '/api/autocomplete' && req.method === 'POST') {
      this.handleAutocomplete(req, res);
    } else if (url.pathname === '/api/status') {
      this.handleStatusRequest(res);
    } else if (url.pathname === '/api/history') {
      this.handleHistoryRequest(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  }
  
  /**
   * Serve static files
   */
  serveStaticFile(res, filename, contentType) {
    const filePath = path.join(__dirname, '..', 'web', filename);
    
    try {
      const content = this.generateFileContent(filename);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`Error loading ${filename}`);
    }
  }
  
  /**
   * Generate content for web files (since they don't exist as separate files)
   */
  generateFileContent(filename) {
    switch (filename) {
      case 'index.html':
        return this.getIndexHtml();
      case 'style.css':
        return this.getStyleCss();
      case 'app.js':
        return this.getAppJs();
      default:
        throw new Error(`Unknown file: ${filename}`);
    }
  }
  
  /**
   * Handle path update requests
   */
  async handlePathUpdate(req, res) {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const { path: newPath } = JSON.parse(body);
        
        // Validate and provide detailed feedback
        if (!newPath || newPath.trim() === '') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: false, 
            currentPath: this.currentWorkingPath,
            message: 'Path cannot be empty'
          }));
          return;
        }
        
        const trimmedPath = newPath.trim();
        let resolvedPath;
        
        try {
          // Handle tilde expansion
          if (trimmedPath.startsWith('~')) {
            resolvedPath = trimmedPath.replace('~', require('os').homedir());
          } else if (path.isAbsolute(trimmedPath)) {
            resolvedPath = trimmedPath;
          } else {
            resolvedPath = path.resolve(this.currentWorkingPath, trimmedPath);
          }
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: false, 
            currentPath: this.currentWorkingPath,
            message: 'Invalid path format'
          }));
          return;
        }
        
        // Check if path exists
        if (!fs.existsSync(resolvedPath)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: false, 
            currentPath: this.currentWorkingPath,
            message: `Directory does not exist: ${resolvedPath}`
          }));
          return;
        }
        
        // Check if it's a directory
        let isDirectory;
        try {
          isDirectory = fs.statSync(resolvedPath).isDirectory();
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: false, 
            currentPath: this.currentWorkingPath,
            message: `Cannot access path: ${resolvedPath}`
          }));
          return;
        }
        
        if (!isDirectory) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: false, 
            currentPath: this.currentWorkingPath,
            message: `Not a directory: ${resolvedPath}`
          }));
          return;
        }
        
        // Update the path
        const success = this.updateWorkingPath(resolvedPath);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success, 
          currentPath: this.currentWorkingPath,
          message: success ? 'Working directory updated successfully' : 'Failed to update working directory'
        }));
        
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: false, 
          currentPath: this.currentWorkingPath,
          message: 'Invalid request format' 
        }));
      }
    });
  }
  
  /**
   * Handle directory autocomplete requests
   */
  async handleAutocomplete(req, res) {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const { input } = JSON.parse(body);
        const suggestions = this.getDirectorySuggestions(input || '');
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ suggestions }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON', suggestions: [] }));
      }
    });
  }
  
  /**
   * Get directory suggestions based on input
   */
  getDirectorySuggestions(input) {
    try {
      let searchPath, prefix;
      
      // Handle different input formats
      if (input.startsWith('/')) {
        // Absolute path
        const lastSlash = input.lastIndexOf('/');
        searchPath = lastSlash === 0 ? '/' : input.substring(0, lastSlash);
        prefix = input.substring(lastSlash + 1);
      } else if (input.startsWith('~')) {
        // Home directory path
        const expandedPath = input.replace('~', require('os').homedir());
        const lastSlash = expandedPath.lastIndexOf('/');
        searchPath = lastSlash === -1 ? require('os').homedir() : expandedPath.substring(0, lastSlash);
        prefix = expandedPath.substring(lastSlash + 1);
      } else {
        // Relative path
        const lastSlash = input.lastIndexOf('/');
        if (lastSlash === -1) {
          searchPath = this.currentWorkingPath;
          prefix = input;
        } else {
          searchPath = path.resolve(this.currentWorkingPath, input.substring(0, lastSlash));
          prefix = input.substring(lastSlash + 1);
        }
      }
      
      // Check if search path exists
      if (!fs.existsSync(searchPath) || !fs.statSync(searchPath).isDirectory()) {
        return [];
      }
      
      // Read directory contents
      const entries = fs.readdirSync(searchPath, { withFileTypes: true });
      
      // Filter directories that start with the prefix
      const matchingDirs = entries
        .filter(entry => entry.isDirectory() && 
                !entry.name.startsWith('.') && // Skip hidden directories
                entry.name.toLowerCase().startsWith(prefix.toLowerCase()))
        .map(entry => {
          // Build full path suggestion
          let suggestion;
          if (input.startsWith('/')) {
            suggestion = path.join(searchPath, entry.name);
          } else if (input.startsWith('~')) {
            const homedir = require('os').homedir();
            suggestion = path.join(searchPath, entry.name).replace(homedir, '~');
          } else {
            const relativePath = path.relative(this.currentWorkingPath, path.join(searchPath, entry.name));
            suggestion = relativePath || entry.name;
          }
          
          return {
            name: entry.name,
            path: suggestion,
            isComplete: false
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 10); // Limit to 10 suggestions
      
      // If there's exactly one match, mark it as complete
      if (matchingDirs.length === 1) {
        matchingDirs[0].isComplete = true;
        matchingDirs[0].path += '/'; // Add trailing slash for directories
      }
      
      return matchingDirs;
      
    } catch (error) {
      console.error('Directory suggestion error:', error);
      return [];
    }
  }
  
  /**
   * Handle status requests
   */
  handleStatusRequest(res) {
    const agents = this.configManager.getAgents();
    const agentStatus = this.agentManager.getAgentStatus();
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      currentPath: this.currentWorkingPath,
      agentCount: agents.length,
      agentStatus: agentStatus,
      agentIsRunning: this.agentIsRunning
    }));
  }

  /**
   * Handle history requests
   */
  handleHistoryRequest(res) {
    try {
      const userInputs = this.historyManager.readUserInputs();
      const chatHistory = this.historyManager.readHistory();
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        userInputs, 
        chatHistory 
      }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to load history' }));
    }
  }
  
  /**
   * Handle WebSocket upgrade
   */
  handleWebSocketUpgrade(request, socket, head) {
    const key = request.headers['sec-websocket-key'];
    
    // Validate WebSocket request
    if (!key) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }
    
    // Check WebSocket version
    const version = request.headers['sec-websocket-version'];
    if (version !== '13') {
      socket.write('HTTP/1.1 400 Bad Request\r\nSec-WebSocket-Version: 13\r\n\r\n');
      socket.destroy();
      return;
    }
    
    // Check upgrade headers
    const upgrade = request.headers['upgrade'];
    const connection = request.headers['connection'];
    if (!upgrade || upgrade.toLowerCase() !== 'websocket' || 
        !connection || !connection.toLowerCase().includes('upgrade')) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }
    
    const acceptKey = this.generateWebSocketAcceptKey(key);
    
    const responseHeaders = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${acceptKey}`,
      '',
      ''
    ].join('\r\n');
    
    socket.write(responseHeaders);
    
    // Generate unique client ID
    const clientId = crypto.randomUUID();
    this.clients.set(clientId, { socket, id: clientId });
    
    console.log(`WebSocket client connected: ${clientId}`);
    
    // Handle incoming messages
    socket.on('data', (buffer) => {
      try {
        this.handleWebSocketMessage(clientId, buffer);
      } catch (error) {
        console.error(`WebSocket message handling error for client ${clientId}:`, error);
      }
    });
    
    // Handle client disconnect
    socket.on('close', () => {
      console.log(`WebSocket client disconnected: ${clientId}`);
      this.clients.delete(clientId);
    });
    
    socket.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
      this.clients.delete(clientId);
    });
    
    // Send welcome message after a brief delay to ensure connection is established
    setTimeout(() => {
      if (this.clients.has(clientId)) {
        this.sendWebSocketMessage(clientId, {
          type: 'system',
          message: 'Connected to TERMAITE Web Interface'
        });
      }
    }, 100);
  }
  
  /**
   * Generate WebSocket accept key
   */
  generateWebSocketAcceptKey(key) {
    const WEBSOCKET_MAGIC_STRING = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
    return crypto
      .createHash('sha1')
      .update(key + WEBSOCKET_MAGIC_STRING)
      .digest('base64');
  }
  
  /**
   * Handle WebSocket messages
   */
  handleWebSocketMessage(clientId, buffer) {
    try {
      const message = this.parseWebSocketFrame(buffer);
      if (!message) return;
      
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'chat':
          this.handleChatMessage(clientId, data.message);
          break;
        case 'slash':
          this.handleSlashCommand(clientId, data.command);
          break;
        case 'cancel':
          this.handleCancelRequest(clientId);
          break;
        default:
          this.sendWebSocketMessage(clientId, {
            type: 'error',
            message: `Unknown message type: ${data.type}`
          });
      }
    } catch (error) {
      this.sendWebSocketMessage(clientId, {
        type: 'error',
        message: 'Invalid message format'
      });
    }
  }
  
  /**
   * Parse WebSocket frame
   */
  parseWebSocketFrame(buffer) {
    if (buffer.length < 2) return null;
    
    const firstByte = buffer[0];
    const secondByte = buffer[1];
    
    const opcode = firstByte & 0x0f;
    const masked = (secondByte & 0x80) === 0x80;
    
    // Only handle text frames
    if (opcode !== 0x01) return null;
    
    let payloadLength = secondByte & 0x7f;
    let offset = 2;
    
    if (payloadLength === 126) {
      payloadLength = buffer.readUInt16BE(offset);
      offset += 2;
    } else if (payloadLength === 127) {
      payloadLength = buffer.readBigUInt64BE(offset);
      offset += 8;
    }
    
    let maskKey;
    if (masked) {
      maskKey = buffer.slice(offset, offset + 4);
      offset += 4;
    }
    
    const payload = buffer.slice(offset, offset + Number(payloadLength));
    
    if (masked) {
      for (let i = 0; i < payload.length; i++) {
        payload[i] ^= maskKey[i % 4];
      }
    }
    
    return payload.toString('utf8');
  }
  
  /**
   * Send WebSocket message
   */
  sendWebSocketMessage(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    const message = JSON.stringify(data);
    const messageBuffer = Buffer.from(message, 'utf8');
    const frameBuffer = this.createWebSocketFrame(messageBuffer);
    
    try {
      client.socket.write(frameBuffer);
    } catch (error) {
      this.clients.delete(clientId);
    }
  }
  
  /**
   * Create WebSocket frame
   */
  createWebSocketFrame(payload) {
    const payloadLength = payload.length;
    let frame;
    
    if (payloadLength < 126) {
      frame = Buffer.allocUnsafe(2);
      frame[0] = 0x81; // Text frame
      frame[1] = payloadLength;
    } else if (payloadLength < 65536) {
      frame = Buffer.allocUnsafe(4);
      frame[0] = 0x81;
      frame[1] = 126;
      frame.writeUInt16BE(payloadLength, 2);
    } else {
      frame = Buffer.allocUnsafe(10);
      frame[0] = 0x81;
      frame[1] = 127;
      frame.writeBigUInt64BE(BigInt(payloadLength), 2);
    }
    
    return Buffer.concat([frame, payload]);
  }
  
  /**
   * Broadcast message to all clients
   */
  broadcast(data) {
    for (const [clientId, client] of this.clients) {
      this.sendWebSocketMessage(clientId, data);
    }
  }
  
  /**
   * Handle cancellation requests
   */
  handleCancelRequest(clientId) {
    if (this.agentIsRunning) {
      // Cancel the current agent command
      if (AgentWrapper.cancelCurrentCommand()) {
        this.agentIsRunning = false;
        this.sendWebSocketMessage(clientId, {
          type: 'system',
          message: 'Agent cancelled by user'
        });
      }
    }
  }

  /**
   * Handle chat messages (same logic as TUI)
   */
  async handleChatMessage(clientId, text) {
    if (this.agentIsRunning) {
      this.sendWebSocketMessage(clientId, {
        type: 'error',
        message: 'Agent is currently running. Please wait...'
      });
      return;
    }
    
    // Add user message to history and user inputs (for arrow navigation)
    this.historyManager.writeUserInput(text);
    
    // Get the next agent
    const agent = this.agentManager.getNextAgent();
    if (!agent) {
      this.sendWebSocketMessage(clientId, {
        type: 'error',
        message: 'No agents configured. Please check your settings.'
      });
      return;
    }
    
    // Send agent announcement
    this.sendWebSocketMessage(clientId, {
      type: 'agent_start',
      agent: agent.name,
      message: `Agent (${agent.name}):`
    });
    
    this.agentIsRunning = true;
    
    try {
      // Execute agent command
      const history = this.historyManager.readHistory();
      const globalTimeout = this.configManager.getGlobalTimeout();
      this.configManager.propagateInstructions();
      
      const result = await AgentWrapper.executeAgentCommand(agent, text, history, globalTimeout);
      
      if (result.exitCode === 0) {
        // Send agent response
        this.sendWebSocketMessage(clientId, {
          type: 'agent',
          message: result.stdout
        });
        
        // Add agent response to history
        this.historyManager.writeHistory({
          sender: 'agent',
          text: result.stdout,
          timestamp: new Date().toISOString()
        });
      } else {
        this.sendWebSocketMessage(clientId, {
          type: 'error',
          message: `Agent ${agent.name} failed with exit code ${result.exitCode}`
        });
        
        this.agentManager.markAgentAsFailed(agent.name);
        
        // Try next agent
        const nextAgent = this.agentManager.getNextAgent();
        if (nextAgent && nextAgent.name !== agent.name) {
          const retryResult = await AgentWrapper.executeAgentCommand(nextAgent, text, history, globalTimeout);
          if (retryResult.exitCode === 0) {
            this.sendWebSocketMessage(clientId, {
              type: 'agent',
              message: retryResult.stdout
            });
            
            this.historyManager.writeHistory({
              sender: 'agent',
              text: retryResult.stdout,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    } catch (error) {
      this.sendWebSocketMessage(clientId, {
        type: 'error',
        message: `Error executing agent: ${error.message}`
      });
    } finally {
      this.agentIsRunning = false;
    }
  }
  
  /**
   * Handle slash commands (adapted from TUI version)
   */
  async handleSlashCommand(clientId, command) {
    // Save slash command to user inputs for arrow navigation  
    this.historyManager.appendToUserInputsFile(command);
    
    // Save slash command to main chat history to match TUI behavior
    this.historyManager.writeHistory({
      sender: 'user',
      text: command,
      timestamp: new Date().toISOString()
    });
    
    const cmd = command.substring(1).split(' ')[0];
    const args = command.substring(1).split(' ').slice(1);
    
    switch (cmd) {
      case 'clear':
        this.historyManager.clearHistory();
        this.historyManager.clearUserInputs();
        this.sendWebSocketMessage(clientId, {
          type: 'clear',
          message: 'History cleared'
        });
        break;
        
      case 'help':
        // Send multiple separate messages to match TUI format
        this.sendWebSocketMessage(clientId, {
          type: 'system',
          message: 'Available commands:'
        });
        this.sendWebSocketMessage(clientId, {
          type: 'system',
          message: '/clear - Clear the chat history'
        });
        this.sendWebSocketMessage(clientId, {
          type: 'system',
          message: '/help - Show this help message'
        });
        this.sendWebSocketMessage(clientId, {
          type: 'system',
          message: '/compact - Compact the chat history'
        });
        this.sendWebSocketMessage(clientId, {
          type: 'system',
          message: '/select <agent> - Select agent for next prompt (or permanently in manual mode)'
        });
        this.sendWebSocketMessage(clientId, {
          type: 'system',
          message: '/strategy [mode] - Show or set rotation strategy (round-robin, exhaustion, random, manual)'
        });
        this.sendWebSocketMessage(clientId, {
          type: 'system',
          message: '/agents - Show agent status and current configuration'
        });
        this.sendWebSocketMessage(clientId, {
          type: 'system',
          message: '/init - Initialize the project'
        });
        this.sendWebSocketMessage(clientId, {
          type: 'system',
          message: '/config - Open the configuration file'
        });
        this.sendWebSocketMessage(clientId, {
          type: 'system',
          message: '/instructions - Edit global agent instructions'
        });
        this.sendWebSocketMessage(clientId, {
          type: 'system',
          message: '/sh <command> - Execute shell command'
        });
        break;
        
      case 'agents':
        const status = this.agentManager.getAgentStatus();
        
        // Show selected agent info first, matching TUI format
        if (status.selectedAgent) {
          const selectedColor = this.getAgentColor ? this.getAgentColor(status.selectedAgent) : '#ffffff';
          this.sendWebSocketMessage(clientId, {
            type: 'system',
            message: `Selected agent: {bold}{${selectedColor}-fg}${status.selectedAgent}{/${selectedColor}-fg}{/bold}`
          });
        }
        
        if (status.temporaryAgent) {
          const tempColor = this.getAgentColor ? this.getAgentColor(status.temporaryAgent) : '#ffffff';
          this.sendWebSocketMessage(clientId, {
            type: 'system',
            message: `Next prompt will use: {bold}{${tempColor}-fg}${status.temporaryAgent}{/${tempColor}-fg}{/bold}`
          });
        }
        
        // Agent status header
        this.sendWebSocketMessage(clientId, {
          type: 'system',
          message: 'Agent status:'
        });
        
        // Individual agent details with colors and context windows
        const agents = this.configManager.getAgents();
        status.agents.forEach(agentStatus => {
          const agent = agents.find(a => a.name === agentStatus.name);
          const color = this.getAgentColor ? this.getAgentColor(agentStatus.name) : '#ffffff';
          const statusText = agentStatus.available ? 'available' : 'cooldown';
          const contextWindow = agent ? agent.contextWindowTokens.toLocaleString() : 'unknown';
          
          // Agent name with color
          this.sendWebSocketMessage(clientId, {
            type: 'system',
            message: `- {bold}{${color}-fg}${agentStatus.name}{/${color}-fg}{/bold}`
          });
          // Status with indentation
          this.sendWebSocketMessage(clientId, {
            type: 'system',
            message: `    status:         ${statusText}`
          });
          // Context window with indentation
          this.sendWebSocketMessage(clientId, {
            type: 'system',
            message: `    context window: ${contextWindow}`
          });
        });
        break;
        
      case 'config':
        this.sendWebSocketMessage(clientId, {
          type: 'system',
          message: `Current working directory: ${this.currentWorkingPath}\nConfig file: ${this.configManager.configPath}`
        });
        break;
        
      case 'sh':
        if (args.length === 0) {
          this.sendWebSocketMessage(clientId, {
            type: 'error',
            message: 'Usage: /sh <command>'
          });
          break;
        }
        
        const shellCommand = args.join(' ');
        
        // Send command being executed with gray formatting like TUI
        this.sendWebSocketMessage(clientId, {
          type: 'system',
          message: `{gray-fg}$ ${shellCommand}{/gray-fg}`
        });
        
        // Execute shell command
        try {
          const { spawn } = require('child_process');
          const process = spawn(shellCommand, { shell: true, cwd: this.currentWorkingPath });
          
          let stdout = '';
          let stderr = '';
          
          process.stdout.on('data', (data) => {
            stdout += data.toString();
          });
          
          process.stderr.on('data', (data) => {
            stderr += data.toString();
          });
          
          process.on('close', (exitCode) => {
            // Display output
            if (stdout.trim()) {
              // Limit output size to prevent UI issues
              const maxOutputSize = 10000;
              const displayOutput = stdout.length > maxOutputSize 
                ? stdout.substring(0, maxOutputSize) + '\n... (output truncated)'
                : stdout.trim();
              this.sendWebSocketMessage(clientId, {
                type: 'shell',
                message: displayOutput
              });
            }
            
            if (stderr.trim()) {
              const maxOutputSize = 10000;
              const displayError = stderr.length > maxOutputSize 
                ? stderr.substring(0, maxOutputSize) + '\n... (error output truncated)'
                : stderr.trim();
              this.sendWebSocketMessage(clientId, {
                type: 'system',
                message: `{red-fg}${displayError}{/red-fg}`
              });
            }
            
            // Show exit code if non-zero, with red formatting like TUI
            if (exitCode !== 0) {
              this.sendWebSocketMessage(clientId, {
                type: 'system',
                message: `{red-fg}(Exit code: ${exitCode}){/red-fg}`
              });
            }
            
            // Add to history
            const commandOutput = `$ ${shellCommand}\n${stdout}${stderr ? stderr : ''}${exitCode !== 0 ? `(Exit code: ${exitCode})` : ''}`;
            this.historyManager.writeHistory({
              sender: 'shell',
              text: commandOutput,
              timestamp: new Date().toISOString()
            });
          });
          
          process.on('error', (error) => {
            this.sendWebSocketMessage(clientId, {
              type: 'error',
              message: `Command error: ${error.message}`
            });
            
            // Add error to history
            this.historyManager.writeHistory({
              sender: 'shell',
              text: `$ ${shellCommand}\nError: ${error.message}`,
              timestamp: new Date().toISOString()
            });
          });
          
          // Set timeout (30 seconds)
          setTimeout(() => {
            if (!process.killed) {
              process.kill('SIGTERM');
              this.sendWebSocketMessage(clientId, {
                type: 'error',
                message: 'Command timed out after 30 seconds'
              });
            }
          }, 30000);
          
        } catch (error) {
          this.sendWebSocketMessage(clientId, {
            type: 'error',
            message: `Failed to execute command: ${error.message}`
          });
        }
        break;
      
      case 'compact':
        this.sendWebSocketMessage(clientId, {
          type: 'system',
          message: 'Compacting history...'
        });
        
        // Get the next agent for summarization
        const agent = this.agentManager.getNextAgent();
        if (agent) {
          try {
            await this.historyCompactor.manualCompactHistory(agent);
            this.sendWebSocketMessage(clientId, {
              type: 'system',
              message: 'History compacted successfully'
            });
          } catch (error) {
            this.sendWebSocketMessage(clientId, {
              type: 'system',
              message: `Error compacting history: ${error.message}`
            });
          }
        } else {
          this.sendWebSocketMessage(clientId, {
            type: 'system',
            message: 'No agents configured. Please add agents to ~/.termaite/settings.json'
          });
        }
        break;
        
      case 'select':
        if (args.length > 0) {
          const agentName = args[0];
          const agent = this.configManager.getAgents().find(a => a.name === agentName);
          if (agent) {
            // Determine if this is temporary based on strategy
            const isTemporary = this.agentManager.getStrategy() !== 'manual';
            
            if (this.agentManager.selectAgent(agentName, isTemporary)) {
              if (isTemporary) {
                this.sendWebSocketMessage(clientId, {
                  type: 'system',
                  message: `Selected ${agentName} for next prompt only`
                });
              } else {
                this.sendWebSocketMessage(clientId, {
                  type: 'system',
                  message: `Selected ${agentName} (manual mode)`
                });
              }
            } else {
              this.sendWebSocketMessage(clientId, {
                type: 'system',
                message: `Agent not found: ${agentName}`
              });
            }
          } else {
            this.sendWebSocketMessage(clientId, {
              type: 'system',
              message: `Agent not found: ${agentName}`
            });
          }
        } else {
          // Fall through to agents case when no argument provided
          const status = this.agentManager.getAgentStatus();
          
          if (status.selectedAgent) {
            const selectedColor = this.getAgentColor ? this.getAgentColor(status.selectedAgent) : '#ffffff';
            this.sendWebSocketMessage(clientId, {
              type: 'system',
              message: `Selected agent: {bold}{${selectedColor}-fg}${status.selectedAgent}{/${selectedColor}-fg}{/bold}`
            });
          }
          
          if (status.temporaryAgent) {
            const tempColor = this.getAgentColor ? this.getAgentColor(status.temporaryAgent) : '#ffffff';
            this.sendWebSocketMessage(clientId, {
              type: 'system',
              message: `Next prompt will use: {bold}{${tempColor}-fg}${status.temporaryAgent}{/${tempColor}-fg}{/bold}`
            });
          }
          
          // CRITICAL: Always display agent status like TUI does
          this.sendWebSocketMessage(clientId, {
            type: 'system',
            message: 'Agent status:'
          });
          
          const agents = this.configManager.getAgents();
          status.agents.forEach(agentStatus => {
            const agent = agents.find(a => a.name === agentStatus.name);
            const color = this.getAgentColor ? this.getAgentColor(agentStatus.name) : '#ffffff';
            const statusText = agentStatus.available ? 'available' : 'cooldown';
            const contextWindow = agent ? agent.contextWindowTokens.toLocaleString() : 'unknown';
            
            this.sendWebSocketMessage(clientId, {
              type: 'system',
              message: `- {bold}{${color}-fg}${agentStatus.name}{/${color}-fg}{/bold}`
            });
            this.sendWebSocketMessage(clientId, {
              type: 'system',
              message: `    status:         ${statusText}`
            });
            this.sendWebSocketMessage(clientId, {
              type: 'system',
              message: `    context window: ${contextWindow}`
            });
          });
        }
        break;
        
      case 'strategy':
        if (args.length > 0) {
          const strategy = args[0];
          if (this.agentManager.setStrategy(strategy)) {
            this.sendWebSocketMessage(clientId, {
              type: 'system',
              message: `Rotation strategy set to: ${strategy}`
            });
          } else {
            this.sendWebSocketMessage(clientId, {
              type: 'system',
              message: `Invalid strategy: ${strategy}`
            });
            this.sendWebSocketMessage(clientId, {
              type: 'system',
              message: 'Available strategies: round-robin, exhaustion, random, manual'
            });
          }
        } else {
          const currentStrategy = this.agentManager.getStrategy();
          this.sendWebSocketMessage(clientId, {
            type: 'system',
            message: `Current strategy: ${currentStrategy}`
          });
          this.sendWebSocketMessage(clientId, {
            type: 'system',
            message: 'Available strategies:'
          });
          this.sendWebSocketMessage(clientId, {
            type: 'system',
            message: '  round-robin - Rotate through agents in order'
          });
          this.sendWebSocketMessage(clientId, {
            type: 'system',
            message: '  exhaustion - Always try agents in priority order (list order)'
          });
          this.sendWebSocketMessage(clientId, {
            type: 'system',
            message: '  random - Pick agents randomly'
          });
          this.sendWebSocketMessage(clientId, {
            type: 'system',
            message: '  manual - Use selected agent only, no rotation'
          });
        }
        break;
        
      case 'init':
        this.sendWebSocketMessage(clientId, {
          type: 'system',
          message: 'Initializing project...'
        });
        
        // Get the next agent for initialization
        const initAgent = this.agentManager.getNextAgent();
        if (initAgent) {
          this.sendWebSocketMessage(clientId, {
            type: 'system',
            message: 'Web interface does not support /init command. Please use the TUI for project initialization.'
          });
        } else {
          this.sendWebSocketMessage(clientId, {
            type: 'system',
            message: 'No agents configured. Please add agents to ~/.termaite/settings.json'
          });
        }
        break;
        
      case 'instructions':
        this.sendWebSocketMessage(clientId, {
          type: 'system',
          message: 'Web interface does not support editing instructions file. Please use the TUI or edit ~/.termaite/TERMAITE.md directly.'
        });
        break;
        
      default:
        this.sendWebSocketMessage(clientId, {
          type: 'error',
          message: `Unknown command: ${cmd}. Type /help for available commands.`
        });
    }
  }
  
  /**
   * Get index HTML content
   */
  getIndexHtml() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TERMAITE - Web Interface</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="app-container">
        <header class="app-header">
            <div class="title">
                <span class="char-t1">t</span><span class="char-e1">e</span><span class="char-r">r</span><span class="char-m">m</span><span class="char-ai">ai</span><span class="char-t2">t</span><span class="char-e2">e</span>
            </div>
            <div class="path-selector">
                <label for="workingPath" class="path-label">Working Directory:</label>
                <div class="autocomplete-container">
                    <input type="text" id="workingPath" class="path-input" placeholder="Enter path..." aria-label="Working directory path" autocomplete="off">
                    <div class="autocomplete-dropdown" id="autocompleteDropdown" role="listbox" aria-label="Directory suggestions"></div>
                </div>
                <button id="setPath" class="path-button" aria-label="Set working directory">Set</button>
                <div class="path-status" id="pathStatus" aria-live="polite"></div>
            </div>
        </header>
        
        <main class="chat-container">
            <div class="chat-messages" id="chatMessages" role="log" aria-label="Chat messages" aria-live="polite"></div>
            
            <form class="input-form" id="inputForm" aria-label="Message input form">
                <div class="input-group">
                    <span class="prompt-char" aria-hidden="true">&gt;</span>
                    <input 
                        type="text" 
                        id="messageInput" 
                        class="message-input" 
                        placeholder="Type your message or slash command..." 
                        aria-label="Message input"
                        autocomplete="off"
                        required
                    >
                    <button type="submit" class="submit-button" aria-label="Send message">Send</button>
                </div>
            </form>
        </main>
        
        <div class="status-bar">
            <div class="connection-status" id="connectionStatus" aria-live="polite">Connecting...</div>
            <div class="agent-status" id="agentStatus" aria-live="polite"></div>
        </div>
    </div>
    
    <script src="app.js"></script>
</body>
</html>`;
  }
  
  /**
   * Get CSS styles
   */
  getStyleCss() {
    return `* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    background: linear-gradient(135deg, #0c0c0c 0%, #1a1a1a 100%);
    color: #ffffff;
    height: 100vh;
    overflow: hidden;
}

.app-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
}

/* Header */
.app-header {
    background: rgba(0, 0, 0, 0.5);
    border-bottom: 2px solid #00ffff;
    padding: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
}

.title {
    font-size: 1.5rem;
    font-weight: bold;
    user-select: none;
}

/* Gradient title colors matching TUI */
.char-t1 { color: #ff0000; }
.char-e1 { color: #ffff00; }
.char-r { color: #00ff00; }
.char-m { color: #00ffff; }
.char-ai { color: #ffffff; }
.char-t2 { color: #0000ff; }
.char-e2 { color: #ff00ff; }

.path-selector {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.path-label {
    color: #cccccc;
    font-size: 0.9rem;
}

.autocomplete-container {
    position: relative;
    display: inline-block;
}

.path-input {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid #555555;
    color: #ffffff;
    padding: 0.5rem;
    border-radius: 4px;
    min-width: 200px;
    transition: border-color 0.3s ease;
    width: 100%;
}

.path-input:focus {
    outline: none;
    border-color: #00ffff;
    box-shadow: 0 0 0 2px rgba(0, 255, 255, 0.2);
}

.autocomplete-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: rgba(0, 0, 0, 0.95);
    border: 1px solid #555555;
    border-top: none;
    border-radius: 0 0 4px 4px;
    max-height: 200px;
    overflow-y: auto;
    z-index: 1000;
    display: none;
}

.autocomplete-dropdown.show {
    display: block;
}

.autocomplete-item {
    padding: 0.5rem;
    cursor: pointer;
    color: #ffffff;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    transition: background-color 0.2s ease;
}

.autocomplete-item:hover,
.autocomplete-item.highlighted {
    background: rgba(0, 255, 255, 0.2);
}

.autocomplete-item:last-child {
    border-bottom: none;
}

.autocomplete-item .item-name {
    font-weight: bold;
    color: #00ffff;
}

.autocomplete-item .item-path {
    font-size: 0.8rem;
    color: #cccccc;
    margin-top: 0.2rem;
}

.path-button {
    background: #00ffff;
    color: #000000;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
    transition: background-color 0.3s ease;
}

.path-button:hover {
    background: #00cccc;
}

.path-button:focus {
    outline: 2px solid #ffffff;
    outline-offset: 2px;
}

.path-status {
    font-size: 0.8rem;
    min-height: 1.2rem;
}

.path-status.success {
    color: #00ff00;
}

.path-status.error {
    color: #ff0000;
}

/* Main chat area */
.chat-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
}

.chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    background: rgba(0, 0, 0, 0.3);
    border: 2px solid #333333;
    margin: 1rem;
    border-radius: 8px;
    font-size: 0.9rem;
    line-height: 1.4;
}

.chat-messages::-webkit-scrollbar {
    width: 8px;
}

.chat-messages::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
}

.chat-messages::-webkit-scrollbar-thumb {
    background: #555555;
    border-radius: 4px;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
    background: #777777;
}

.message {
    margin-bottom: 0.5rem;
    padding: 0.25rem 0;
}

.message.user {
    color: #ffffff;
}

.message.agent {
    color: #cccccc;
    white-space: pre-wrap;
}

/* Enhanced styling for agent output formatting */
.message.agent pre {
    background: #1e1e1e;
    border: 1px solid #444;
    border-radius: 4px;
    padding: 8px;
    overflow-x: auto;
    font-family: 'Courier New', monospace;
    font-size: 0.9em;
}

.message.agent code {
    background: #2a2a2a;
    padding: 2px 4px;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
    font-size: 0.9em;
}

.message.agent pre code {
    background: transparent;
    padding: 0;
}

/* Better color visibility against dark background */
.message.agent span[style*="color: yellow"] {
    color: #ffff88 !important;
}

.message.agent span[style*="color: cyan"] {
    color: #88ffff !important;
}

.message.agent span[style*="color: white"] {
    color: #ffffff !important;
}

.message.system {
    color: #cccccc;
    font-style: normal;
}
.message.shell {
    color: #cccccc;
    white-space: pre-wrap;
}

.message.error {
    color: #ff4444;
}

.message.agent-start {
    color: #00ffff;
    font-weight: bold;
}
.message.spinner-message {
    color: #cccccc;
}
.spinner-text {
    color: #888888;
    font-style: italic;
    font-size: 0.8rem;
}

/* Input form */
.input-form {
    padding: 1rem;
    background: rgba(0, 0, 0, 0.5);
    border-top: 1px solid #333333;
}

.input-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    max-width: 1200px;
    margin: 0 auto;
}

.prompt-char {
    color: #00ff00;
    font-weight: bold;
    font-size: 1.1rem;
}

.message-input {
    flex: 1;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid #555555;
    color: #ffffff;
    padding: 0.75rem;
    border-radius: 4px;
    font-family: inherit;
    font-size: 0.9rem;
    transition: border-color 0.3s ease;
}

.message-input:focus {
    outline: none;
    border-color: #00ffff;
    box-shadow: 0 0 0 2px rgba(0, 255, 255, 0.2);
}

.message-input::placeholder {
    color: #888888;
}

.submit-button {
    background: #00ff00;
    color: #000000;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
    font-family: inherit;
    transition: background-color 0.3s ease;
}

.submit-button:hover {
    background: #00cc00;
}

.submit-button:focus {
    outline: 2px solid #ffffff;
    outline-offset: 2px;
}

.submit-button:disabled {
    background: #555555;
    cursor: not-allowed;
    opacity: 0.6;
}

/* Status bar */
.status-bar {
    background: rgba(0, 0, 0, 0.8);
    border-top: 1px solid #333333;
    padding: 0.5rem 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.8rem;
}

.connection-status {
    color: #cccccc;
}

.connection-status.connected {
    color: #00ff00;
}

.connection-status.disconnected {
    color: #ff4444;
}

.agent-status {
    color: #cccccc;
}

/* Responsive design */
@media (max-width: 768px) {
    .app-header {
        flex-direction: column;
        align-items: stretch;
        gap: 0.5rem;
    }
    
    .title {
        text-align: center;
    }
    
    .path-selector {
        justify-content: center;
        flex-wrap: wrap;
    }
    
    .path-input {
        min-width: 150px;
        flex: 1;
    }
    
    .input-group {
        flex-direction: column;
        gap: 0.5rem;
    }
    
    .message-input {
        order: 1;
    }
    
    .prompt-char {
        display: none;
    }
    
    .submit-button {
        order: 2;
        align-self: stretch;
    }
    
    .status-bar {
        flex-direction: column;
        gap: 0.25rem;
        text-align: center;
    }
}

/* Loading animation */
.loading {
    display: inline-block;
    animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.5; }
    100% { opacity: 1; }
}

/* Focus indicators for accessibility */
*:focus {
    outline: 2px solid #00ffff;
    outline-offset: 2px;
}

button:focus,
input:focus {
    outline: 2px solid #00ffff;
    outline-offset: 2px;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
    .app-header {
        border-bottom-width: 3px;
    }
    
    .chat-messages {
        border-width: 3px;
    }
    
    .message-input,
    .path-input {
        border-width: 2px;
    }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
    }
    
    .loading {
        animation: none;
    }
}`;
  }
  
  /**
   * Get JavaScript application code
   */
  getAppJs() {
    return `class TermaiteWebApp {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.messageQueue = [];
        this.currentPath = '';
        this.autocompleteTimeout = null;
        this.selectedSuggestionIndex = -1;
        
        // Spinner animation properties (matching TUI)
        this.spinnerFrames = ['◜ ', ' ◝', ' ◞', '◟ '];
        this.spinnerColors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
            '#FFEAA7', '#DDA0DD', '#BB8FCE', '#85C1E9'
        ];
        this.currentSpinnerFrame = 0;
        this.spinnerInterval = null;
        this.spinnerElement = null;
        this.currentSpinnerColor = this.getRandomSpinnerColor();
        
        // User input history for arrow key navigation
        this.userInputHistory = [];
        this.historyIndex = -1;
        this.originalInput = '';
        this.suggestions = [];
        
        this.initializeElements();
        this.attachEventListeners();
        this.connectWebSocket();
        this.updateCurrentPath();
        
        // Load both user input history and chat history asynchronously
        this.loadHistory().then(() => {
            console.log('History loaded:', this.userInputHistory.length, 'user inputs');
        });
    }
    
    getRandomSpinnerColor() {
        return this.spinnerColors[Math.floor(Math.random() * this.spinnerColors.length)];
    }
    
    formatAgentOutput(text) {
        // Simplified formatting to avoid regex issues
        return this.escapeHtml(text).replace(/\\n/g, '<br>');
    }
    
    formatSystemMessage(text) {
        // Convert blessed.js-style formatting tags to HTML/CSS
        let formatted = this.escapeHtml(text);
        
        // Handle bold tags
        formatted = formatted.replace(/\\{bold\\}(.*?)\\{\\/bold\\}/g, '<strong>$1</strong>');
        
        // Handle color tags with dynamic agent colors
        const colorRegex = /\\{([a-zA-Z0-9#]+)-fg\\}(.*?)\\{\\/([a-zA-Z0-9#]+)-fg\\}/g;
        formatted = formatted.replace(colorRegex, (match, color, content, closeColor) => {
            // Handle hex colors or named colors
            if (color.startsWith('#')) {
                return '<span style="color: ' + color + '">' + content + '</span>';
            } else {
                // Map blessed color names to CSS
                const colorMap = {
                    'red': '#ff4444',
                    'green': '#00ff00', 
                    'blue': '#4444ff',
                    'yellow': '#ffff00',
                    'cyan': '#00ffff',
                    'magenta': '#ff00ff',
                    'white': '#ffffff',
                    'gray': '#808080',
                    'grey': '#808080'
                };
                const cssColor = colorMap[color] || color;
                return '<span style="color: ' + cssColor + '">' + content + '</span>';
            }
        });
        
        // Handle line breaks
        formatted = formatted.replace(/\\n/g, '<br>');
        
        return formatted;
    }
    
    startSpinner() {
        // Clear any existing spinner
        this.stopSpinner();
        
        // Create spinner element
        this.spinnerElement = document.createElement('div');
        this.spinnerElement.className = 'message spinner-message';
        this.spinnerElement.innerHTML = '<span class="spinner-frame"></span> <span class="spinner-text">Esc to cancel</span>';
        
        this.elements.chatMessages.appendChild(this.spinnerElement);
        this.scrollToBottom();
        
        // Start animation
        this.currentSpinnerFrame = 0;
        this.currentSpinnerColor = this.getRandomSpinnerColor();
        this.animateSpinner();
    }
    
    animateSpinner() {
        if (!this.spinnerElement) return;
        
        const frame = this.spinnerFrames[this.currentSpinnerFrame];
        const spinnerFrame = this.spinnerElement.querySelector('.spinner-frame');
        
        if (spinnerFrame) {
            spinnerFrame.textContent = frame;
            spinnerFrame.style.color = this.currentSpinnerColor;
            spinnerFrame.style.fontWeight = 'bold';
        }
        
        // Move to next frame
        this.currentSpinnerFrame = (this.currentSpinnerFrame + 1) % this.spinnerFrames.length;
        
        // Change color after full revolution
        if (this.currentSpinnerFrame === 0) {
            this.currentSpinnerColor = this.getRandomSpinnerColor();
        }
        
        // Schedule next frame at 15fps (67ms)
        this.spinnerInterval = setTimeout(() => this.animateSpinner(), 67);
    }
    
    stopSpinner() {
        if (this.spinnerInterval) {
            clearTimeout(this.spinnerInterval);
            this.spinnerInterval = null;
        }
        
        if (this.spinnerElement) {
            this.spinnerElement.remove();
            this.spinnerElement = null;
        }
    }
    
    handleEscapeKey(e) {
        // If input is focused and has content, clear it
        if (e.target === this.elements.messageInput && this.elements.messageInput.value.trim()) {
            this.elements.messageInput.value = '';
            this.resetHistoryNavigation();
            return;
        }
        
        // If spinner is running, cancel the agent
        if (this.spinnerElement) {
            this.cancelCurrentAgent();
        }
    }
    
    cancelCurrentAgent() {
        // Send cancellation request to server
        if (this.isConnected && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ type: 'cancel' }));
        }
        
        // Stop spinner and re-enable input
        this.stopSpinner();
        this.setInputEnabled(true);
        this.addMessage('Cancelled by user', 'system');
    }
    
    async loadHistory() {
        try {
            const response = await fetch('/api/history', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.userInputHistory = data.userInputs || [];
                
                // Display existing chat history
                const chatHistory = data.chatHistory || [];
                if (chatHistory.length > 0) {
                    console.log('Loading', chatHistory.length, 'chat history entries');
                    chatHistory.forEach(entry => {
                        this.displayHistoryEntry(entry);
                    });
                }
            }
        } catch (error) {
            console.error('Error loading history:', error);
        }
    }
    
    displayHistoryEntry(entry) {
        switch (entry.sender) {
            case 'user':
                this.addMessage(entry.text, 'user');
                break;
            case 'agent':
                this.addMessage(entry.text, 'agent');
                break;
            case 'system':
                this.addMessage(entry.text, 'system');
                break;
            case 'shell':
                this.addMessage(entry.text, 'shell');
                break;
            default:
                this.addMessage(entry.text, 'system');
        }
    }
    
    navigateHistoryUp() {
        if (this.userInputHistory.length === 0) return;
        
        if (this.historyIndex === -1) {
            // Starting navigation, save current input
            this.originalInput = this.elements.messageInput.value;
            this.historyIndex = 0;
        } else if (this.historyIndex < this.userInputHistory.length - 1) {
            // Move to older message
            this.historyIndex++;
        } else {
            // Already at oldest message
            return;
        }
        
        // Load the message from history (reverse order - newest first)
        const messageIndex = this.userInputHistory.length - 1 - this.historyIndex;
        this.elements.messageInput.value = this.userInputHistory[messageIndex];
    }
    
    navigateHistoryDown() {
        if (this.historyIndex === -1) return; // Not navigating
        
        this.historyIndex--;
        
        if (this.historyIndex === -1) {
            // Restore original input
            this.elements.messageInput.value = this.originalInput;
            this.originalInput = '';
        } else {
            // Load the message from history
            const messageIndex = this.userInputHistory.length - 1 - this.historyIndex;
            this.elements.messageInput.value = this.userInputHistory[messageIndex];
        }
    }
    
    resetHistoryNavigation() {
        this.historyIndex = -1;
        this.originalInput = '';
    }
    
    initializeElements() {
        this.elements = {
            chatMessages: document.getElementById('chatMessages'),
            messageInput: document.getElementById('messageInput'),
            inputForm: document.getElementById('inputForm'),
            workingPath: document.getElementById('workingPath'),
            setPathButton: document.getElementById('setPath'),
            pathStatus: document.getElementById('pathStatus'),
            connectionStatus: document.getElementById('connectionStatus'),
            agentStatus: document.getElementById('agentStatus'),
            autocompleteDropdown: document.getElementById('autocompleteDropdown')
        };
        
        // Set submitButton after inputForm is available
        this.elements.submitButton = this.elements.inputForm.querySelector('.submit-button');
    }
    
    attachEventListeners() {
        // Message form submission
        this.elements.inputForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // Check if submit is disabled (agent running)
            if (this.elements.submitButton.disabled) {
                // Visual feedback that submission is blocked
                this.elements.submitButton.style.backgroundColor = '#ff4444';
                setTimeout(() => {
                    this.elements.submitButton.style.backgroundColor = '';
                }, 200);
                return;
            }
            
            this.sendMessage();
        });
        
        // ESC key for cancellation (global listener)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.handleEscapeKey(e);
            }
        });
        
        // Arrow key history navigation (direct input listener)
        this.elements.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigateHistoryUp();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.navigateHistoryDown();
            }
        });
        
        // Path setting
        this.elements.setPathButton.addEventListener('click', () => {
            this.setWorkingPath();
        });
        
        // Path input autocomplete
        this.elements.workingPath.addEventListener('input', (e) => {
            this.handlePathInput(e.target.value);
        });
        
        this.elements.workingPath.addEventListener('keydown', (e) => {
            this.handlePathKeydown(e);
        });
        
        this.elements.workingPath.addEventListener('blur', () => {
            // Hide dropdown after a brief delay to allow click events
            setTimeout(() => this.hideAutocomplete(), 200);
        });
        
        this.elements.workingPath.addEventListener('focus', () => {
            if (this.suggestions.length > 0) {
                this.showAutocomplete();
            }
        });
        
        // Hide autocomplete when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.autocomplete-container')) {
                this.hideAutocomplete();
            }
        });
        
        // Auto-scroll chat on new messages
        const observer = new MutationObserver(() => {
            this.scrollToBottom();
        });
        
        observer.observe(this.elements.chatMessages, {
            childList: true,
            subtree: true
        });
    }
    
    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = \`\${protocol}//\${window.location.host}\`;
        
        try {
            this.socket = new WebSocket(wsUrl);
            
            this.socket.onopen = () => {
                console.log('WebSocket connected');
                this.isConnected = true;
                this.updateConnectionStatus('connected', '🟢 Connected');
                
                // Send any queued messages
                while (this.messageQueue.length > 0) {
                    const message = this.messageQueue.shift();
                    this.socket.send(JSON.stringify(message));
                }
            };
            
            this.socket.onmessage = (event) => {
                this.handleMessage(JSON.parse(event.data));
            };
            
            this.socket.onclose = () => {
                console.log('WebSocket disconnected');
                this.isConnected = false;
                this.updateConnectionStatus('disconnected', '🔴 Disconnected');
                
                // Attempt to reconnect after 3 seconds
                setTimeout(() => {
                    if (!this.isConnected) {
                        console.log('Attempting to reconnect...');
                        this.updateConnectionStatus('disconnected', '🟡 Reconnecting...');
                        this.connectWebSocket();
                    }
                }, 3000);
            };
            
            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateConnectionStatus('disconnected', '🔴 Connection Error');
            };
            
        } catch (error) {
            console.error('Failed to create WebSocket:', error);
            this.updateConnectionStatus('disconnected', '🔴 Connection Failed');
        }
    }
    
    sendMessage() {
        const message = this.elements.messageInput.value.trim();
        if (!message) return;
        
        // Reset history navigation state
        this.resetHistoryNavigation();
        
        // Add user message to chat immediately
        this.addMessage(message, 'user');
        this.elements.messageInput.value = '';
        
        // Determine message type
        const messageType = message.startsWith('/') ? 'slash' : 'chat';
        const payload = messageType === 'slash' 
            ? { type: 'slash', command: message }
            : { type: 'chat', message: message };
        
        // Send via WebSocket or queue if not connected
        if (this.isConnected && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(payload));
        } else {
            this.messageQueue.push(payload);
            this.addMessage('Message queued - not connected to server', 'error');
        }
        
        // Disable input while processing
        this.setInputEnabled(false);
    }
    
    handleMessage(data) {
        switch (data.type) {
            case 'system':
                this.addMessage(data.message, 'system');
                this.setInputEnabled(true);
                break;
                
            case 'agent':
                this.stopSpinner();
                this.addMessage(data.message, 'agent');
                this.setInputEnabled(true);
                break;
                
            case 'agent_start':
                this.addMessage(data.message, 'agent-start');
                this.startSpinner();
                break;
                
            case 'error':
                this.stopSpinner();
                this.addMessage(data.message, 'error');
                this.setInputEnabled(true);
                this.updateAgentStatus('');
                break;
                
            case 'clear':
                this.elements.chatMessages.innerHTML = '';
                this.addMessage(data.message, 'system');
                this.setInputEnabled(true);
                break;
                
            default:
                console.warn('Unknown message type:', data.type);
        }
    }
    
    addMessage(content, type) {
        const messageEl = document.createElement('div');
        messageEl.className = 'message ' + type;
        
        // Handle different message types to match TUI formatting
        switch (type) {
            case 'user':
                // Match TUI: {bold}You:{/bold} message
                messageEl.innerHTML = '<strong>You:</strong> ' + this.escapeHtml(content);
                break;
                
            case 'agent':
                // Match TUI: Format agent output with proper rendering
                messageEl.innerHTML = this.formatAgentOutput(content);
                this.updateAgentStatus('');
                break;
                
            case 'agent-start':
                // Match TUI: Agent announcement with dynamic color
                // Extract agent name from "Agent (name):" format
                const agentMatch = content.match(/Agent \\(([^)]+)\\):/);
                if (agentMatch) {
                    const agentName = agentMatch[1];
                    const agentColor = this.getAgentColor(agentName);
                    messageEl.innerHTML = '<strong style="color: ' + agentColor + '">' + this.escapeHtml(content) + '</strong>';
                } else {
                    messageEl.innerHTML = '<strong>' + this.escapeHtml(content) + '</strong>';
                }
                break;
                
            case 'system':
                // Match TUI: Use formatting for blessed.js-style tags
                // Check if it's a shell command (starts with '$')
                if (content.startsWith('$')) {
                    messageEl.innerHTML = '<span style="color: #00ff00">' + this.escapeHtml(content) + '</span>';
                } else {
                    messageEl.innerHTML = this.formatSystemMessage(content);
                }
                break;
                
            case 'shell':
                // Default gray text for shell output (matching TUI default)
                messageEl.textContent = content;
                break;
                
            case 'error':
                messageEl.textContent = content;
                break;
                
            default:
                messageEl.textContent = content;
        }
        
        this.elements.chatMessages.appendChild(messageEl);
        this.scrollToBottom();
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    scrollToBottom() {
        this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
    }
    
    setInputEnabled(enabled) {
        // Only disable submit button, keep input always enabled for typing
        this.elements.submitButton.disabled = !enabled;
        
        // Focus input when re-enabled (with slight delay to ensure DOM updates complete)
        if (enabled) {
            setTimeout(() => {
                this.elements.messageInput.focus();
            }, 10);
        }
    }
    
    updateConnectionStatus(status, text) {
        this.elements.connectionStatus.className = 'connection-status ' + status;
        this.elements.connectionStatus.textContent = text;
    }
    
    updateAgentStatus(text) {
        this.elements.agentStatus.textContent = text;
    }
    
    async setWorkingPath() {
        const newPath = this.elements.workingPath.value.trim();
        if (!newPath) return;
        
        try {
            const response = await fetch('/api/path', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ path: newPath })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.currentPath = result.currentPath;
                this.elements.pathStatus.textContent = '✅ Path updated';
                this.elements.pathStatus.className = 'path-status success';
                this.elements.workingPath.value = result.currentPath;
            } else {
                this.elements.pathStatus.textContent = \`❌ \${result.message}\`;
                this.elements.pathStatus.className = 'path-status error';
            }
            
            // Clear status after 3 seconds
            setTimeout(() => {
                this.elements.pathStatus.textContent = '';
                this.elements.pathStatus.className = 'path-status';
            }, 3000);
            
        } catch (error) {
            console.error('Error setting path:', error);
            this.elements.pathStatus.textContent = '❌ Network error';
            this.elements.pathStatus.className = 'path-status error';
        }
    }
    
    // Autocomplete methods
    handlePathInput(value) {
        clearTimeout(this.autocompleteTimeout);
        
        if (value.trim() === '') {
            this.hideAutocomplete();
            return;
        }
        
        // Debounce autocomplete requests
        this.autocompleteTimeout = setTimeout(() => {
            this.fetchSuggestions(value);
        }, 300);
    }
    
    handlePathKeydown(e) {
        if (!this.elements.autocompleteDropdown.classList.contains('show')) {
            if (e.key === 'Enter') {
                this.setWorkingPath();
            }
            return;
        }
        
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.navigateSuggestions(1);
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                this.navigateSuggestions(-1);
                break;
                
            case 'Enter':
                e.preventDefault();
                if (this.selectedSuggestionIndex >= 0) {
                    this.selectSuggestion(this.suggestions[this.selectedSuggestionIndex]);
                } else {
                    this.setWorkingPath();
                }
                break;
                
            case 'Escape':
                this.hideAutocomplete();
                break;
                
            case 'Tab':
                e.preventDefault();
                if (this.selectedSuggestionIndex >= 0) {
                    this.selectSuggestion(this.suggestions[this.selectedSuggestionIndex]);
                } else if (this.suggestions.length === 1) {
                    this.selectSuggestion(this.suggestions[0]);
                }
                break;
        }
    }
    
    async fetchSuggestions(input) {
        try {
            const response = await fetch('/api/autocomplete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ input })
            });
            
            if (response.ok) {
                const data = await response.json();
                this.suggestions = data.suggestions || [];
                this.renderSuggestions();
                
                // Auto-complete single match
                if (this.suggestions.length === 1 && this.suggestions[0].isComplete) {
                    this.selectSuggestion(this.suggestions[0]);
                }
            }
        } catch (error) {
            console.error('Error fetching suggestions:', error);
        }
    }
    
    renderSuggestions() {
        if (this.suggestions.length === 0) {
            this.hideAutocomplete();
            return;
        }
        
        const dropdown = this.elements.autocompleteDropdown;
        dropdown.innerHTML = '';
        
        this.suggestions.forEach((suggestion, index) => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            item.setAttribute('role', 'option');
            item.innerHTML = \`
                <div class="item-name">\${this.escapeHtml(suggestion.name)}</div>
                <div class="item-path">\${this.escapeHtml(suggestion.path)}</div>
            \`;
            
            item.addEventListener('click', () => {
                this.selectSuggestion(suggestion);
            });
            
            dropdown.appendChild(item);
        });
        
        this.selectedSuggestionIndex = -1;
        this.showAutocomplete();
    }
    
    navigateSuggestions(direction) {
        const items = this.elements.autocompleteDropdown.querySelectorAll('.autocomplete-item');
        
        if (items.length === 0) return;
        
        // Clear current highlight
        if (this.selectedSuggestionIndex >= 0) {
            items[this.selectedSuggestionIndex].classList.remove('highlighted');
        }
        
        // Calculate new index
        this.selectedSuggestionIndex += direction;
        
        if (this.selectedSuggestionIndex < 0) {
            this.selectedSuggestionIndex = items.length - 1;
        } else if (this.selectedSuggestionIndex >= items.length) {
            this.selectedSuggestionIndex = 0;
        }
        
        // Highlight new item
        items[this.selectedSuggestionIndex].classList.add('highlighted');
        items[this.selectedSuggestionIndex].scrollIntoView({ block: 'nearest' });
    }
    
    selectSuggestion(suggestion) {
        this.elements.workingPath.value = suggestion.path;
        this.hideAutocomplete();
        this.elements.workingPath.focus();
        
        // Trigger input event to potentially fetch new suggestions
        if (suggestion.isComplete) {
            setTimeout(() => {
                this.handlePathInput(suggestion.path);
            }, 100);
        }
    }
    
    showAutocomplete() {
        this.elements.autocompleteDropdown.classList.add('show');
    }
    
    hideAutocomplete() {
        this.elements.autocompleteDropdown.classList.remove('show');
        this.selectedSuggestionIndex = -1;
        this.suggestions = [];
    }
    
    async updateCurrentPath() {
        try {
            const response = await fetch('/api/status');
            const status = await response.json();
            
            this.currentPath = status.currentPath;
            this.elements.workingPath.value = status.currentPath;
            this.elements.workingPath.placeholder = status.currentPath;
            
        } catch (error) {
            console.error('Error getting current path:', error);
        }
    }
    
    getAgentColor(agentName) {
        // Rich color palette for agents (matching TUI)
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD',
            '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA',
            '#FF8A80', '#80CBC4', '#81C784', '#FFB74D', '#F06292', '#9575CD',
            '#4FC3F7', '#AED581', '#FFD54F', '#A1887F', '#90A4AE', '#EF5350',
            '#26A69A', '#AB47BC', '#5C6BC0', '#42A5F5', '#66BB6A', '#FFCA28',
            '#FF7043', '#8D6E63', '#78909C', '#EC407A', '#7E57C2', '#29B6F6',
            '#8BC34A', '#FFAB40', '#8E24AA', '#43A047', '#FB8C00', '#5E35B1',
            '#00ACC1', '#C0CA33', '#FF5722', '#6D4C41', '#546E7A', '#D81B60'
        ];
        
        // Generate hash from agent name
        let hash = 0;
        for (let i = 0; i < agentName.length; i++) {
            const char = agentName.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        // Use hash to select color
        const colorIndex = Math.abs(hash) % colors.length;
        return colors[colorIndex];
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new TermaiteWebApp();
});`;
  }
  
  getAgentColor(agentName) {
    // Rich color palette for agents (matching TUI)
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD',
      '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA',
      '#FF8A80', '#80CBC4', '#81C784', '#FFB74D', '#F06292', '#9575CD',
      '#4FC3F7', '#AED581', '#FFD54F', '#A1887F', '#90A4AE', '#EF5350',
      '#26A69A', '#AB47BC', '#5C6BC0', '#42A5F5', '#66BB6A', '#FFCA28',
      '#FF7043', '#8D6E63', '#78909C', '#EC407A', '#7E57C2', '#29B6F6',
      '#FFAB91', '#C5E1A5', '#FFF176', '#BCAAA4', '#B0BEC5', '#FFCDD2',
      '#E1BEE7', '#C8E6C9', '#FFF9C4', '#D7CCC8', '#CFD8DC', '#FFCCBC'
    ];
    
    // Use same hash algorithm as TUI
    let hash = 0;
    for (let i = 0; i < agentName.length; i++) {
      const char = agentName.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    const colorIndex = Math.abs(hash) % colors.length;
    return colors[colorIndex];
  }
}

module.exports = WebServer;