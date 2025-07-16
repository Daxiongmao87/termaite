"""
Comprehensive tests for context management and compaction.
"""

import pytest
import tempfile
import os
from unittest.mock import Mock, patch
from termaite.config.manager import ConfigManager, Config, LLMConfig, SecurityConfig, SessionConfig, WhitelistConfig, ContextConfig
from termaite.utils.context_compactor import ContextCompactor
from termaite.utils.defensive_reader import DefensiveReader
from termaite.core.session import SessionMessage


class TestContextCompactor:
    """Test context compaction functionality."""
    
    @pytest.fixture
    def config_manager(self):
        """Create mock configuration for testing."""
        config = Config(
            llm=LLMConfig(
                endpoint="http://localhost:11434/v1",
                context_window=4096,
                model="test-model"
            ),
            security=SecurityConfig(
                gremlin_mode=False,
                project_root="/tmp"
            ),
            session=SessionConfig(
                history_dir="/tmp/sessions",
                max_sessions=100
            ),
            whitelist=WhitelistConfig(
                enabled=True,
                file="/tmp/whitelist.json"
            ),
            context=ContextConfig(
                compaction_threshold=0.75,
                compaction_ratio=0.5,
                max_output_ratio=0.5
            )
        )
        
        config_manager = ConfigManager()
        config_manager._config = config
        return config_manager
    
    def test_token_estimation(self, config_manager):
        """Test token estimation accuracy."""
        compactor = ContextCompactor(config_manager)
        
        test_text = "This is a test string with approximately twenty words in it for testing purposes"
        tokens = compactor.estimate_tokens(test_text)
        
        # Rough estimation: ~4 characters per token
        expected = len(test_text) // 4
        assert abs(tokens - expected) <= 2, f"Token estimation off: got {tokens}, expected ~{expected}"
    
    def test_compaction_threshold(self, config_manager):
        """Test compaction threshold detection."""
        compactor = ContextCompactor(config_manager)
        
        # Create small messages (should not trigger compaction)
        small_messages = [
            SessionMessage("2024-01-01T00:00:00", "user", "hello", "user_input"),
            SessionMessage("2024-01-01T00:01:00", "assistant", "hi", "response"),
        ]
        
        assert not compactor.should_compact(small_messages)
        
        # Create large messages (should trigger compaction)
        large_content = "x" * 3000  # Large content
        large_messages = [
            SessionMessage("2024-01-01T00:00:00", "user", large_content, "user_input"),
            SessionMessage("2024-01-01T00:01:00", "assistant", large_content, "response"),
            SessionMessage("2024-01-01T00:02:00", "user", large_content, "user_input"),
        ]
        
        assert compactor.should_compact(large_messages)
    
    def test_message_compaction(self, config_manager):
        """Test message compaction process."""
        compactor = ContextCompactor(config_manager)
        
        # Create mock LLM client
        mock_llm = Mock()
        mock_llm._make_request.return_value = "Summarized content of the session"
        
        # Create messages to compact
        messages = [
            SessionMessage("2024-01-01T00:00:00", "user", "Original user prompt", "user_input"),
            SessionMessage("2024-01-01T00:01:00", "assistant", "First response", "response"),
            SessionMessage("2024-01-01T00:02:00", "user", "Second message", "user_input"),
            SessionMessage("2024-01-01T00:03:00", "assistant", "Second response", "response"),
            SessionMessage("2024-01-01T00:04:00", "user", "Third message", "user_input"),
            SessionMessage("2024-01-01T00:05:00", "assistant", "Third response", "response"),
        ]
        
        compacted = compactor.compact_messages(messages, mock_llm)
        
        # Check that compaction occurred
        assert len(compacted) < len(messages)
        
        # Check that original prompt is preserved
        original_prompts = [msg for msg in compacted if msg.role == "user" and msg.message_type == "user_input"]
        assert len(original_prompts) >= 1
        assert "Original user prompt" in [msg.content for msg in original_prompts]
        
        # Check that summary exists
        summaries = [msg for msg in compacted if msg.message_type == "summary"]
        assert len(summaries) == 1
        assert "Summarized content" in summaries[0].content
    
    def test_context_stats(self, config_manager):
        """Test context statistics calculation."""
        compactor = ContextCompactor(config_manager)
        
        messages = [
            SessionMessage("2024-01-01T00:00:00", "user", "test message", "user_input"),
            SessionMessage("2024-01-01T00:01:00", "assistant", "test response", "response"),
        ]
        
        stats = compactor.get_context_stats(messages)
        
        assert "total_tokens" in stats
        assert "context_window" in stats
        assert "usage_percentage" in stats
        assert "compaction_needed" in stats
        assert "message_count" in stats
        
        assert stats["context_window"] == 4096
        assert stats["message_count"] == 2
        assert isinstance(stats["usage_percentage"], (int, float))


