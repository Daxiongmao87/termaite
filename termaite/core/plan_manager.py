"""
Plan management for termaite - handles granular, mutable plans.
"""

from typing import List, Dict, Any, Optional
from .session import SessionManager
from ..llm.schemas import JSONProtocol, PlanOperation, PlanStep, PlanAction


class PlanManager:
    """Manages granular plans for termaite sessions."""
    
    def __init__(self, session_manager: SessionManager):
        self.session_manager = session_manager
    
    def has_plan(self) -> bool:
        """Check if current session has a plan."""
        session = self.session_manager.get_current_session()
        if session is None:
            return False
        return len(session.current_plan) > 0
    
    def get_plan(self) -> List[Dict[str, Any]]:
        """Get the current plan."""
        session = self.session_manager.get_current_session()
        if session is None:
            return []
        return session.current_plan.copy()
    
    def create_plan(self, llm_response: str) -> List[Dict[str, Any]]:
        """Create a plan from LLM response."""
        # Parse and validate the LLM response
        try:
            parsed_response = JSONProtocol.parse_response(llm_response, "plan")
        except Exception as e:
            raise ValueError(f"Invalid plan response: {e}")
        
        # Extract plan operations
        if not isinstance(parsed_response.operation, PlanOperation):
            raise ValueError("Expected plan operation")
        
        plan_steps = parsed_response.operation.manage_plan
        
        # Validate and convert plan steps
        validated_plan = []
        for step in plan_steps:
            self._validate_plan_step(step)
            validated_plan.append({
                "step": step.step,
                "action": step.action,
                "description": step.description,
                "completed": False
            })
        
        # Sort by step number
        validated_plan.sort(key=lambda x: x["step"])
        
        # Update session with new plan
        self.session_manager.update_plan(validated_plan)
        
        # Add message to session history
        self.session_manager.add_message(
            role="assistant",
            content=parsed_response.message,
            message_type="plan_creation"
        )
        
        return validated_plan
    
    def update_plan(self, llm_response: str) -> List[Dict[str, Any]]:
        """Update the current plan from LLM response."""
        current_plan = self.get_plan()
        
        # Parse and validate the LLM response
        try:
            parsed_response = JSONProtocol.parse_response(llm_response, "plan")
        except Exception as e:
            raise ValueError(f"Invalid plan response: {e}")
        
        # Extract plan operations
        if not isinstance(parsed_response.operation, PlanOperation):
            raise ValueError("Expected plan operation")
        
        plan_steps = parsed_response.operation.manage_plan
        
        # Apply plan modifications
        updated_plan = current_plan.copy()
        
        for step in plan_steps:
            self._validate_plan_step(step)
            self._apply_plan_modification(updated_plan, step)
        
        # Sort by step number and renumber
        updated_plan.sort(key=lambda x: x["step"])
        for i, step in enumerate(updated_plan):
            step["step"] = i + 1
        
        # Update session with modified plan
        self.session_manager.update_plan(updated_plan)
        
        # Add message to session history
        self.session_manager.add_message(
            role="assistant",
            content=parsed_response.message,
            message_type="plan_update"
        )
        
        return updated_plan
    
    def _validate_plan_step(self, step: PlanStep) -> None:
        """Validate a plan step."""
        if step.step < 1:
            raise ValueError("Step number must be positive")
        
        if step.action not in [PlanAction.INSERT.value, PlanAction.EDIT.value, PlanAction.DELETE.value]:
            raise ValueError(f"Invalid action: {step.action}")
        
        if not step.description.strip():
            raise ValueError("Step description cannot be empty")
        
        # Validate that each step represents a single bash command
        if not self._is_single_bash_command(step.description):
            raise ValueError(f"Step must be a single bash command: {step.description}")
    
    def _is_single_bash_command(self, description: str) -> bool:
        """Check if description represents a single bash command."""
        # Simple heuristic: should not contain multiple commands
        forbidden_sequences = [' && ', ' || ', ' ; ', '\n', '|', '$(', '`']
        description_lower = description.lower()
        
        # Allow pipe for single command with output processing
        if '|' in description and not any(seq in description for seq in [' && ', ' || ', ' ; ']):
            return True
        
        # Check for forbidden multi-command sequences
        for seq in forbidden_sequences:
            if seq in description:
                return False
        
        return True
    
    def _apply_plan_modification(self, plan: List[Dict[str, Any]], step: PlanStep) -> None:
        """Apply a plan modification to the current plan."""
        if step.action == PlanAction.INSERT.value:
            new_step = {
                "step": step.step,
                "action": step.action,
                "description": step.description,
                "completed": False
            }
            
            # Insert at the specified position
            if step.step <= len(plan):
                plan.insert(step.step - 1, new_step)
            else:
                plan.append(new_step)
        
        elif step.action == PlanAction.EDIT.value:
            # Find and edit the step
            for i, existing_step in enumerate(plan):
                if existing_step["step"] == step.step:
                    plan[i]["description"] = step.description
                    break
        
        elif step.action == PlanAction.DELETE.value:
            # Find and remove the step
            plan[:] = [s for s in plan if s["step"] != step.step]
    
    def get_current_step(self) -> Optional[Dict[str, Any]]:
        """Get the current step to execute."""
        plan = self.get_plan()
        
        for step in plan:
            if not step.get("completed", False):
                return step
        
        return None
    
    def mark_step_completed(self, step_number: int) -> None:
        """Mark a step as completed."""
        plan = self.get_plan()
        
        for step in plan:
            if step["step"] == step_number:
                step["completed"] = True
                break
        
        self.session_manager.update_plan(plan)
    
    def get_remaining_steps(self) -> List[Dict[str, Any]]:
        """Get all remaining (incomplete) steps."""
        plan = self.get_plan()
        return [step for step in plan if not step.get("completed", False)]
    
    def get_plan_summary(self) -> str:
        """Get a summary of the current plan."""
        plan = self.get_plan()
        
        if not plan:
            return "No plan exists."
        
        completed_count = sum(1 for step in plan if step.get("completed", False))
        total_count = len(plan)
        
        summary = [f"Plan Progress: {completed_count}/{total_count} steps completed"]
        
        for step in plan:
            status = "✓" if step.get("completed", False) else "○"
            summary.append(f"{status} Step {step['step']}: {step['description']}")
        
        return "\n".join(summary)
    
    def create_plan_prompt(self, goal_statement: str, context: str = "") -> str:
        """Create a system prompt for plan creation."""
        current_plan = self.get_plan()
        
        context_data = {
            "goal_statement": goal_statement,
            "current_plan": current_plan,
            "context": context
        }
        
        system_prompt = JSONProtocol.create_system_prompt("plan", context_data)
        
        user_prompt = f"""
Goal Statement: {goal_statement}

Current Plan: {self.get_plan_summary()}

Context/Last Output: {context}

{'Create a granular plan' if not current_plan else 'Update the current plan based on the latest context'}. 
Each step must be exactly one bash command that can be executed independently.

Requirements:
1. Each step must be a single bash command
2. Steps should be specific and actionable
3. Consider the current working directory and project structure
4. Avoid TUI or interactive commands
5. Build upon previous steps logically
"""
        
        return f"{system_prompt}\n\n{user_prompt}"