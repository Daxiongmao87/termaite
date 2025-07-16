"""
Context window management and compaction for termaite.
"""

import re
from typing import List, Dict, Any, Tuple
from ..core.session import SessionMessage
from ..config.manager import ConfigManager


class ContextCompactor:
    """Manages context window limits and compaction."""
    
    def __init__(self, config_manager: ConfigManager):
        self.config_manager = config_manager
        self.config = config_manager.load_config()
        self.context_window = self.config.llm.context_window
        self.compaction_threshold = self.config.context.compaction_threshold
        self.compaction_ratio = self.config.context.compaction_ratio
        self.max_output_ratio = self.config.context.max_output_ratio
    
    def estimate_tokens(self, text: str) -> int:
        """Estimate token count for text."""
        # Simple estimation: ~4 characters per token on average
        # This is a rough approximation, real tokenization would be more accurate
        return len(text) // 4
    
    def estimate_message_tokens(self, message: SessionMessage) -> int:
        """Estimate token count for a message."""
        # Include role, timestamp, and content
        total_text = f"{message.role} {message.timestamp} {message.content}"
        return self.estimate_tokens(total_text)
    
    def estimate_session_tokens(self, messages: List[SessionMessage]) -> int:
        """Estimate total token count for a session."""
        return sum(self.estimate_message_tokens(msg) for msg in messages)
    
    def should_compact(self, messages: List[SessionMessage]) -> bool:
        """Check if compaction is needed."""
        current_tokens = self.estimate_session_tokens(messages)
        threshold = self.context_window * self.compaction_threshold
        return current_tokens > threshold
    
    def needs_compaction(self) -> bool:
        """Check if current session needs compaction."""
        # This method requires session manager context
        # For now, implement basic logic - will be called with session context
        return False  # Placeholder - will be overridden by application logic
    
    def compact_messages(self, messages: List[SessionMessage], llm_client) -> List[SessionMessage]:
        """Compact messages by summarizing oldest portion."""
        if not messages:
            return messages
        
        # Calculate how many messages to summarize
        total_messages = len(messages)
        messages_to_summarize = int(total_messages * self.compaction_ratio)
        
        if messages_to_summarize <= 1:
            return messages  # Not enough messages to compact
        
        # Separate messages to summarize and messages to keep
        messages_to_summarize_list = messages[:messages_to_summarize]
        messages_to_keep = messages[messages_to_summarize:]
        
        # Find and preserve the original user prompt
        original_prompt = None
        for msg in messages_to_summarize_list:
            if msg.role == "user" and msg.message_type == "user_input":
                original_prompt = msg
                break
        
        # Create summary of the messages to compress
        summary_content = self._create_summary_content(messages_to_summarize_list)
        
        try:
            # Use LLM to create a summary
            summary_prompt = f"""
Summarize the following session history into a single paragraph. 
Preserve key information, decisions, and outcomes:

{summary_content}

Provide a concise summary that captures the essential context.
"""
            
            summary_response = llm_client._make_request([
                {"role": "user", "content": summary_prompt}
            ])
            
            # Create a summary message
            summary_message = SessionMessage(
                timestamp=messages_to_summarize_list[0].timestamp,
                role="system",
                content=f"[COMPACTED SUMMARY]: {summary_response}",
                message_type="summary"
            )
            
            # Build the compacted message list
            compacted_messages = []
            
            # Add original prompt if found
            if original_prompt:
                compacted_messages.append(original_prompt)
            
            # Add summary
            compacted_messages.append(summary_message)
            
            # Add messages to keep
            compacted_messages.extend(messages_to_keep)
            
            return compacted_messages
            
        except Exception as e:
            # If compaction fails, return original messages
            print(f"Warning: Compaction failed: {e}")
            return messages
    
    def _create_summary_content(self, messages: List[SessionMessage]) -> str:
        """Create content for summarization."""
        content_parts = []
        
        for msg in messages:
            if msg.role == "user":
                content_parts.append(f"User: {msg.content}")
            elif msg.role == "assistant":
                content_parts.append(f"Assistant: {msg.content}")
            elif msg.role == "system":
                if msg.message_type == "command_output":
                    content_parts.append(f"Command Output: {msg.content[:200]}...")
                else:
                    content_parts.append(f"System: {msg.content}")
        
        return "\n".join(content_parts)
    
    def check_output_size(self, output: str) -> bool:
        """Check if output exceeds maximum size."""
        output_tokens = self.estimate_tokens(output)
        max_tokens = self.context_window * self.max_output_ratio
        return output_tokens > max_tokens
    
    def create_defensive_reading_error(self, output_size: int) -> str:
        """Create error message for defensive reading."""
        max_size = int(self.context_window * self.max_output_ratio)
        
        return f"""
OUTPUT TOO LARGE FOR CONTEXT WINDOW

The command output is {output_size} tokens, which exceeds the maximum of {max_size} tokens 
(50% of context window).

Please re-run the command with more specific parameters to get targeted output:
- Use 'head -n 20' or 'tail -n 20' to see specific lines
- Use 'grep' to search for specific content
- Use 'wc -l' to count lines instead of displaying all content
- Use 'ls -la' instead of 'ls -laR' for directory listings
- Use 'find' with specific filters instead of broad searches

You can run multiple targeted commands to gather the information you need.
"""
    
    def prepare_messages_for_llm(self, messages: List[SessionMessage], llm_client) -> List[Dict[str, str]]:
        """Prepare messages for LLM, applying compaction if needed."""
        # Check if compaction is needed
        if self.should_compact(messages):
            messages = self.compact_messages(messages, llm_client)
        
        # Convert to LLM format
        llm_messages = []
        
        for msg in messages:
            # Skip system messages that are too verbose
            if msg.role == "system" and msg.message_type == "command_output":
                if len(msg.content) > 500:
                    content = msg.content[:500] + "... [truncated]"
                else:
                    content = msg.content
            else:
                content = msg.content
            
            llm_messages.append({
                "role": msg.role,
                "content": content
            })
        
        return llm_messages
    
    def get_context_stats(self, messages: List[SessionMessage]) -> Dict[str, Any]:
        """Get statistics about context usage."""
        total_tokens = self.estimate_session_tokens(messages)
        usage_percentage = (total_tokens / self.context_window) * 100
        
        return {
            "total_tokens": total_tokens,
            "context_window": self.context_window,
            "usage_percentage": usage_percentage,
            "compaction_needed": self.should_compact(messages),
            "message_count": len(messages)
        }