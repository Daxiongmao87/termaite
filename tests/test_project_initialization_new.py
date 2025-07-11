"""Tests for the refactored project initialization functionality."""

import pytest
from unittest.mock import Mock, patch, MagicMock
from pathlib import Path
import tempfile
import shutil
import os

from termaite.core.project_initialization import ProjectInitializationTask, create_project_initialization_task
from termaite.llm.parsers import parse_file_content_blocks, extract_and_save_generated_files, validate_generated_prompt_files


class TestProjectInitializationTask:
    """Test the new ProjectInitializationTask implementation."""

    def setup_method(self):
        """Set up test environment."""
        # Create a temporary directory for testing
        self.test_dir = Path(tempfile.mkdtemp())
        self.termaite_dir = self.test_dir / ".termaite"

    def teardown_method(self):
        """Clean up test environment."""
        if self.test_dir.exists():
            shutil.rmtree(self.test_dir)

    def test_project_initialization_task_creation(self):
        """Test creating a ProjectInitializationTask."""
        # Mock task handler
        mock_task_handler = Mock()
        mock_task_handler.config = {}
        mock_task_handler.config_manager = Mock()
        mock_task_handler.config_manager.get_command_maps.return_value = ({}, {})
        
        # Create task
        task = ProjectInitializationTask(mock_task_handler, str(self.test_dir))
        
        assert task.task_handler == mock_task_handler
        assert task.initial_working_directory == str(self.test_dir)
        assert task.termaite_dir == self.test_dir / ".termaite"
        assert task.captured_responses == []

    def test_create_initialization_task_content(self):
        """Test that the initialization task is properly formatted."""
        mock_task_handler = Mock()
        mock_task_handler.config = {
            "plan_prompt": "Test plan prompt",
            "action_prompt": "Test action prompt", 
            "evaluate_prompt": "Test evaluate prompt"
        }
        
        task = ProjectInitializationTask(mock_task_handler, str(self.test_dir))
        initialization_task = task._create_initialization_task()
        
        # Verify task contains key elements
        assert "PLANNER.md" in initialization_task
        assert "ACTOR.md" in initialization_task
        assert "EVALUATOR.md" in initialization_task
        assert "Project-Specific" in initialization_task
        assert str(self.test_dir) in initialization_task

    def test_add_investigation_commands(self):
        """Test adding investigation commands."""
        mock_task_handler = Mock()
        mock_task_handler.config_manager.get_command_maps.return_value = ({"echo": "test"}, {})
        mock_task_handler.payload_builder = Mock()
        mock_task_handler.permission_manager = Mock()
        
        task = ProjectInitializationTask(mock_task_handler, str(self.test_dir))
        task._add_investigation_commands()
        
        # Verify that enhanced commands were set
        mock_task_handler.payload_builder.set_command_maps.assert_called_once()
        mock_task_handler.permission_manager.set_command_maps.assert_called_once()
        
        # Check that investigation commands were added
        call_args = mock_task_handler.payload_builder.set_command_maps.call_args[0]
        enhanced_allowed = call_args[0]
        assert "ls" in enhanced_allowed
        assert "cat" in enhanced_allowed
        assert "echo" in enhanced_allowed  # Original command preserved

    def test_response_capture_mechanism(self):
        """Test the response capture mechanism."""
        mock_task_handler = Mock()
        mock_task_handler.handle_task.return_value = True
        
        # Mock LLM client
        mock_llm_client = Mock()
        original_send_request = Mock(return_value="Test response")
        mock_llm_client.send_request = original_send_request
        mock_task_handler.llm_client = mock_llm_client
        
        task = ProjectInitializationTask(mock_task_handler, str(self.test_dir))
        
        # Execute with response capture
        result = task._execute_with_response_capture("test task")
        
        # Verify result and captured responses
        assert result is True
        assert len(task.captured_responses) == 0  # No actual LLM calls made in this test
        
        # Verify original method is restored
        assert mock_task_handler.llm_client.send_request == original_send_request

    def test_extract_generated_files_no_responses(self):
        """Test file extraction when no responses are captured."""
        mock_task_handler = Mock()
        task = ProjectInitializationTask(mock_task_handler, str(self.test_dir))
        
        created_files = task._extract_generated_files()
        
        assert created_files == []

    def test_execute_creates_termaite_directory(self):
        """Test that execute creates .termaite directory."""
        mock_task_handler = Mock()
        mock_task_handler.config = {"plan_prompt": "test", "action_prompt": "test", "evaluate_prompt": "test"}
        mock_task_handler.config_manager.get_command_maps.return_value = ({}, {})
        mock_task_handler.handle_task.return_value = True
        mock_task_handler.llm_client.send_request = Mock(return_value="No files generated")
        
        task = ProjectInitializationTask(mock_task_handler, str(self.test_dir))
        
        # Mock _extract_generated_files to return empty list
        task._extract_generated_files = Mock(return_value=[])
        
        # Should create directory but return False due to no files
        result = task.execute()
        
        assert self.termaite_dir.exists()
        assert self.termaite_dir.is_dir()
        assert result is False  # Because no files were extracted

    def test_create_project_initialization_task_factory(self):
        """Test the factory function."""
        mock_task_handler = Mock()
        
        task = create_project_initialization_task(mock_task_handler, str(self.test_dir))
        
        assert isinstance(task, ProjectInitializationTask)
        assert task.task_handler == mock_task_handler
        assert task.initial_working_directory == str(self.test_dir)


