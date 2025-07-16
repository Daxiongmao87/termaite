"""
Comprehensive tests for configuration management and persistence.
"""

import pytest
import tempfile
import os
import toml
from pathlib import Path
from termaite.config.manager import ConfigManager, Config, LLMConfig, SecurityConfig, SessionConfig, WhitelistConfig, ContextConfig


class TestConfigurationPersistence:
    """Test configuration persistence functionality."""
    
    @pytest.fixture
    def temp_config_dir(self):
        """Create temporary directory for config testing."""
        with tempfile.TemporaryDirectory() as temp_dir:
            # Set environment variable to use temp directory
            old_config_home = os.environ.get('XDG_CONFIG_HOME')
            os.environ['XDG_CONFIG_HOME'] = temp_dir
            
            yield temp_dir
            
            # Restore original environment
            if old_config_home:
                os.environ['XDG_CONFIG_HOME'] = old_config_home
            elif 'XDG_CONFIG_HOME' in os.environ:
                del os.environ['XDG_CONFIG_HOME']
    
    @pytest.fixture
    def sample_config(self):
        """Create sample configuration for testing."""
        return Config(
            llm=LLMConfig(
                endpoint="http://localhost:11434/v1",
                context_window=4096,
                model="test-model"
            ),
            security=SecurityConfig(
                gremlin_mode=False,
                project_root="/tmp/test"
            ),
            session=SessionConfig(
                history_dir="~/.termaite/sessions",
                max_sessions=100
            ),
            whitelist=WhitelistConfig(
                enabled=True,
                file="~/.termaite/whitelist.json"
            ),
            context=ContextConfig(
                compaction_threshold=0.75,
                compaction_ratio=0.5,
                max_output_ratio=0.5
            )
        )
    
    def test_config_save_and_load(self, temp_config_dir, sample_config):
        """Test configuration saving and loading."""
        from unittest.mock import patch
        
        config_manager = ConfigManager()
        
        # Create initial config file path
        config_path = Path(temp_config_dir) / "termaite" / "config.toml"
        config_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Mock the ensure_config_exists to return our temp path
        with patch('termaite.config.manager.ensure_config_exists', return_value=str(config_path)):
            # Save configuration
            config_manager.save_config(sample_config)
            
            # Verify file was created
            assert config_path.exists()
            
            # Clear cached config and reload
            config_manager._config = None
            loaded_config = config_manager.load_config()
            
            # Verify all fields match
            assert loaded_config.llm.endpoint == sample_config.llm.endpoint
            assert loaded_config.llm.context_window == sample_config.llm.context_window
            assert loaded_config.llm.model == sample_config.llm.model
            assert loaded_config.security.gremlin_mode == sample_config.security.gremlin_mode
            assert loaded_config.session.max_sessions == sample_config.session.max_sessions
            assert loaded_config.whitelist.enabled == sample_config.whitelist.enabled
            assert loaded_config.context.compaction_threshold == sample_config.context.compaction_threshold
    
    def test_model_configuration_update(self, temp_config_dir, sample_config):
        """Test updating just the model configuration."""
        config_manager = ConfigManager()
        
        # Create initial config
        config_path = Path(temp_config_dir) / "termaite" / "config.toml"
        config_path.parent.mkdir(parents=True, exist_ok=True)
        config_manager.save_config(sample_config)
        
        # Load config and update model
        config = config_manager.load_config()
        original_model = config.llm.model
        new_model = "updated-test-model"
        
        config.llm.model = new_model
        config_manager.save_config(config)
        
        # Reload and verify update
        config_manager._config = None
        updated_config = config_manager.load_config()
        
        assert updated_config.llm.model == new_model
        assert updated_config.llm.model != original_model
        # Other fields should remain unchanged
        assert updated_config.llm.endpoint == sample_config.llm.endpoint
        assert updated_config.llm.context_window == sample_config.llm.context_window
    
    def test_toml_format_preservation(self, temp_config_dir, sample_config):
        """Test that TOML format is properly maintained."""
        config_manager = ConfigManager()
        
        # Create config file
        config_path = Path(temp_config_dir) / "termaite" / "config.toml"
        config_path.parent.mkdir(parents=True, exist_ok=True)
        config_manager.save_config(sample_config)
        
        # Read raw TOML content
        with open(config_path, 'r') as f:
            toml_content = f.read()
        
        # Verify TOML structure
        assert "[llm]" in toml_content
        assert "[security]" in toml_content
        assert "[session]" in toml_content
        assert "[whitelist]" in toml_content
        assert "[context]" in toml_content
        
        # Verify specific values
        parsed_toml = toml.loads(toml_content)
        assert parsed_toml["llm"]["endpoint"] == sample_config.llm.endpoint
        assert parsed_toml["llm"]["model"] == sample_config.llm.model
        assert parsed_toml["security"]["gremlin_mode"] == sample_config.security.gremlin_mode
    
    def test_config_validation_after_save(self, temp_config_dir, sample_config):
        """Test configuration validation after saving."""
        config_manager = ConfigManager()
        
        # Create config file
        config_path = Path(temp_config_dir) / "termaite" / "config.toml"
        config_path.parent.mkdir(parents=True, exist_ok=True)
        config_manager.save_config(sample_config)
        
        # Validation should pass for valid config
        config_manager._config = None
        config_manager.validate_config()  # Should not raise exception
        
        # Test validation with invalid config
        invalid_config = Config(
            llm=LLMConfig(
                endpoint="invalid-endpoint",  # Invalid URL
                context_window=-1,  # Invalid value
                model=""  # Empty model
            ),
            security=sample_config.security,
            session=sample_config.session,
            whitelist=sample_config.whitelist,
            context=sample_config.context
        )
        
        config_manager.save_config(invalid_config)
        config_manager._config = None
        
        with pytest.raises(ValueError):
            config_manager.validate_config()
    
    def test_cache_invalidation(self, temp_config_dir, sample_config):
        """Test that config cache is properly invalidated after save."""
        config_manager = ConfigManager()
        
        # Create initial config
        config_path = Path(temp_config_dir) / "termaite" / "config.toml"
        config_path.parent.mkdir(parents=True, exist_ok=True)
        config_manager.save_config(sample_config)
        
        # Load config (should be cached)
        config1 = config_manager.load_config()
        assert config1.llm.model == "test-model"
        
        # Modify and save
        config1.llm.model = "new-model"
        config_manager.save_config(config1)
        
        # Load again (should get new value, not cached)
        config2 = config_manager.load_config()
        assert config2.llm.model == "new-model"
    
    def test_concurrent_access_safety(self, temp_config_dir, sample_config):
        """Test configuration handling with concurrent access patterns."""
        config_manager1 = ConfigManager()
        config_manager2 = ConfigManager()
        
        # Create initial config with first manager
        config_path = Path(temp_config_dir) / "termaite" / "config.toml"
        config_path.parent.mkdir(parents=True, exist_ok=True)
        config_manager1.save_config(sample_config)
        
        # Load with both managers
        config1 = config_manager1.load_config()
        config2 = config_manager2.load_config()
        
        # Modify with first manager
        config1.llm.model = "manager1-model"
        config_manager1.save_config(config1)
        
        # Second manager should get updated value after reload
        config_manager2._config = None
        config2_updated = config_manager2.load_config()
        assert config2_updated.llm.model == "manager1-model"
    
    def test_path_expansion(self, temp_config_dir):
        """Test path expansion for home directory and variables."""
        config = Config(
            llm=LLMConfig(
                endpoint="http://localhost:11434/v1",
                context_window=4096,
                model="test-model"
            ),
            security=SecurityConfig(
                gremlin_mode=False,
                project_root="~/test-project"  # Home directory path
            ),
            session=SessionConfig(
                history_dir="~/.termaite/sessions",  # Home directory path
                max_sessions=100
            ),
            whitelist=WhitelistConfig(
                enabled=True,
                file="~/.termaite/whitelist.json"  # Home directory path
            ),
            context=ContextConfig(
                compaction_threshold=0.75,
                compaction_ratio=0.5,
                max_output_ratio=0.5
            )
        )
        
        config_manager = ConfigManager()
        config_path = Path(temp_config_dir) / "termaite" / "config.toml"
        config_path.parent.mkdir(parents=True, exist_ok=True)
        config_manager.save_config(config)
        
        # Load and verify paths are expanded
        config_manager._config = None
        loaded_config = config_manager.load_config()
        
        # Paths should be expanded (not contain ~)
        assert not loaded_config.security.project_root.startswith("~")
        assert not loaded_config.session.history_dir.startswith("~")
        assert not loaded_config.whitelist.file.startswith("~")
        
        # Should contain actual home directory path
        home_dir = os.path.expanduser("~")
        assert loaded_config.security.project_root.startswith(home_dir)
        assert loaded_config.session.history_dir.startswith(home_dir)
        assert loaded_config.whitelist.file.startswith(home_dir)
    
    def test_error_handling_invalid_toml(self, temp_config_dir):
        """Test error handling for invalid TOML files."""
        config_manager = ConfigManager()
        
        # Create invalid TOML file
        config_path = Path(temp_config_dir) / "termaite" / "config.toml"
        config_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(config_path, 'w') as f:
            f.write("invalid toml content [[[")
        
        config_manager._config = None
        
        with pytest.raises(ValueError, match="Invalid TOML syntax"):
            config_manager.load_config()
    
    def test_error_handling_missing_sections(self, temp_config_dir):
        """Test error handling for missing required sections."""
        config_manager = ConfigManager()
        
        # Create TOML with missing sections
        config_path = Path(temp_config_dir) / "termaite" / "config.toml"
        config_path.parent.mkdir(parents=True, exist_ok=True)
        
        incomplete_toml = """
[llm]
endpoint = "http://localhost:11434/v1"
context_window = 4096
model = "test-model"

# Missing other required sections
        """
        
        with open(config_path, 'w') as f:
            f.write(incomplete_toml)
        
        config_manager._config = None
        
        with pytest.raises(ValueError, match="Missing required section"):
            config_manager.load_config()


if __name__ == "__main__":
    pytest.main([__file__])