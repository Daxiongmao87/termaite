"""
Comprehensive tests for project initialization and context generation.
"""

import pytest
import tempfile
import os
import json
from pathlib import Path
from unittest.mock import Mock, patch
from termaite.core.project_init import ProjectDiscovery, ContextGenerator, ProjectInitializer, ProjectInfo
from termaite.config.manager import ConfigManager


class TestProjectDiscovery:
    """Test project discovery functionality."""
    
    @pytest.fixture
    def temp_project(self):
        """Create temporary project structure for testing."""
        with tempfile.TemporaryDirectory() as temp_dir:
            # Create Python project structure
            (Path(temp_dir) / "requirements.txt").write_text("flask==2.0.1\npytest==6.2.4")
            (Path(temp_dir) / "app.py").write_text("from flask import Flask\napp = Flask(__name__)")
            (Path(temp_dir) / "README.md").write_text("# Test Project")
            
            # Create source directory
            src_dir = Path(temp_dir) / "src"
            src_dir.mkdir()
            (src_dir / "__init__.py").write_text("")
            (src_dir / "main.py").write_text("def main(): pass")
            
            # Create tests directory
            tests_dir = Path(temp_dir) / "tests"
            tests_dir.mkdir()
            (tests_dir / "test_main.py").write_text("def test_main(): pass")
            
            yield temp_dir
    
    def test_python_project_detection(self, temp_project):
        """Test Python project detection."""
        discovery = ProjectDiscovery(temp_project)
        project_info = discovery.discover_project()
        
        assert project_info.project_type == "python"
        assert project_info.language == "python"
        assert project_info.framework == "flask"
        assert project_info.build_system == "pip"
        assert "requirements.txt" in project_info.key_files
        assert "app.py" in project_info.key_files
    
    def test_javascript_project_detection(self):
        """Test JavaScript project detection."""
        with tempfile.TemporaryDirectory() as temp_dir:
            # Create JavaScript project
            package_json = {
                "name": "test-project",
                "version": "1.0.0",
                "dependencies": {
                    "react": "^17.0.0",
                    "express": "^4.17.0"
                }
            }
            (Path(temp_dir) / "package.json").write_text(json.dumps(package_json))
            (Path(temp_dir) / "index.js").write_text("const express = require('express')")
            
            discovery = ProjectDiscovery(temp_dir)
            project_info = discovery.discover_project()
            
            assert project_info.project_type == "javascript"
            assert project_info.language == "javascript"
            assert project_info.build_system == "npm"
            assert "package.json" in project_info.key_files
    
    def test_go_project_detection(self):
        """Test Go project detection."""
        with tempfile.TemporaryDirectory() as temp_dir:
            # Create Go project
            (Path(temp_dir) / "go.mod").write_text("module test\n\ngo 1.19")
            (Path(temp_dir) / "main.go").write_text("package main\n\nfunc main() {}")
            
            discovery = ProjectDiscovery(temp_dir)
            project_info = discovery.discover_project()
            
            assert project_info.project_type == "go"
            assert project_info.language == "go"
            assert project_info.build_system == "go_modules"
            assert "go.mod" in project_info.key_files
    
    def test_unknown_project_detection(self):
        """Test unknown project type detection."""
        with tempfile.TemporaryDirectory() as temp_dir:
            # Create directory with no recognizable project files
            (Path(temp_dir) / "random.txt").write_text("some content")
            
            discovery = ProjectDiscovery(temp_dir)
            project_info = discovery.discover_project()
            
            assert project_info.project_type == "unknown"
            assert project_info.language == "unknown"
    
    def test_structure_scanning(self, temp_project):
        """Test directory structure scanning."""
        discovery = ProjectDiscovery(temp_project)
        project_info = discovery.discover_project()
        
        structure_str = "\n".join(project_info.structure)
        assert "📁 src/" in structure_str
        assert "📁 tests/" in structure_str
        assert "📄 app.py" in structure_str
        assert "📄 requirements.txt" in structure_str
    
    def test_key_file_detection(self, temp_project):
        """Test key file detection."""
        discovery = ProjectDiscovery(temp_project)
        project_info = discovery.discover_project()
        
        expected_files = ["requirements.txt", "app.py", "README.md"]
        for expected_file in expected_files:
            assert expected_file in project_info.key_files
    
    def test_framework_detection(self, temp_project):
        """Test framework detection from file contents."""
        discovery = ProjectDiscovery(temp_project)
        project_info = discovery.discover_project()
        
        # Should detect Flask from app.py content
        assert project_info.framework == "flask"