class TestFileContentParsers:
    """Test the new file content parsing functions."""

    def test_parse_file_content_blocks_pattern1(self):
        """Test parsing markdown blocks with filename comments."""
        llm_output = """
Here are the files:

```markdown
# .termaite/PLANNER.md
This is the planner content.
Multi-line content here.
```

```markdown
# .termaite/ACTOR.md
This is the actor content.
```
"""
        
        result = parse_file_content_blocks(llm_output)
        
        assert len(result) == 2
        assert ".termaite/PLANNER.md" in result
        assert ".termaite/ACTOR.md" in result
        assert "This is the planner content." in result[".termaite/PLANNER.md"]
        assert "Multi-line content here." in result[".termaite/PLANNER.md"]

    def test_parse_file_content_blocks_pattern2(self):
        """Test parsing with File: headers."""
        llm_output = """
**File: .termaite/PLANNER.md**
```
Planner prompt content here
```

**File: .termaite/ACTOR.md**
```
Actor prompt content here
```
"""
        
        result = parse_file_content_blocks(llm_output)
        
        # The parser should extract the files, even if multiple patterns match
        assert ".termaite/PLANNER.md" in result
        assert ".termaite/ACTOR.md" in result
        assert "Planner prompt content here" in result[".termaite/PLANNER.md"]
        assert "Actor prompt content here" in result[".termaite/ACTOR.md"]

    def test_extract_and_save_generated_files(self):
        """Test extracting and saving files to filesystem."""
        with tempfile.TemporaryDirectory() as temp_dir:
            llm_output = """
```markdown
# .termaite/PLANNER.md
Enhanced planner prompt for this project.

## Project-Specific Planning Guidance
- Domain knowledge here
- Best practices here
```

```markdown
# .termaite/ACTOR.md
Enhanced actor prompt for this project.

## Project-Specific Action Guidance
- Commands specific to this project
```
"""
            
            created_files = extract_and_save_generated_files(llm_output, temp_dir)
            
            assert len(created_files) == 2
            
            # Verify files were created
            planner_file = Path(temp_dir) / ".termaite" / "PLANNER.md"
            actor_file = Path(temp_dir) / ".termaite" / "ACTOR.md"
            
            assert planner_file.exists()
            assert actor_file.exists()
            
            # Verify content
            planner_content = planner_file.read_text()
            assert "Enhanced planner prompt" in planner_content
            assert "Project-Specific Planning Guidance" in planner_content

    def test_validate_generated_prompt_files_valid(self):
        """Test validation of properly generated prompt files."""
        with tempfile.TemporaryDirectory() as temp_dir:
            # Create valid files
            termaite_dir = Path(temp_dir) / ".termaite"
            termaite_dir.mkdir()
            
            for filename in ["PLANNER.md", "ACTOR.md", "EVALUATOR.md"]:
                file_path = termaite_dir / filename
                file_path.write_text(f"""
Enhanced {filename} prompt content that is long enough.

## Project-Specific Guidance
This section contains project-specific enhancements for the {filename} agent.
It includes domain knowledge, best practices, and specific guidance.
""")
            
            file_paths = [str(termaite_dir / f) for f in ["PLANNER.md", "ACTOR.md", "EVALUATOR.md"]]
            valid, issues = validate_generated_prompt_files(file_paths)
            
            assert valid is True
            assert len(issues) == 0

    def test_validate_generated_prompt_files_invalid(self):
        """Test validation of improperly generated prompt files."""
        with tempfile.TemporaryDirectory() as temp_dir:
            # Create invalid files
            termaite_dir = Path(temp_dir) / ".termaite"
            termaite_dir.mkdir()
            
            # Too short content
            (termaite_dir / "PLANNER.md").write_text("Short")
            
            # Missing Project-Specific section
            (termaite_dir / "ACTOR.md").write_text("Long enough content but missing the required Project-Specific section that we need.")
            
            # Contains TODO
            (termaite_dir / "EVALUATOR.md").write_text("""
Long enough content with Project-Specific section.

## Project-Specific Guidance
TODO: Add project-specific guidance here
""")
            
            file_paths = [str(termaite_dir / f) for f in ["PLANNER.md", "ACTOR.md", "EVALUATOR.md"]]
            valid, issues = validate_generated_prompt_files(file_paths)
            
            assert valid is False
            assert len(issues) >= 3  # At least one issue per file

    def test_extract_and_save_security_check(self):
        """Test that file extraction prevents path traversal attacks."""
        with tempfile.TemporaryDirectory() as temp_dir:
            # Try to write outside the target directory
            llm_output = """
```markdown
# ../../../etc/passwd
malicious content
```

```markdown
# /etc/shadow
malicious content
```
"""
            
            created_files = extract_and_save_generated_files(llm_output, temp_dir)
            
            # Should not create any files due to security restrictions
            assert len(created_files) == 0
            
            # Verify no files were created outside temp_dir
            assert not Path("/etc/passwd_test").exists()
            assert not Path("/tmp/malicious").exists()


if __name__ == "__main__":
    pytest.main([__file__])