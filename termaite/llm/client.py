"""
LLM client for termaite with JSON-only communication.
"""

import json
import requests
from typing import Dict, List, Any, Optional
from ..config.manager import ConfigManager
from .schemas import JSONProtocol
from pathlib import Path


class LLMClient:
    """Handles communication with LLM using OpenAI-compatible API."""
    
    def __init__(self, config_manager: ConfigManager):
        self.config_manager = config_manager
        self.config = config_manager.load_config()
        self.base_url = self.config.llm.endpoint.rstrip('/')
        self.model = self.config.llm.model
        self.context_window = self.config.llm.context_window
    
    def _enhance_system_prompt(self, base_prompt: str) -> str:
        """Enhance system prompt with project context if available."""
        project_context = self._get_project_context()
        return base_prompt + project_context
    
    def _get_project_context(self) -> str:
        """Get project context from .TERMAITE.md file if it exists."""
        try:
            context_file = Path(".") / ".TERMAITE.md"
            if context_file.exists():
                with open(context_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                    return f"\n\n# PROJECT CONTEXT\n\n{content}\n\n"
            return ""
        except Exception:
            return ""
    
    def _make_request(self, messages: List[Dict[str, str]], temperature: float = 0.1) -> str:
        """Make a request to the LLM API."""
        headers = {
            'Content-Type': 'application/json',
        }
        
        # Add Authorization header if API key is available
        api_key = self.config.llm.model.get('api_key') if hasattr(self.config.llm, 'api_key') else None
        if api_key:
            headers['Authorization'] = f'Bearer {api_key}'
        
        data = {
            'model': self.model,
            'messages': messages,
            'temperature': temperature,
            'max_tokens': min(1000, self.context_window // 4),  # Conservative limit
            'stream': False
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=data,
                timeout=30
            )
            
            if response.status_code != 200:
                raise Exception(f"API request failed with status {response.status_code}: {response.text}")
            
            result = response.json()
            
            if 'choices' not in result or not result['choices']:
                raise Exception("No choices in API response")
            
            return result['choices'][0]['message']['content']
            
        except requests.RequestException as e:
            raise Exception(f"Request failed: {e}")
        except json.JSONDecodeError as e:
            raise Exception(f"Invalid JSON response: {e}")
        except Exception as e:
            raise Exception(f"LLM request failed: {e}")
    
    def create_goal(self, user_input: str) -> str:
        """Create a goal statement from user input."""
        system_prompt = JSONProtocol.create_system_prompt("goal")
        
        user_prompt = f"""
Based on the following user request, create a clear, factual, and testable goal statement:

User Request: {user_input}

Create a goal statement that:
1. Is specific and measurable
2. Can be verified as complete or incomplete
3. Focuses on the end result, not the process
4. Is achievable within the project context

Remember: The goal statement will be used to determine when the task is complete.
"""
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        response = self._make_request(messages)
        
        # Validate response format
        try:
            JSONProtocol.parse_response(response, "goal")
        except Exception as e:
            raise ValueError(f"Invalid goal response from LLM: {e}")
        
        return response
    
    def determine_task_status(self, goal_statement: str, context: str) -> str:
        """Determine if the task is complete based on goal and context."""
        context_data = {"goal_statement": goal_statement}
        system_prompt = JSONProtocol.create_system_prompt("task_status", context_data)
        
        user_prompt = f"""
Goal Statement: {goal_statement}

Current Context/Output: {context}

Determine if the goal statement is satisfied based on the current context.
Be adversarial and scrutinizing - only mark as COMPLETE if the goal is truly achieved.

Consider:
1. Is the goal statement fully satisfied?
2. Are there any remaining tasks or issues?
3. Has the desired outcome been achieved?
4. Is there evidence that the goal is met?
"""
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        response = self._make_request(messages)
        
        # Validate response format
        try:
            JSONProtocol.parse_response(response, "task_status")
        except Exception as e:
            raise ValueError(f"Invalid task status response from LLM: {e}")
        
        return response
    
    def create_plan(self, goal_statement: str, context: str = "") -> str:
        """Create a plan to achieve the goal."""
        context_data = {
            "goal_statement": goal_statement,
            "current_plan": [],
            "context": context
        }
        system_prompt = JSONProtocol.create_system_prompt("plan", context_data)
        
        user_prompt = f"""
Goal Statement: {goal_statement}

Context: {context}

Create a granular plan to achieve the goal. Each step must be exactly one bash command that can be executed independently.

Requirements:
1. Each step must be a single bash command
2. Steps should be specific and actionable
3. Consider the current working directory and project structure
4. Avoid TUI or interactive commands
5. Build steps logically toward the goal
6. Start with information gathering if needed
"""
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        response = self._make_request(messages)
        
        # Validate response format
        try:
            JSONProtocol.parse_response(response, "plan")
        except Exception as e:
            raise ValueError(f"Invalid plan response from LLM: {e}")
        
        return response
    
    def update_plan(self, goal_statement: str, current_plan: List[Dict[str, Any]], context: str) -> str:
        """Update the current plan based on new context."""
        context_data = {
            "goal_statement": goal_statement,
            "current_plan": current_plan,
            "context": context
        }
        system_prompt = JSONProtocol.create_system_prompt("plan", context_data)
        
        user_prompt = f"""
Goal Statement: {goal_statement}

Current Plan: {json.dumps(current_plan, indent=2)}

Latest Context/Output: {context}

Update the plan based on the latest context. Consider:
1. Are the remaining steps still appropriate?
2. Do we need to add new steps?
3. Should any steps be modified or removed?
4. Are we on track to achieve the goal?

Each step must still be exactly one bash command.
"""
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        response = self._make_request(messages)
        
        # Validate response format
        try:
            JSONProtocol.parse_response(response, "plan")
        except Exception as e:
            raise ValueError(f"Invalid plan update response from LLM: {e}")
        
        return response
    
    def get_bash_command(self, current_step: Dict[str, Any], context: str = "") -> str:
        """Get the bash command for the current step."""
        step_description = current_step.get("description", "")
        context_data = {"current_step": step_description}
        system_prompt = JSONProtocol.create_system_prompt("bash", context_data)
        
        user_prompt = f"""
Current Step: {step_description}

Context: {context}

Provide the bash command to execute this step. Requirements:
1. Must be a single bash command
2. No TUI or interactive commands
3. No commands requiring user input
4. Consider the current working directory
5. Use absolute paths when necessary
6. Be specific and precise
"""
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        response = self._make_request(messages)
        
        # Validate response format
        try:
            JSONProtocol.parse_response(response, "bash")
        except Exception as e:
            raise ValueError(f"Invalid bash command response from LLM: {e}")
        
        return response
    
    def get_available_models(self) -> List[str]:
        """Get list of available models from the API."""
        try:
            response = requests.get(
                f"{self.base_url}/models",
                timeout=10
            )
            
            if response.status_code != 200:
                raise Exception(f"Failed to get models: {response.status_code}")
            
            data = response.json()
            
            if 'data' not in data:
                return [self.model]  # Return current model as fallback
            
            return [model['id'] for model in data['data']]
            
        except Exception:
            return [self.model]  # Return current model as fallback
    
    def test_connection(self) -> bool:
        """Test connection to the LLM API with timeout."""
        try:
            messages = [
                {"role": "user", "content": "Hello"}
            ]
            
            self._make_request(messages)
            return True
            
        except Exception:
            return False
    
    def is_available(self) -> bool:
        """Quick check if LLM is available without blocking."""
        try:
            import requests
            response = requests.get(f"{self.base_url}/models", timeout=2)
            return response.status_code == 200
        except Exception:
            return False
    
    def create_goal_with_system_prompt(self, user_input: str) -> str:
        """Create a goal statement using dedicated goal system prompt."""
        base_prompt = """You are a goal statement creator. Your role is to create accurate and testable goal statements.

CRITICAL INSTRUCTIONS:
- Create factual, specific goal statements that can be objectively verified
- Focus on what needs to be accomplished, not how to accomplish it
- Make goals measurable and concrete
- Avoid vague or subjective language
- You MUST respond ONLY in JSON format using the create_goal schema

Your goal is to provide an accurate and testable goal statement to satisfy the user's prompt."""
        
        system_prompt = self._enhance_system_prompt(base_prompt)
        
        user_prompt = f"""
User Request: {user_input}

Create a clear, specific, and testable goal statement for this request.

Example format:
- "Create a Python script that prints 'Hello World' to the console"
- "List all files in the current directory"
- "Install the requests package using pip"

The goal should be factual and verifiable when completed.
"""
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        response = self._make_request(messages)
        
        # Validate response format
        try:
            JSONProtocol.parse_response(response, "goal")
        except Exception as e:
            raise ValueError(f"Invalid goal response from LLM: {e}")
        
        return response
    
    def create_plan_with_system_prompt(self, goal_statement: str, context: str = "") -> str:
        """Create a plan using dedicated plan system prompt."""
        base_prompt = """You are a plan management specialist. Your role is to create granular and iterative step-by-step plans.

CRITICAL INSTRUCTIONS:
- Each step must be exactly ONE bash command
- Steps must be specific and actionable
- If no plan exists, create a comprehensive plan
- If a plan exists, verify alignment with command output and make adjustments
- Seek out information for better strategic decisions
- Change commands based on new information
- You MUST respond ONLY in JSON format using the manage_plan schema

Your goal is to create granular and iterative step-by-step plans to accomplish the goal statement."""
        
        system_prompt = self._enhance_system_prompt(base_prompt)
        
        user_prompt = f"""
Goal Statement: {goal_statement}

Context: {context}

Create a granular plan to achieve the goal. Each step must be exactly one bash command that can be executed independently.

Requirements:
1. Each step must be a single bash command
2. Steps should be specific and actionable
3. Consider the current working directory and project structure
4. Avoid TUI or interactive commands
5. Build steps logically toward the goal
6. Start with information gathering if needed
"""
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        response = self._make_request(messages)
        
        # Validate response format
        try:
            JSONProtocol.parse_response(response, "plan")
        except Exception as e:
            raise ValueError(f"Invalid plan response from LLM: {e}")
        
        return response
    
    def determine_task_status_with_system_prompt(self, goal_statement: str, context: str) -> str:
        """Determine task status using dedicated adversarial system prompt."""
        base_prompt = """You are a task completion evaluator with adversarial and scrutinizing behavior.

CRITICAL INSTRUCTIONS:
- Your job is to determine if the goal statement is satisfied with ABSOLUTELY NO EXCUSES
- Be highly critical and demanding
- Only mark as COMPLETE if the goal is truly and completely achieved
- Look for any remaining issues or incomplete work
- Demand evidence that the goal is met
- You MUST respond ONLY in JSON format using the determine_task_status schema

Your behavior should be adversarial and scrutinizing to determine if the goal statement is satisfied, with absolutely no excuses."""
        
        system_prompt = self._enhance_system_prompt(base_prompt)
        
        user_prompt = f"""
Goal Statement: {goal_statement}

Current Context/Output: {context}

Determine if the goal statement is satisfied based on the current context.
Be adversarial and scrutinizing - only mark as COMPLETE if the goal is truly achieved.

Consider:
1. Is the goal statement fully satisfied?
2. Are there any remaining tasks or issues?
3. Has the desired outcome been achieved?
4. Is there evidence that the goal is met?

Status must be either "IN_PROGRESS" or "COMPLETE".
"""
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        response = self._make_request(messages)
        
        # Validate response format
        try:
            JSONProtocol.parse_response(response, "task_status")
        except Exception as e:
            raise ValueError(f"Invalid task status response from LLM: {e}")
        
        return response
    
    def manage_plan_with_system_prompt(self, goal_statement: str, current_plan: List[Dict[str, Any]], context: str) -> str:
        """Manage plan using dedicated plan management system prompt."""
        base_prompt = """You are a plan management specialist focused on dynamic plan adjustment.

CRITICAL INSTRUCTIONS:
- Verify alignment of plan's next steps with output of previous commands
- Make adjustments based on new information
- Seek out more information for better strategic decisions
- Change commands based on new information
- Each step must still be exactly ONE bash command
- You MUST respond ONLY in JSON format using the manage_plan schema

Your goal is to verify the alignment of the plan's next steps with the output of the previous commands and make adjustments accordingly."""
        
        system_prompt = self._enhance_system_prompt(base_prompt)
        
        user_prompt = f"""
Goal Statement: {goal_statement}

Current Plan: {json.dumps(current_plan, indent=2)}

Latest Context/Output: {context}

Update the plan based on the latest context. Consider:
1. Are the remaining steps still appropriate?
2. Do we need to add new steps?
3. Should any steps be modified or removed?
4. Are we on track to achieve the goal?

Each step must still be exactly one bash command.
"""
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        response = self._make_request(messages)
        
        # Validate response format
        try:
            JSONProtocol.parse_response(response, "plan")
        except Exception as e:
            raise ValueError(f"Invalid plan response from LLM: {e}")
        
        return response
    
    def get_bash_command_with_system_prompt(self, current_step: Dict[str, Any]) -> str:
        """Get bash command using dedicated bash command system prompt."""
        base_prompt = """You are a bash command executor specialist.

CRITICAL INSTRUCTIONS:
- Use all NON-TUI bash commands
- It is FORBIDDEN to use TUI-based commands
- NO interactive applications that require user confirmation
- NO user intervention allowed
- Focus on automation and scriptable commands
- You MUST respond ONLY in JSON format using the invoke_bash_command schema

Your goal is to use all **NON-TUI** bash commands. It is forbidden to use TUI-based commands and goes against the agentic intent of this application."""
        
        system_prompt = self._enhance_system_prompt(base_prompt)
        
        user_prompt = f"""
Current Step: {current_step['description']}

Provide the exact bash command needed to accomplish this step.

Requirements:
1. Must be a single bash command
2. No TUI or interactive commands
3. No user input required
4. Must be executable in current directory
5. Should be safe and non-destructive when possible

Command should directly accomplish the step described.
"""
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        response = self._make_request(messages)
        
        # Validate response format
        try:
            JSONProtocol.parse_response(response, "bash")
        except Exception as e:
            raise ValueError(f"Invalid bash command response from LLM: {e}")
        
        return response