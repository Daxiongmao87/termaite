"""
Configuration templates for termaite.
"""

import os
from pathlib import Path

DEFAULT_CONFIG_TEMPLATE = """# ========================================
# TERMAITE CONFIGURATION
# ========================================
# Welcome to Termaite! This configuration file needs to be set up before first use.
# 
# 🔧 REQUIRED: Update the [llm] section with your LLM details
# 💡 TIP: Most other settings can be left as default for typical usage
# 📖 Visit: https://github.com/your-repo/termaite for detailed setup instructions
#
# ========================================

# 🤖 LLM Configuration (REQUIRED - MUST BE CONFIGURED)
[llm]
# 🔗 Your LLM endpoint URL - CHANGE THIS to match your setup
# Popular options:
#   • Ollama (local):     http://localhost:11434/v1
#   • OpenAI API:         https://api.openai.com/v1  
#   • LM Studio:          http://localhost:1234/v1
#   • Custom server:      http://YOUR_IP:PORT/v1
endpoint = "http://localhost:11434/v1"

# 📏 Context window size - adjust for your model (common sizes: 2048, 4096, 8192, 32768)
context_window = 4096

# 🧠 Model name - CHANGE THIS to your preferred model
# Examples: "llama3", "mistral", "codellama", "gpt-3.5-turbo", "gpt-4"
model = "llama3"

# 🔒 Security Settings (SAFE DEFAULTS - review if needed)
[security]
# ⚠️  Gremlin Mode: Skip all command confirmations (DANGEROUS - only for advanced users)
# Set to true only if you fully trust the AI and understand the risks
gremlin_mode = false

# 📁 Project root: Commands are restricted to this directory for safety
# "." = current directory where you run termaite (recommended)
project_root = "."

# 💾 Session Management (GOOD DEFAULTS - rarely needs changes)
[session]
# Directory to store your conversation history
history_dir = "~/.termaite/sessions"

# Maximum number of conversation sessions to keep
max_sessions = 100

# ✅ Command Safety (RECOMMENDED DEFAULTS)
[whitelist]
# Enable command approval system (strongly recommended for safety)
enabled = true

# File to store approved commands  
file = "~/.termaite/whitelist.json"

# 🧠 Memory Management (OPTIMIZED DEFAULTS - rarely needs changes)
[context]
# When to compress old conversation history (75% of context window)
compaction_threshold = 0.75

# How much old content to summarize (50%)
compaction_ratio = 0.50

# When to trigger defensive reading for large outputs (50% of context window)
max_output_ratio = 0.50

# ========================================
# 🚀 QUICK START CHECKLIST:
# ========================================
# 1. ✏️  Update 'endpoint' to match your LLM server
# 2. ✏️  Update 'model' to your preferred model name  
# 3. 💾 Save this file
# 4. 🏃 Run 'termaite' to start!
#
# 🆘 Need help? Check the documentation or run 'termaite --help'
# ========================================
"""

def get_config_path() -> Path:
    """Get the configuration file path."""
    config_dir = Path.home() / ".termaite"
    config_dir.mkdir(exist_ok=True)
    return config_dir / "config.toml"

def create_default_config() -> None:
    """Create a default configuration file."""
    config_path = get_config_path()
    with open(config_path, 'w') as f:
        f.write(DEFAULT_CONFIG_TEMPLATE)

def ensure_config_exists() -> Path:
    """Ensure configuration file exists, create if not."""
    config_path = get_config_path()
    if not config_path.exists():
        create_default_config()
    return config_path