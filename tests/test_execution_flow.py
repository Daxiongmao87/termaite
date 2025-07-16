"""
Comprehensive tests for the 6-step execution flow and JSON protocols.
"""

import pytest
import json
from unittest.mock import Mock, patch, MagicMock
from termaite.llm.schemas import JSONProtocol, JSONResponse, TaskStatus
from termaite.core.goal_manager import GoalManager
from termaite.core.plan_manager import PlanManager
from termaite.core.session import SessionManager, SessionMessage


class TestJSONProtocol:
    """Test JSON protocol validation and parsing."""
    
    def test_valid_goal_response(self):
        """Test valid goal response parsing."""
        response_json = '''
        {
            "message": "I need to create a goal statement for this task",
            "operation": {
                "create_goal": {
                    "statement": "Find all Python files in the current directory"
                }
            }
        }
        '''
        
        parsed = JSONProtocol.parse_response(response_json, "goal")
        assert parsed.message == "I need to create a goal statement for this task"
        assert parsed.operation.create_goal["statement"] == "Find all Python files in the current directory"
    
    def test_valid_task_status_response(self):
        """Test valid task status response parsing."""
        response_json = '''
        {
            "message": "Based on the current state, the task is in progress",
            "operation": {
                "determine_task_status": "IN_PROGRESS"
            }
        }
        '''
        
        parsed = JSONProtocol.parse_response(response_json, "task_status")
        assert parsed.message == "Based on the current state, the task is in progress"
        assert parsed.operation.determine_task_status == "IN_PROGRESS"
    
    def test_valid_plan_response(self):
        """Test valid plan response parsing."""
        response_json = '''
        {
            "message": "Creating plan to accomplish the goal",
            "operation": {
                "manage_plan": [
                    {
                        "step": 1,
                        "action": "INSERT",
                        "description": "List directory contents"
                    },
                    {
                        "step": 2,
                        "action": "INSERT", 
                        "description": "Filter for Python files"
                    }
                ]
            }
        }
        '''
        
        parsed = JSONProtocol.parse_response(response_json, "plan")
        assert parsed.message == "Creating plan to accomplish the goal"
        assert len(parsed.operation.manage_plan) == 2
        assert parsed.operation.manage_plan[0]["action"] == "INSERT"
        assert parsed.operation.manage_plan[1]["description"] == "Filter for Python files"
    
    def test_valid_bash_response(self):
        """Test valid bash response parsing."""
        response_json = '''
        {
            "message": "Executing command to list directory",
            "operation": {
                "invoke_bash_command": {
                    "command": "find . -name '*.py'"
                }
            }
        }
        '''
        
        parsed = JSONProtocol.parse_response(response_json, "bash")
        assert parsed.message == "Executing command to list directory"
        assert parsed.operation.invoke_bash_command["command"] == "find . -name '*.py'"
    
    def test_invalid_json_format(self):
        """Test invalid JSON format handling."""
        invalid_json = "{ invalid json format"
        
        with pytest.raises(ValueError, match="Invalid JSON"):
            JSONProtocol.parse_response(invalid_json, "goal")
    
    def test_missing_required_fields(self):
        """Test missing required fields handling."""
        # Missing message field
        response_json = '''
        {
            "operation": {
                "create_goal": {
                    "statement": "Test goal"
                }
            }
        }
        '''
        
        with pytest.raises(ValueError, match="Missing required field"):
            JSONProtocol.parse_response(response_json, "goal")
        
        # Missing operation field
        response_json = '''
        {
            "message": "Test message"
        }
        '''
        
        with pytest.raises(ValueError, match="Missing required field"):
            JSONProtocol.parse_response(response_json, "goal")
    
    def test_invalid_task_status(self):
        """Test invalid task status values."""
        response_json = '''
        {
            "message": "Test message",
            "operation": {
                "determine_task_status": "INVALID_STATUS"
            }
        }
        '''
        
        with pytest.raises(ValueError, match="Invalid task status"):
            JSONProtocol.parse_response(response_json, "task_status")
    
    def test_invalid_plan_action(self):
        """Test invalid plan action values."""
        response_json = '''
        {
            "message": "Test message",
            "operation": {
                "manage_plan": [
                    {
                        "step": 1,
                        "action": "INVALID_ACTION",
                        "description": "Test step"
                    }
                ]
            }
        }
        '''
        
        with pytest.raises(ValueError, match="Invalid plan action"):
            JSONProtocol.parse_response(response_json, "plan")
    
    def test_system_prompt_generation(self):
        """Test system prompt generation for different operations."""
        # Goal creation prompt
        goal_prompt = JSONProtocol.create_system_prompt("goal")
        assert "goal statement" in goal_prompt.lower()
        assert "json format" in goal_prompt.lower()
        
        # Task status prompt
        status_prompt = JSONProtocol.create_system_prompt("task_status", {"goal_statement": "Test goal"})
        assert "test goal" in status_prompt.lower()
        assert "adversarial" in status_prompt.lower()
        
        # Plan management prompt
        plan_prompt = JSONProtocol.create_system_prompt("plan", {"goal_statement": "Test goal", "current_plan": []})
        assert "plan" in plan_prompt.lower()
        assert "bash command" in plan_prompt.lower()
        
        # Bash command prompt
        bash_prompt = JSONProtocol.create_system_prompt("bash", {"current_step": "Test step"})
        assert "test step" in bash_prompt.lower()
        assert "tui" in bash_prompt.lower()


