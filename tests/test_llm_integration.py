#!/usr/bin/env python3
"""
Test LLM client integration.
"""

import pytest
import tempfile
import os
import shutil
from unittest.mock import Mock, patch, MagicMock
import json

from termaite.config.manager import ConfigManager
from termaite.config.templates import ensure_config_exists
from termaite.llm.client import LLMClient
from termaite.llm.schemas import JSONProtocol


class TestLLMClientIntegration:
    """Test LLM client integration with mocked responses."""
    
    def setup_method(self):
        """Set up test environment."""
        self.temp_dir = tempfile.mkdtemp()
        self.original_home = os.environ.get('HOME')
        os.environ['HOME'] = self.temp_dir
        
        # Create config
        ensure_config_exists()
        self.config_manager = ConfigManager()
        
        # Create LLM client
        self.llm_client = LLMClient(self.config_manager)
    
    def teardown_method(self):
        """Clean up test environment."""
        if self.original_home:
            os.environ['HOME'] = self.original_home
        else:
            os.environ.pop('HOME', None)
        shutil.rmtree(self.temp_dir)
    
    @patch('requests.post')
    def test_goal_creation_request(self, mock_post):
        """Test goal creation request."""
        # Mock response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'choices': [{
                'message': {
                    'content': json.dumps({
                        "message": "Creating goal statement for user request",
                        "operation": {
                            "create_goal": {
                                "statement": "Find all Python files in the project"
                            }
                        }
                    })
                }
            }]
        }
        mock_post.return_value = mock_response
        
        # Test goal creation
        user_input = "Find all Python files in the project"
        response = self.llm_client.create_goal(user_input)
        
        # Verify response
        assert "Creating goal statement" in response
        assert "Find all Python files in the project" in response
        
        # Verify request was made
        mock_post.assert_called_once()
        call_args = mock_post.call_args
        assert call_args[0][0].endswith('/chat/completions')
        
        # Check request data
        request_data = call_args[1]['json']
        assert request_data['model'] == 'llama3'
        assert len(request_data['messages']) == 2
        assert request_data['messages'][0]['role'] == 'system'
        assert request_data['messages'][1]['role'] == 'user'
        assert user_input in request_data['messages'][1]['content']
    
    @patch('requests.post')
    def test_task_status_request(self, mock_post):
        """Test task status determination request."""
        # Mock response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'choices': [{
                'message': {
                    'content': json.dumps({
                        "message": "Task is still in progress",
                        "operation": {
                            "determine_task_status": "IN_PROGRESS"
                        }
                    })
                }
            }]
        }
        mock_post.return_value = mock_response
        
        # Test task status determination
        goal_statement = "Find all Python files in the project"
        context = "Listed files, found 5 Python files"
        response = self.llm_client.determine_task_status(goal_statement, context)
        
        # Verify response
        assert "Task is still in progress" in response
        assert "IN_PROGRESS" in response
        
        # Verify request was made with correct data
        mock_post.assert_called_once()
        call_args = mock_post.call_args
        request_data = call_args[1]['json']
        assert goal_statement in str(request_data['messages'])
        assert context in str(request_data['messages'])
    
    @patch('requests.post')
    def test_plan_creation_request(self, mock_post):
        """Test plan creation request."""
        # Mock response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'choices': [{
                'message': {
                    'content': json.dumps({
                        "message": "Creating plan to find Python files",
                        "operation": {
                            "manage_plan": [
                                {
                                    "step": 1,
                                    "action": "INSERT",
                                    "description": "find . -name '*.py' -type f"
                                }
                            ]
                        }
                    })
                }
            }]
        }
        mock_post.return_value = mock_response
        
        # Test plan creation
        goal_statement = "Find all Python files in the project"
        context = "Starting task execution"
        response = self.llm_client.create_plan(goal_statement, context)
        
        # Verify response
        assert "Creating plan" in response
        assert "find . -name '*.py' -type f" in response
        
        # Verify request was made
        mock_post.assert_called_once()
    
    @patch('requests.post')
    def test_bash_command_request(self, mock_post):
        """Test bash command request."""
        # Mock response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'choices': [{
                'message': {
                    'content': json.dumps({
                        "message": "Executing find command to locate Python files",
                        "operation": {
                            "invoke_bash_command": {
                                "command": "find . -name '*.py' -type f"
                            }
                        }
                    })
                }
            }]
        }
        mock_post.return_value = mock_response
        
        # Test bash command generation
        current_step = {"description": "find . -name '*.py' -type f"}
        context = "Need to find Python files"
        response = self.llm_client.get_bash_command(current_step, context)
        
        # Verify response
        assert "Executing find command" in response
        assert "find . -name '*.py' -type f" in response
        
        # Verify request was made
        mock_post.assert_called_once()
    
    @patch('requests.get')
    def test_get_available_models(self, mock_get):
        """Test getting available models."""
        # Mock response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'data': [
                {'id': 'llama3'},
                {'id': 'llama3-8b'},
                {'id': 'codellama'}
            ]
        }
        mock_get.return_value = mock_response
        
        # Test getting models
        models = self.llm_client.get_available_models()
        
        # Verify response
        assert 'llama3' in models
        assert 'llama3-8b' in models
        assert 'codellama' in models
        
        # Verify request was made
        mock_get.assert_called_once()
        call_args = mock_get.call_args
        assert call_args[0][0].endswith('/models')
    
    @patch('requests.post')
    def test_connection_test(self, mock_post):
        """Test connection testing."""
        # Mock successful response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'choices': [{'message': {'content': 'Hello'}}]
        }
        mock_post.return_value = mock_response
        
        # Test connection
        assert self.llm_client.test_connection()
        
        # Test failed connection
        mock_post.side_effect = Exception("Connection failed")
        assert not self.llm_client.test_connection()
    
    @patch('requests.post')
    def test_error_handling(self, mock_post):
        """Test error handling in LLM requests."""
        # Test HTTP error
        mock_response = Mock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"
        mock_post.return_value = mock_response
        
        with pytest.raises(Exception, match="API request failed"):
            self.llm_client.create_goal("Test input")
        
        # Test invalid JSON response
        mock_response.status_code = 200
        mock_response.json.side_effect = json.JSONDecodeError("Invalid JSON", "", 0)
        mock_post.return_value = mock_response
        
        with pytest.raises(Exception, match="Invalid JSON response"):
            self.llm_client.create_goal("Test input")
        
        # Test missing choices
        mock_response.json.side_effect = None
        mock_response.json.return_value = {}
        
        with pytest.raises(Exception, match="No choices in API response"):
            self.llm_client.create_goal("Test input")
    
    @patch('requests.post')
    def test_invalid_llm_responses(self, mock_post):
        """Test handling of invalid LLM responses."""
        # Test invalid JSON from LLM
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'choices': [{'message': {'content': 'Invalid JSON response'}}]
        }
        mock_post.return_value = mock_response
        
        with pytest.raises(ValueError, match="Invalid goal response from LLM"):
            self.llm_client.create_goal("Test input")
        
        # Test missing required fields
        mock_response.json.return_value = {
            'choices': [{
                'message': {
                    'content': json.dumps({
                        "message": "Creating goal",
                        "operation": {
                            "create_goal": {
                                "statement": ""  # Empty statement
                            }
                        }
                    })
                }
            }]
        }
        
        with pytest.raises(ValueError, match="Invalid goal response from LLM"):
            self.llm_client.create_goal("Test input")
    
    def test_json_protocol_integration(self):
        """Test JSON protocol integration with LLM client."""
        # Test that LLM client validates responses using JSON protocol
        valid_goal_response = json.dumps({
            "message": "Creating goal statement",
            "operation": {
                "create_goal": {
                    "statement": "Find all Python files"
                }
            }
        })
        
        # This should not raise an exception
        parsed = JSONProtocol.parse_response(valid_goal_response, "goal")
        assert parsed.message == "Creating goal statement"
        assert parsed.operation.create_goal["statement"] == "Find all Python files"
        
        # Test invalid response
        invalid_response = json.dumps({
            "message": "Creating goal",
            "operation": {
                "create_goal": {
                    "statement": ""  # Empty statement
                }
            }
        })
        
        with pytest.raises(ValueError):
            JSONProtocol.parse_response(invalid_response, "goal")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])