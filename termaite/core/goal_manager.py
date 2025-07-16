"""
Goal management for termaite - handles immutable goal statements.
"""

from typing import Optional
from .session import SessionManager
from ..llm.schemas import JSONProtocol, GoalOperation


class GoalManager:
    """Manages immutable goal statements for termaite sessions."""
    
    def __init__(self, session_manager: SessionManager):
        self.session_manager = session_manager
    
    def has_goal(self) -> bool:
        """Check if current session has a goal statement."""
        session = self.session_manager.get_current_session()
        if session is None:
            return False
        return session.goal_statement is not None
    
    def get_goal(self) -> Optional[str]:
        """Get the current goal statement."""
        session = self.session_manager.get_current_session()
        if session is None:
            return None
        return session.goal_statement
    
    def create_goal(self, llm_response: str) -> str:
        """Create a goal statement from LLM response."""
        if self.has_goal():
            raise ValueError("Goal statement already exists and is immutable")
        
        # Parse and validate the LLM response
        try:
            parsed_response = JSONProtocol.parse_response(llm_response, "goal")
        except Exception as e:
            raise ValueError(f"Invalid goal response: {e}")
        
        # Extract goal statement
        if not isinstance(parsed_response.operation, GoalOperation):
            raise ValueError("Expected goal operation")
        
        goal_statement = parsed_response.operation.create_goal["statement"]
        
        # Validate goal statement
        if not goal_statement or not goal_statement.strip():
            raise ValueError("Goal statement cannot be empty")
        
        # Store the goal in session (immutable)
        self.session_manager.set_goal_statement(goal_statement)
        
        # Add message to session history
        self.session_manager.add_message(
            role="assistant",
            content=parsed_response.message,
            message_type="goal_creation"
        )
        
        return goal_statement
    
    def validate_goal_completion(self, context: str) -> bool:
        """Validate if the goal is completed based on context."""
        goal_statement = self.get_goal()
        if not goal_statement:
            return False
        
        # This is a simple check - in a real implementation,
        # this would involve more sophisticated analysis
        return "task completed" in context.lower() or "goal achieved" in context.lower()
    
    def clear_goal(self) -> None:
        """Clear the goal statement (called when task is completed)."""
        session = self.session_manager.get_current_session()
        if session is None:
            raise ValueError("No active session")
        
        # Clear the goal statement
        session.goal_statement = None
        
        # Save the session
        self.session_manager.save_current_session()
    
    def get_goal_context(self) -> str:
        """Get goal statement formatted for LLM context."""
        goal = self.get_goal()
        if not goal:
            return "No goal statement set."
        
        return f"GOAL STATEMENT: {goal}"
    
    def requires_goal_creation(self) -> bool:
        """Check if a goal needs to be created."""
        return not self.has_goal()
    
    def create_goal_prompt(self, user_input: str) -> str:
        """Create a system prompt for goal creation."""
        context = {
            "user_input": user_input
        }
        
        system_prompt = JSONProtocol.create_system_prompt("goal", context)
        
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
        
        return f"{system_prompt}\n\n{user_prompt}"