class TestGoalManager:
    """Test goal management functionality."""
    
    @pytest.fixture
    def session_manager(self):
        """Create mock session manager."""
        session_manager = Mock()
        session_manager.get_current_session.return_value = Mock()
        session_manager.get_current_session.return_value.goal_statement = None
        return session_manager
    
    def test_goal_creation(self, session_manager):
        """Test goal creation."""
        goal_manager = GoalManager(session_manager)
        
        response_json = '''
        {
            "message": "Creating goal statement",
            "operation": {
                "create_goal": {
                    "statement": "Test goal statement"
                }
            }
        }
        '''
        
        goal = goal_manager.create_goal(response_json)
        assert goal == "Test goal statement"
        assert goal_manager.has_goal()
    
    def test_goal_immutability(self, session_manager):
        """Test that goals cannot be changed after creation."""
        goal_manager = GoalManager(session_manager)
        
        # Create initial goal
        response_json = '''
        {
            "message": "Creating goal statement",
            "operation": {
                "create_goal": {
                    "statement": "Original goal"
                }
            }
        }
        '''
        
        goal_manager.create_goal(response_json)
        
        # Attempt to create another goal
        new_response_json = '''
        {
            "message": "Creating goal statement",
            "operation": {
                "create_goal": {
                    "statement": "New goal"
                }
            }
        }
        '''
        
        with pytest.raises(ValueError, match="Goal already exists"):
            goal_manager.create_goal(new_response_json)
    
    def test_goal_clearing(self, session_manager):
        """Test goal clearing after completion."""
        goal_manager = GoalManager(session_manager)
        
        # Create goal
        response_json = '''
        {
            "message": "Creating goal statement",
            "operation": {
                "create_goal": {
                    "statement": "Test goal"
                }
            }
        }
        '''
        
        goal_manager.create_goal(response_json)
        assert goal_manager.has_goal()
        
        # Clear goal
        goal_manager.clear_goal()
        assert not goal_manager.has_goal()


class TestPlanManager:
    """Test plan management functionality."""
    
    @pytest.fixture
    def session_manager(self):
        """Create mock session manager."""
        session_manager = Mock()
        session_manager.get_current_session.return_value = Mock()
        session_manager.get_current_session.return_value.current_plan = []
        return session_manager
    
    def test_plan_creation(self, session_manager):
        """Test plan creation."""
        plan_manager = PlanManager(session_manager)
        
        response_json = '''
        {
            "message": "Creating plan",
            "operation": {
                "manage_plan": [
                    {
                        "step": 1,
                        "action": "INSERT",
                        "description": "First step"
                    },
                    {
                        "step": 2,
                        "action": "INSERT",
                        "description": "Second step"
                    }
                ]
            }
        }
        '''
        
        plan = plan_manager.create_plan(response_json)
        assert len(plan) == 2
        assert plan[0]["description"] == "First step"
        assert plan[1]["description"] == "Second step"
        assert plan_manager.has_plan()
    
    def test_plan_updates(self, session_manager):
        """Test plan updates and modifications."""
        plan_manager = PlanManager(session_manager)
        
        # Create initial plan
        initial_response = '''
        {
            "message": "Creating plan",
            "operation": {
                "manage_plan": [
                    {
                        "step": 1,
                        "action": "INSERT",
                        "description": "First step"
                    }
                ]
            }
        }
        '''
        
        plan_manager.create_plan(initial_response)
        
        # Update plan
        update_response = '''
        {
            "message": "Updating plan",
            "operation": {
                "manage_plan": [
                    {
                        "step": 2,
                        "action": "INSERT",
                        "description": "New second step"
                    },
                    {
                        "step": 1,
                        "action": "EDIT",
                        "description": "Updated first step"
                    }
                ]
            }
        }
        '''
        
        plan_manager.update_plan(update_response)
        plan = plan_manager.get_plan()
        
        # Check that plan was updated
        assert len(plan) >= 2
        assert any(step["description"] == "Updated first step" for step in plan)
    
    def test_current_step_retrieval(self, session_manager):
        """Test current step retrieval."""
        plan_manager = PlanManager(session_manager)
        
        # Create plan
        response_json = '''
        {
            "message": "Creating plan",
            "operation": {
                "manage_plan": [
                    {
                        "step": 1,
                        "action": "INSERT",
                        "description": "First step"
                    },
                    {
                        "step": 2,
                        "action": "INSERT",
                        "description": "Second step"
                    }
                ]
            }
        }
        '''
        
        plan_manager.create_plan(response_json)
        
        # Get current step (should be first incomplete step)
        current_step = plan_manager.get_current_step()
        assert current_step is not None
        assert current_step["step"] == 1
        assert current_step["description"] == "First step"
    
    def test_step_completion(self, session_manager):
        """Test step completion marking."""
        plan_manager = PlanManager(session_manager)
        
        # Create plan
        response_json = '''
        {
            "message": "Creating plan",
            "operation": {
                "manage_plan": [
                    {
                        "step": 1,
                        "action": "INSERT",
                        "description": "First step"
                    },
                    {
                        "step": 2,
                        "action": "INSERT",
                        "description": "Second step"
                    }
                ]
            }
        }
        '''
        
        plan_manager.create_plan(response_json)
        
        # Mark first step as completed
        plan_manager.mark_step_completed(1)
        
        # Current step should now be step 2
        current_step = plan_manager.get_current_step()
        assert current_step["step"] == 2
        assert current_step["description"] == "Second step"


if __name__ == "__main__":
    pytest.main([__file__])