"""
JSON protocol schemas for termaite LLM communication.
"""

import json
from typing import Dict, Any, List, Union, Optional
from dataclasses import dataclass
from enum import Enum


class TaskStatus(Enum):
    """Task status enumeration."""
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETE = "COMPLETE"


class PlanAction(Enum):
    """Plan action enumeration."""
    INSERT = "INSERT"
    EDIT = "EDIT"
    DELETE = "DELETE"


@dataclass
class GoalOperation:
    """Goal creation operation."""
    create_goal: Dict[str, str]


@dataclass
class TaskStatusOperation:
    """Task status determination operation."""
    determine_task_status: str


@dataclass
class PlanStep:
    """Plan step definition."""
    step: int
    action: str
    description: str


@dataclass
class PlanOperation:
    """Plan management operation."""
    manage_plan: List[PlanStep]


@dataclass
class BashOperation:
    """Bash command operation."""
    invoke_bash_command: Dict[str, str]


@dataclass
class LLMResponse:
    """LLM response structure."""
    message: str
    operation: Union[GoalOperation, TaskStatusOperation, PlanOperation, BashOperation]


class JSONProtocol:
    """Handles JSON protocol validation and parsing."""
    
    @staticmethod
    def validate_json(response: str) -> Dict[str, Any]:
        """Validate that response is valid JSON."""
        try:
            return json.loads(response)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON response: {e}")
    
    @staticmethod
    def validate_goal_response(data: Dict[str, Any]) -> LLMResponse:
        """Validate goal creation response."""
        if "message" not in data:
            raise ValueError("Missing 'message' field in response")
        
        if "operation" not in data:
            raise ValueError("Missing 'operation' field in response")
        
        operation = data["operation"]
        if "create_goal" not in operation:
            raise ValueError("Missing 'create_goal' in operation")
        
        goal_data = operation["create_goal"]
        if "statement" not in goal_data:
            raise ValueError("Missing 'statement' in create_goal")
        
        if not isinstance(goal_data["statement"], str) or not goal_data["statement"].strip():
            raise ValueError("Goal statement must be a non-empty string")
        
        return LLMResponse(
            message=data["message"],
            operation=GoalOperation(create_goal=goal_data)
        )
    
    @staticmethod
    def validate_task_status_response(data: Dict[str, Any]) -> LLMResponse:
        """Validate task status response."""
        if "message" not in data:
            raise ValueError("Missing 'message' field in response")
        
        if "operation" not in data:
            raise ValueError("Missing 'operation' field in response")
        
        operation = data["operation"]
        if "determine_task_status" not in operation:
            raise ValueError("Missing 'determine_task_status' in operation")
        
        status = operation["determine_task_status"]
        if status not in [TaskStatus.IN_PROGRESS.value, TaskStatus.COMPLETE.value]:
            raise ValueError(f"Invalid task status: {status}. Must be IN_PROGRESS or COMPLETE")
        
        return LLMResponse(
            message=data["message"],
            operation=TaskStatusOperation(determine_task_status=status)
        )
    
    @staticmethod
    def validate_plan_response(data: Dict[str, Any]) -> LLMResponse:
        """Validate plan management response."""
        if "message" not in data:
            raise ValueError("Missing 'message' field in response")
        
        if "operation" not in data:
            raise ValueError("Missing 'operation' field in response")
        
        operation = data["operation"]
        if "manage_plan" not in operation:
            raise ValueError("Missing 'manage_plan' in operation")
        
        plan_data = operation["manage_plan"]
        if not isinstance(plan_data, list):
            raise ValueError("manage_plan must be a list")
        
        steps = []
        for item in plan_data:
            if not isinstance(item, dict):
                raise ValueError("Each plan item must be a dictionary")
            
            required_fields = ["step", "action", "description"]
            for field in required_fields:
                if field not in item:
                    raise ValueError(f"Missing '{field}' in plan item")
            
            if not isinstance(item["step"], int) or item["step"] < 1:
                raise ValueError("Step number must be a positive integer")
            
            if item["action"] not in [PlanAction.INSERT.value, PlanAction.EDIT.value, PlanAction.DELETE.value]:
                raise ValueError(f"Invalid action: {item['action']}. Must be INSERT, EDIT, or DELETE")
            
            if not isinstance(item["description"], str) or not item["description"].strip():
                raise ValueError("Description must be a non-empty string")
            
            steps.append(PlanStep(
                step=item["step"],
                action=item["action"],
                description=item["description"]
            ))
        
        return LLMResponse(
            message=data["message"],
            operation=PlanOperation(manage_plan=steps)
        )
    
    @staticmethod
    def validate_bash_response(data: Dict[str, Any]) -> LLMResponse:
        """Validate bash command response."""
        if "message" not in data:
            raise ValueError("Missing 'message' field in response")
        
        if "operation" not in data:
            raise ValueError("Missing 'operation' field in response")
        
        operation = data["operation"]
        if "invoke_bash_command" not in operation:
            raise ValueError("Missing 'invoke_bash_command' in operation")
        
        bash_data = operation["invoke_bash_command"]
        if "command" not in bash_data:
            raise ValueError("Missing 'command' in invoke_bash_command")
        
        if not isinstance(bash_data["command"], str) or not bash_data["command"].strip():
            raise ValueError("Command must be a non-empty string")
        
        return LLMResponse(
            message=data["message"],
            operation=BashOperation(invoke_bash_command=bash_data)
        )
    
    @staticmethod
    def parse_response(response: str, expected_type: str) -> LLMResponse:
        """Parse and validate LLM response based on expected type."""
        data = JSONProtocol.validate_json(response)
        
        if expected_type == "goal":
            return JSONProtocol.validate_goal_response(data)
        elif expected_type == "task_status":
            return JSONProtocol.validate_task_status_response(data)
        elif expected_type == "plan":
            return JSONProtocol.validate_plan_response(data)
        elif expected_type == "bash":
            return JSONProtocol.validate_bash_response(data)
        else:
            raise ValueError(f"Unknown response type: {expected_type}")
    
    @staticmethod
    def create_system_prompt(prompt_type: str, context: Optional[Dict[str, Any]] = None) -> str:
        """Create system prompt based on type."""
        base_instruction = """You must respond ONLY in JSON format. Do not include any text outside the JSON structure."""
        
        if prompt_type == "goal":
            return f"""{base_instruction}

You are tasked with creating a goal statement for the user's request. The goal should be:
- Factual and testable
- Specific and measurable
- Achievable within the project context

Respond with this JSON structure:
{{
    "message": "User-facing message about creating the goal",
    "operation": {{
        "create_goal": {{
            "statement": "Factual goal statement"
        }}
    }}
}}"""
        
        elif prompt_type == "task_status":
            goal_statement = context.get("goal_statement", "") if context else ""
            return f"""{base_instruction}

You are tasked with determining if the current task is complete based on the goal statement.
Be adversarial and scrutinizing - only mark as COMPLETE if the goal is truly satisfied.

Goal Statement: {goal_statement}

Respond with this JSON structure:
{{
    "message": "Status assessment message",
    "operation": {{
        "determine_task_status": "IN_PROGRESS"
    }}
}}

Status must be either "IN_PROGRESS" or "COMPLETE"."""
        
        elif prompt_type == "plan":
            goal_statement = context.get("goal_statement", "") if context else ""
            current_plan = context.get("current_plan", []) if context else []
            return f"""{base_instruction}

You are tasked with creating or updating a granular plan to achieve the goal.
Each step must be exactly one bash command. Be specific and iterative.

Goal Statement: {goal_statement}
Current Plan: {current_plan}

Respond with this JSON structure:
{{
    "message": "Plan modification explanation",
    "operation": {{
        "manage_plan": [
            {{
                "step": 1,
                "action": "INSERT",
                "description": "Step description"
            }}
        ]
    }}
}}

Actions: INSERT, EDIT, DELETE"""
        
        elif prompt_type == "bash":
            current_step = context.get("current_step", "") if context else ""
            return f"""{base_instruction}

You are tasked with executing a bash command to complete the current step.
Use only NON-TUI bash commands. No interactive applications allowed.

Current Step: {current_step}

Respond with this JSON structure:
{{
    "message": "Command explanation",
    "operation": {{
        "invoke_bash_command": {{
            "command": "bash command to execute"
        }}
    }}
}}"""
        
        else:
            raise ValueError(f"Unknown prompt type: {prompt_type}")