class TestDefensiveReader:
    """Test defensive reading functionality."""
    
    @pytest.fixture
    def config_manager(self):
        """Create mock configuration for testing."""
        config = Config(
            llm=LLMConfig(
                endpoint="http://localhost:11434/v1",
                context_window=4096,
                model="test-model"
            ),
            security=SecurityConfig(
                gremlin_mode=False,
                project_root="/tmp"
            ),
            session=SessionConfig(
                history_dir="/tmp/sessions",
                max_sessions=100
            ),
            whitelist=WhitelistConfig(
                enabled=True,
                file="/tmp/whitelist.json"
            ),
            context=ContextConfig(
                compaction_threshold=0.75,
                compaction_ratio=0.5,
                max_output_ratio=0.5
            )
        )
        
        config_manager = ConfigManager()
        config_manager._config = config
        return config_manager
    
    def test_small_output_passes(self, config_manager):
        """Test that small outputs pass through unchanged."""
        reader = DefensiveReader(config_manager)
        
        small_output = "This is a small output"
        processed_stdout, processed_stderr = reader.handle_large_output("ls", small_output, "")
        
        assert processed_stdout == small_output
        assert processed_stderr == ""
    
    def test_large_output_blocked(self, config_manager):
        """Test that large outputs are blocked with error message."""
        reader = DefensiveReader(config_manager)
        
        # Create large output (>50% of context window)
        large_output = "x" * 10000
        processed_stdout, processed_stderr = reader.handle_large_output("ls", large_output, "")
        
        assert processed_stdout == ""
        assert "OUTPUT TOO LARGE" in processed_stderr
        assert "50% of context window" in processed_stderr
    
    def test_command_specific_suggestions(self, config_manager):
        """Test command-specific suggestions."""
        reader = DefensiveReader(config_manager)
        
        # Test find command suggestions
        large_output = "x" * 10000
        processed_stdout, processed_stderr = reader.handle_large_output("find", large_output, "")
        
        assert "find . -name" in processed_stderr
        assert "head -20" in processed_stderr
    
    def test_output_size_check(self, config_manager):
        """Test output size checking."""
        reader = DefensiveReader(config_manager)
        
        small_output = "small"
        is_too_large, token_count = reader.check_output_size(small_output)
        assert not is_too_large
        
        large_output = "x" * 10000
        is_too_large, token_count = reader.check_output_size(large_output)
        assert is_too_large
        assert token_count > 0
    
    def test_alternative_commands(self, config_manager):
        """Test alternative command suggestions."""
        reader = DefensiveReader(config_manager)
        
        alternatives = reader.suggest_alternative_commands("find . -name '*.py'")
        assert len(alternatives) > 0
        assert any("head -20" in alt for alt in alternatives)
        
        alternatives = reader.suggest_alternative_commands("cat large_file.txt")
        assert len(alternatives) > 0
        assert any("head -20" in alt for alt in alternatives)
    
    def test_output_pattern_analysis(self, config_manager):
        """Test output pattern analysis."""
        reader = DefensiveReader(config_manager)
        
        # Test file listing pattern
        file_listing = "\n".join(["-rw-r--r-- 1 user user 1234 Jan 1 file.txt"] * 200)
        analysis = reader.analyze_output_pattern(file_listing)
        assert "file listing" in analysis.lower()
        
        # Test search results pattern
        search_results = "\n".join(["file.py:123:search term"] * 200)
        analysis = reader.analyze_output_pattern(search_results)
        assert "search results" in analysis.lower()
    
    def test_summary_creation(self, config_manager):
        """Test large output summary creation."""
        reader = DefensiveReader(config_manager)
        
        # Create output with many lines
        lines = [f"Line {i}" for i in range(100)]
        large_output = "\n".join(lines)
        
        summary = reader.create_summary_from_large_output(large_output, max_lines=20)
        
        # Should contain first and last portions
        assert "Line 0" in summary
        assert "Line 99" in summary
        assert "lines omitted" in summary


if __name__ == "__main__":
    pytest.main([__file__])