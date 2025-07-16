"""
Configuration manager for termaite.
"""

import os
import toml
from pathlib import Path
from typing import Dict, Any, Optional
from dataclasses import dataclass
from .templates import ensure_config_exists, get_config_path


@dataclass
class LLMConfig:
    """LLM configuration."""
    endpoint: str
    context_window: int
    model: str


@dataclass
class SecurityConfig:
    """Security configuration."""
    gremlin_mode: bool
    project_root: str


@dataclass
class SessionConfig:
    """Session configuration."""
    history_dir: str
    max_sessions: int


@dataclass
class WhitelistConfig:
    """Whitelist configuration."""
    enabled: bool
    file: str


@dataclass
class ContextConfig:
    """Context management configuration."""
    compaction_threshold: float
    compaction_ratio: float
    max_output_ratio: float


@dataclass
class Config:
    """Main configuration class."""
    llm: LLMConfig
    security: SecurityConfig
    session: SessionConfig
    whitelist: WhitelistConfig
    context: ContextConfig


class ConfigManager:
    """Manages termaite configuration."""
    
    def __init__(self):
        self.config_path = get_config_path()
        self._config: Optional[Config] = None
    
    def load_config(self) -> Config:
        """Load configuration from file."""
        if self._config is None:
            self._config = self._load_from_file()
        return self._config
    
    def _load_from_file(self) -> Config:
        """Load configuration from TOML file."""
        config_path = ensure_config_exists()
        
        try:
            with open(config_path, 'r') as f:
                data = toml.load(f)
            
            # Validate required sections
            required_sections = ['llm', 'security', 'session', 'whitelist', 'context']
            for section in required_sections:
                if section not in data:
                    raise ValueError(f"Missing required section [{section}] in config")
            
            # Validate required LLM fields
            llm_data = data['llm']
            required_llm_fields = ['endpoint', 'context_window', 'model']
            for field in required_llm_fields:
                if field not in llm_data or not llm_data[field]:
                    raise ValueError(f"Missing required field 'llm.{field}' in config")
            
            # Expand home directory in paths
            session_data = data['session'].copy()
            session_data['history_dir'] = os.path.expanduser(session_data['history_dir'])
            
            whitelist_data = data['whitelist'].copy()
            whitelist_data['file'] = os.path.expanduser(whitelist_data['file'])
            
            security_data = data['security'].copy()
            security_data['project_root'] = os.path.expanduser(security_data['project_root'])
            
            return Config(
                llm=LLMConfig(**llm_data),
                security=SecurityConfig(**security_data),
                session=SessionConfig(**session_data),
                whitelist=WhitelistConfig(**whitelist_data),
                context=ContextConfig(**data['context'])
            )
            
        except FileNotFoundError:
            raise ValueError(f"Configuration file not found: {config_path}")
        except toml.TomlDecodeError as e:
            raise ValueError(f"Invalid TOML syntax in config file: {e}")
        except Exception as e:
            raise ValueError(f"Error loading configuration: {e}")
    
    def validate_config(self) -> None:
        """Validate configuration values."""
        config = self.load_config()
        
        # Validate LLM endpoint
        if not config.llm.endpoint.startswith(('http://', 'https://')):
            raise ValueError("LLM endpoint must start with http:// or https://")
        
        # Validate context window
        if config.llm.context_window <= 0:
            raise ValueError("Context window must be positive")
        
        # Validate model name
        if not config.llm.model.strip():
            raise ValueError("Model name cannot be empty")
        
        # Validate project root
        project_root = Path(config.security.project_root).resolve()
        if not project_root.exists():
            raise ValueError(f"Project root directory does not exist: {project_root}")
        
        # Validate context ratios
        if not (0 < config.context.compaction_threshold <= 1):
            raise ValueError("Compaction threshold must be between 0 and 1")
        
        if not (0 < config.context.compaction_ratio <= 1):
            raise ValueError("Compaction ratio must be between 0 and 1")
        
        if not (0 < config.context.max_output_ratio <= 1):
            raise ValueError("Max output ratio must be between 0 and 1")
    
    def get_config_path(self) -> Path:
        """Get the configuration file path."""
        return self.config_path
    
    def open_config_in_editor(self) -> None:
        """Open configuration file in $EDITOR."""
        editor = os.environ.get('EDITOR', 'nano')
        config_path = ensure_config_exists()
        os.system(f"{editor} {config_path}")
    
    def reload_config(self) -> None:
        """Reload configuration from file."""
        self._config = None
    
    def save_config(self, config: Config) -> None:
        """Save configuration to TOML file."""
        config_path = ensure_config_exists()
        
        try:
            # Convert config dataclasses to dict for TOML serialization
            config_dict = {
                'llm': {
                    'endpoint': config.llm.endpoint,
                    'context_window': config.llm.context_window,
                    'model': config.llm.model
                },
                'security': {
                    'gremlin_mode': config.security.gremlin_mode,
                    'project_root': config.security.project_root
                },
                'session': {
                    'history_dir': config.session.history_dir,
                    'max_sessions': config.session.max_sessions
                },
                'whitelist': {
                    'enabled': config.whitelist.enabled,
                    'file': config.whitelist.file
                },
                'context': {
                    'compaction_threshold': config.context.compaction_threshold,
                    'compaction_ratio': config.context.compaction_ratio,
                    'max_output_ratio': config.context.max_output_ratio
                }
            }
            
            # Write to file with proper formatting
            with open(config_path, 'w') as f:
                toml.dump(config_dict, f)
            
            # Clear cached config to force reload
            self._config = None
            
        except Exception as e:
            raise ValueError(f"Error saving configuration: {e}")