class TestContextGenerator:
    """Test context generation functionality."""
    
    @pytest.fixture
    def mock_config_manager(self):
        """Create mock config manager."""
        config_manager = Mock(spec=ConfigManager)
        return config_manager
    
    @pytest.fixture
    def sample_project_info(self):
        """Create sample project info for testing."""
        return ProjectInfo(
            project_type="python",
            language="python",
            framework="flask",
            build_system="pip",
            structure=["📁 src/", "📄 app.py", "📄 requirements.txt"],
            key_files=["app.py", "requirements.txt", "README.md"],
            description="Python project using Flask with pip build system"
        )
    
    def test_template_generation(self, mock_config_manager, sample_project_info):
        """Test template-based context generation."""
        generator = ContextGenerator(mock_config_manager)
        
        with tempfile.TemporaryDirectory() as temp_dir:
            context = generator._generate_template(sample_project_info, temp_dir)
            
            # Check that context contains expected sections
            assert "# " in context  # Title section
            assert "## Project Overview" in context
            assert "## Description" in context
            assert "## Project Structure" in context
            assert "## Key Files" in context
            assert "## Operational Guidance" in context
            
            # Check that project info is included
            assert "Python" in context
            assert "Flask" in context
            assert "pip" in context
            assert "app.py" in context
            assert "requirements.txt" in context
    
    def test_project_guidance_generation(self, mock_config_manager, sample_project_info):
        """Test project-specific guidance generation."""
        generator = ContextGenerator(mock_config_manager)
        
        # Test Python Flask guidance
        guidance = generator._get_project_guidance("python", "flask")
        assert "blueprints" in guidance.lower()
        assert "flask-sqlalchemy" in guidance.lower()
        
        # Test general Python guidance
        guidance = generator._get_project_guidance("python", None)
        assert "virtual environment" in guidance.lower()
        assert "pep 8" in guidance.lower()
        
        # Test JavaScript guidance
        guidance = generator._get_project_guidance("javascript", "react")
        assert "functional components" in guidance.lower()
        assert "hooks" in guidance.lower()
    
    def test_common_commands_generation(self, mock_config_manager):
        """Test common commands generation."""
        generator = ContextGenerator(mock_config_manager)
        
        # Test Python commands
        commands = generator._get_common_commands("python", "pip")
        assert "pip install" in commands
        assert "pytest" in commands
        
        # Test JavaScript commands
        commands = generator._get_common_commands("javascript", "npm")
        assert "npm install" in commands
        assert "npm start" in commands
        
        # Test Go commands
        commands = generator._get_common_commands("go", "go_modules")
        assert "go mod tidy" in commands
        assert "go run" in commands
    
    def test_workflow_guidance(self, mock_config_manager):
        """Test workflow guidance generation."""
        generator = ContextGenerator(mock_config_manager)
        
        python_workflow = generator._get_workflow_guidance("python", None)
        assert "virtual environment" in python_workflow.lower()
        assert "dependencies" in python_workflow.lower()
        
        javascript_workflow = generator._get_workflow_guidance("javascript", None)
        assert "dependencies" in javascript_workflow.lower()
        assert "development server" in javascript_workflow.lower()


class TestProjectInitializer:
    """Test project initialization coordination."""
    
    @pytest.fixture
    def mock_config_manager(self):
        """Create mock config manager."""
        config_manager = Mock(spec=ConfigManager)
        return config_manager
    
    def test_successful_initialization(self, mock_config_manager):
        """Test successful project initialization."""
        with tempfile.TemporaryDirectory() as temp_dir:
            # Create a simple Python project
            (Path(temp_dir) / "requirements.txt").write_text("flask==2.0.1")
            (Path(temp_dir) / "app.py").write_text("from flask import Flask")
            
            initializer = ProjectInitializer(mock_config_manager)
            success = initializer.initialize_project(temp_dir)
            
            assert success
            
            # Check that .TERMAITE.md was created
            context_file = Path(temp_dir) / ".TERMAITE.md"
            assert context_file.exists()
            
            # Check content
            content = context_file.read_text()
            assert "Project Overview" in content
            assert "Python" in content
            assert "Flask" in content
    
    def test_context_loading(self, mock_config_manager):
        """Test context loading from existing file."""
        with tempfile.TemporaryDirectory() as temp_dir:
            # Create .TERMAITE.md file
            context_content = "# Test Project\n\nThis is a test project."
            context_file = Path(temp_dir) / ".TERMAITE.md"
            context_file.write_text(context_content)
            
            initializer = ProjectInitializer(mock_config_manager)
            loaded_context = initializer.load_project_context(temp_dir)
            
            assert loaded_context == context_content
    
    def test_context_for_llm(self, mock_config_manager):
        """Test context formatting for LLM."""
        with tempfile.TemporaryDirectory() as temp_dir:
            # Create .TERMAITE.md file
            context_content = "# Test Project\n\nThis is a test project."
            context_file = Path(temp_dir) / ".TERMAITE.md"
            context_file.write_text(context_content)
            
            initializer = ProjectInitializer(mock_config_manager)
            llm_context = initializer.get_project_context_for_llm(temp_dir)
            
            assert "# PROJECT CONTEXT" in llm_context
            assert context_content in llm_context
    
    def test_missing_context_file(self, mock_config_manager):
        """Test handling of missing context file."""
        with tempfile.TemporaryDirectory() as temp_dir:
            initializer = ProjectInitializer(mock_config_manager)
            
            # Should return None for missing file
            loaded_context = initializer.load_project_context(temp_dir)
            assert loaded_context is None
            
            # Should return empty string for LLM context
            llm_context = initializer.get_project_context_for_llm(temp_dir)
            assert llm_context == ""
    
    def test_initialization_error_handling(self, mock_config_manager):
        """Test error handling during initialization."""
        # Try to initialize in a non-existent directory
        initializer = ProjectInitializer(mock_config_manager)
        success = initializer.initialize_project("/non/existent/directory")
        
        assert not success


if __name__ == "__main__":
    pytest.main([__file__])