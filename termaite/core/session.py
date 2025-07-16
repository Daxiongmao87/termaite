"""
Session management for termaite.
"""

import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from ..config.manager import ConfigManager


@dataclass
class SessionMessage:
    """Represents a message in a session."""
    timestamp: str
    role: str  # "user", "assistant", "system"
    content: str
    message_type: str  # "user_input", "llm_response", "command_output", "system_message"


@dataclass
class SessionData:
    """Complete session data."""
    session_id: str
    created_at: str
    last_updated: str
    title: str
    goal_statement: Optional[str]
    current_plan: List[Dict[str, Any]]
    messages: List[SessionMessage]
    is_completed: bool


class SessionManager:
    """Manages termaite sessions with persistence."""
    
    def __init__(self, config_manager: ConfigManager):
        self.config_manager = config_manager
        self.config = config_manager.load_config()
        self.history_dir = Path(self.config.session.history_dir).expanduser()
        self.history_dir.mkdir(parents=True, exist_ok=True)
        self.current_session: Optional[SessionData] = None
    
    def create_new_session(self, title: str = None) -> SessionData:
        """Create a new session."""
        session_id = str(uuid.uuid4())
        timestamp = datetime.now().isoformat()
        
        if title is None:
            title = f"Session {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        
        session = SessionData(
            session_id=session_id,
            created_at=timestamp,
            last_updated=timestamp,
            title=title,
            goal_statement=None,
            current_plan=[],
            messages=[],
            is_completed=False
        )
        
        self.current_session = session
        self.save_session(session)
        return session
    
    def get_current_session(self) -> Optional[SessionData]:
        """Get the current active session."""
        return self.current_session
    
    def load_session(self, session_id: str) -> SessionData:
        """Load a session from storage."""
        session_file = self.history_dir / f"{session_id}.json"
        
        if not session_file.exists():
            raise ValueError(f"Session not found: {session_id}")
        
        try:
            with open(session_file, 'r') as f:
                data = json.load(f)
            
            # Convert message dictionaries back to SessionMessage objects
            messages = [SessionMessage(**msg) for msg in data.get('messages', [])]
            
            session = SessionData(
                session_id=data['session_id'],
                created_at=data['created_at'],
                last_updated=data['last_updated'],
                title=data['title'],
                goal_statement=data.get('goal_statement'),
                current_plan=data.get('current_plan', []),
                messages=messages,
                is_completed=data.get('is_completed', False)
            )
            
            self.current_session = session
            return session
            
        except Exception as e:
            raise ValueError(f"Error loading session {session_id}: {e}")
    
    def save_session(self, session: SessionData = None) -> None:
        """Save a session to storage."""
        if session is None:
            session = self.current_session
        
        if session is None:
            raise ValueError("No session to save")
        
        session.last_updated = datetime.now().isoformat()
        
        session_file = self.history_dir / f"{session.session_id}.json"
        
        # Convert SessionMessage objects to dictionaries
        session_dict = asdict(session)
        
        try:
            with open(session_file, 'w') as f:
                json.dump(session_dict, f, indent=2)
        except Exception as e:
            raise ValueError(f"Error saving session: {e}")
    
    def list_sessions(self) -> List[Dict[str, Any]]:
        """List all available sessions."""
        sessions = []
        
        for session_file in self.history_dir.glob("*.json"):
            try:
                with open(session_file, 'r') as f:
                    data = json.load(f)
                
                sessions.append({
                    'session_id': data['session_id'],
                    'title': data['title'],
                    'created_at': data['created_at'],
                    'last_updated': data['last_updated'],
                    'is_completed': data.get('is_completed', False),
                    'message_count': len(data.get('messages', []))
                })
            except Exception:
                # Skip corrupted session files
                continue
        
        # Sort by last updated (most recent first)
        sessions.sort(key=lambda x: x['last_updated'], reverse=True)
        
        # Limit to max_sessions
        max_sessions = self.config.session.max_sessions
        return sessions[:max_sessions]
    
    def delete_session(self, session_id: str) -> bool:
        """Delete a session."""
        session_file = self.history_dir / f"{session_id}.json"
        
        if not session_file.exists():
            return False
        
        try:
            session_file.unlink()
            
            # If this was the current session, clear it
            if self.current_session and self.current_session.session_id == session_id:
                self.current_session = None
            
            return True
        except Exception:
            return False
    
    def add_message(self, role: str, content: str, message_type: str) -> None:
        """Add a message to the current session."""
        if self.current_session is None:
            raise ValueError("No active session")
        
        message = SessionMessage(
            timestamp=datetime.now().isoformat(),
            role=role,
            content=content,
            message_type=message_type
        )
        
        self.current_session.messages.append(message)
        self.save_session()
    
    def set_goal_statement(self, goal_statement: str) -> None:
        """Set the goal statement for the current session (immutable once set)."""
        if self.current_session is None:
            raise ValueError("No active session")
        
        if self.current_session.goal_statement is not None:
            raise ValueError("Goal statement is immutable once set")
        
        self.current_session.goal_statement = goal_statement
        self.save_session()
    
    def update_plan(self, plan: List[Dict[str, Any]]) -> None:
        """Update the current plan."""
        if self.current_session is None:
            raise ValueError("No active session")
        
        self.current_session.current_plan = plan
        self.save_session()
    
    def mark_completed(self) -> None:
        """Mark the current session as completed."""
        if self.current_session is None:
            raise ValueError("No active session")
        
        self.current_session.is_completed = True
        # Clear goal statement when task is completed
        self.current_session.goal_statement = None
        self.save_session()
    
    def get_user_view_history(self) -> List[SessionMessage]:
        """Get complete word-for-word history for user view."""
        if self.current_session is None:
            return []
        
        return self.current_session.messages.copy()
    
    def get_agent_view_history(self) -> List[SessionMessage]:
        """Get potentially compacted history for agent view."""
        # For now, return the same as user view
        # Context compaction will be implemented later
        return self.get_user_view_history()
    
    def clean_old_sessions(self) -> int:
        """Remove old sessions beyond max_sessions limit."""
        sessions = self.list_sessions()
        max_sessions = self.config.session.max_sessions
        
        if len(sessions) <= max_sessions:
            return 0
        
        # Delete oldest sessions
        sessions_to_delete = sessions[max_sessions:]
        deleted_count = 0
        
        for session in sessions_to_delete:
            if self.delete_session(session['session_id']):
                deleted_count += 1
        
        return deleted_count