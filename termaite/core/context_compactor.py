"""Context compacting system for maintaining contextual awareness while managing size limits."""

import json
import math
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from pathlib import Path

from ..utils.logging import logger
from ..llm import create_llm_client, create_payload_builder


@dataclass
class ContextEntry:
    """Represents a single context entry."""
    type: str
    user_prompt: str
    llm_response: str
    timestamp: str
    original_user_prompt: str = ""
    is_plan: bool = False
    is_original_request: bool = False
    compaction_level: int = 0  # 0=original, 1=compact, 2=very compact


class ContextCompactor:
    """Manages context compaction to maintain 75% size limit."""
    
    def __init__(self, config: Dict[str, Any], config_manager):
        """Initialize the context compactor.
        
        Args:
            config: Application configuration
            config_manager: Configuration manager instance
        """
        self.config = config
        self.config_manager = config_manager
        self.llm_client = create_llm_client(config, config_manager)
        self.payload_builder = create_payload_builder(config, config_manager.payload_file)
        
        # Context size management
        self.max_context_tokens = config.get("max_context_tokens", 20480)  # From payload.json num_ctx
        self.compaction_threshold = 0.75  # 75% threshold
        
        # Compaction prompts
        self.compact_prompt = """
        You are a context compactor. Summarize the following conversation history into a more concise form while preserving:
        - Key decisions and outcomes
        - Important context for future actions
        - The flow of the conversation
        - Any error messages or important results
        
        Make it about 50% of the original length.
        
        Context to compact:
        {context}
        
        Provide a compact summary:
        """
        
        self.very_compact_prompt = """
        You are a context compactor. Create a very brief summary of the following context, preserving only:
        - Essential outcomes and decisions
        - Critical context needed for task completion
        - Major errors or successes
        
        Make it about 25% of the original length.
        
        Context to compact:
        {context}
        
        Provide a very compact summary:
        """
        
        logger.debug("ContextCompactor initialized")
    
    def estimate_token_count(self, text: str) -> int:
        """Estimate token count using a simple heuristic.
        
        Args:
            text: Text to estimate tokens for
            
        Returns:
            Estimated token count
        """
        # Rough estimate: 1 token per 4 characters for English text
        return len(text) // 4
    
    def should_compact_context(self, context_entries: List[ContextEntry]) -> bool:
        """Check if context should be compacted based on size.
        
        Args:
            context_entries: List of context entries
            
        Returns:
            True if compaction is needed
        """
        total_tokens = sum(
            self.estimate_token_count(entry.user_prompt + entry.llm_response)
            for entry in context_entries
        )
        
        threshold_tokens = int(self.max_context_tokens * self.compaction_threshold)
        logger.debug(f"Context size: {total_tokens} tokens, threshold: {threshold_tokens}")
        
        return total_tokens > threshold_tokens
    
    def compact_context_segment(self, entries: List[ContextEntry], compaction_level: int) -> str:
        """Compact a segment of context entries.
        
        Args:
            entries: Context entries to compact
            compaction_level: 1 for compact, 2 for very compact
            
        Returns:
            Compacted context string
        """
        if not entries:
            return ""
        
        # Build context string from entries
        context_parts = []
        for entry in entries:
            context_parts.append(f"User: {entry.user_prompt}")
            context_parts.append(f"Assistant: {entry.llm_response}")
        
        context_text = "\n".join(context_parts)
        
        # Choose compaction prompt based on level
        if compaction_level == 1:
            prompt = self.compact_prompt.format(context=context_text)
        else:  # compaction_level == 2
            prompt = self.very_compact_prompt.format(context=context_text)
        
        # Get compacted version from LLM
        payload = self.payload_builder.prepare_payload("simple", prompt)
        if not payload:
            logger.warning("Failed to prepare payload for context compaction")
            return context_text  # Return original if compaction fails
        
        response = self.llm_client.send_request(payload)
        if not response:
            logger.warning("No response from LLM for context compaction")
            return context_text  # Return original if compaction fails
        
        logger.debug(f"Compacted context segment from {len(context_text)} to {len(response)} characters")
        return response
    
    def compact_context(self, context_entries: List[ContextEntry]) -> List[ContextEntry]:
        """Compact context using progressive compaction strategy.
        
        Args:
            context_entries: List of context entries to compact
            
        Returns:
            List of compacted context entries
        """
        if not self.should_compact_context(context_entries):
            return context_entries
        
        logger.system("Context approaching size limit, initiating compaction...")
        
        # Find original user prompt and plan entries to preserve
        original_request = None
        plan_entries = []
        regular_entries = []
        
        for entry in context_entries:
            if entry.is_original_request:
                original_request = entry
            elif entry.is_plan:
                plan_entries.append(entry)
            else:
                regular_entries.append(entry)
        
        # Calculate segments for progressive compaction
        total_entries = len(regular_entries)
        if total_entries < 4:
            # Not enough entries to compact meaningfully
            return context_entries
        
        # Divide into segments: 25% very compact, 25% compact, 50% untouched
        very_compact_count = max(1, total_entries // 4)
        compact_count = max(1, total_entries // 4)
        
        # Split entries into segments
        very_compact_entries = regular_entries[:very_compact_count]
        compact_entries = regular_entries[very_compact_count:very_compact_count + compact_count]
        untouched_entries = regular_entries[very_compact_count + compact_count:]
        
        result_entries = []
        
        # Preserve original request
        if original_request:
            result_entries.append(original_request)
        
        # Preserve plan entries
        result_entries.extend(plan_entries)
        
        # Add very compact segment
        if very_compact_entries:
            very_compact_text = self.compact_context_segment(very_compact_entries, 2)
            very_compact_entry = ContextEntry(
                type="compacted",
                user_prompt="[COMPACTED CONTEXT]",
                llm_response=very_compact_text,
                timestamp=very_compact_entries[0].timestamp,
                compaction_level=2
            )
            result_entries.append(very_compact_entry)
        
        # Add compact segment
        if compact_entries:
            compact_text = self.compact_context_segment(compact_entries, 1)
            compact_entry = ContextEntry(
                type="compacted",
                user_prompt="[COMPACTED CONTEXT]",
                llm_response=compact_text,
                timestamp=compact_entries[0].timestamp,
                compaction_level=1
            )
            result_entries.append(compact_entry)
        
        # Add untouched entries
        result_entries.extend(untouched_entries)
        
        # Calculate space saved
        original_size = sum(len(e.user_prompt + e.llm_response) for e in context_entries)
        new_size = sum(len(e.user_prompt + e.llm_response) for e in result_entries)
        space_saved = original_size - new_size
        
        logger.system(f"Context compaction complete. Saved {space_saved} characters "
                     f"({len(context_entries)} → {len(result_entries)} entries)")
        
        return result_entries
    
    def parse_context_entries(self, context_data: Dict[str, Any], pwd_hash: str) -> List[ContextEntry]:
        """Parse context data into ContextEntry objects.
        
        Args:
            context_data: Raw context data from JSON
            pwd_hash: Current working directory hash
            
        Returns:
            List of ContextEntry objects
        """
        if pwd_hash not in context_data:
            return []
        
        entries = []
        session_entries = context_data[pwd_hash]
        
        for i, entry in enumerate(session_entries):
            # Determine if this is the original request (first entry)
            is_original_request = (i == 0)
            
            # Extract response content
            if entry.get("type") == "success" and "llm_full_response" in entry:
                try:
                    response = entry["llm_full_response"]
                    if isinstance(response, dict):
                        llm_response = (response.get("response") or 
                                      response.get("content") or 
                                      response.get("text") or 
                                      str(response))
                    else:
                        llm_response = str(response)
                except Exception:
                    llm_response = str(entry["llm_full_response"])
            else:
                llm_response = entry.get("llm_error_message", "Error occurred")
            
            # Determine if this is a plan entry
            is_plan = "plan" in entry.get("user_prompt", "").lower() or "checklist" in llm_response.lower()
            
            context_entry = ContextEntry(
                type=entry.get("type", "unknown"),
                user_prompt=entry.get("user_prompt", ""),
                llm_response=llm_response,
                timestamp=entry.get("timestamp", ""),
                is_original_request=is_original_request,
                is_plan=is_plan,
                compaction_level=0
            )
            
            entries.append(context_entry)
        
        return entries
    
    def save_compacted_context(self, context_entries: List[ContextEntry], pwd_hash: str) -> bool:
        """Save compacted context back to the context file.
        
        Args:
            context_entries: Compacted context entries
            pwd_hash: Current working directory hash
            
        Returns:
            True if successful
        """
        context_file = self.config_manager.config_dir / "context.json"
        
        # Load existing context data
        try:
            if context_file.exists():
                with open(context_file, 'r') as f:
                    context_data = json.load(f)
            else:
                context_data = {}
        except Exception as e:
            logger.error(f"Failed to load context file: {e}")
            return False
        
        # Convert entries back to JSON format
        json_entries = []
        for entry in context_entries:
            if entry.type == "compacted":
                json_entry = {
                    "type": "compacted",
                    "user_prompt": entry.user_prompt,
                    "llm_full_response": {"response": entry.llm_response},
                    "timestamp": entry.timestamp,
                    "compaction_level": entry.compaction_level
                }
            else:
                json_entry = {
                    "type": entry.type,
                    "user_prompt": entry.user_prompt,
                    "llm_full_response": {"response": entry.llm_response},
                    "timestamp": entry.timestamp
                }
            json_entries.append(json_entry)
        
        # Update context data
        context_data[pwd_hash] = json_entries
        
        # Save to file
        try:
            with open(context_file, 'w') as f:
                json.dump(context_data, f, indent=2)
            return True
        except Exception as e:
            logger.error(f"Failed to save compacted context: {e}")
            return False
    
    def check_and_compact_context(self, pwd_hash: str) -> bool:
        """Check if context needs compaction and perform it if needed.
        
        Args:
            pwd_hash: Current working directory hash
            
        Returns:
            True if compaction was performed or not needed
        """
        context_file = self.config_manager.config_dir / "context.json"
        
        if not context_file.exists():
            return True  # No context to compact
        
        try:
            with open(context_file, 'r') as f:
                context_data = json.load(f)
        except Exception as e:
            logger.error(f"Failed to load context file: {e}")
            return False
        
        # Parse context entries
        entries = self.parse_context_entries(context_data, pwd_hash)
        
        if not entries:
            return True  # No entries to compact
        
        # Check if compaction is needed
        if not self.should_compact_context(entries):
            return True  # No compaction needed
        
        # Perform compaction
        compacted_entries = self.compact_context(entries)
        
        # Save compacted context
        return self.save_compacted_context(compacted_entries, pwd_hash)


def create_context_compactor(config: Dict[str, Any], config_manager) -> ContextCompactor:
    """Create a context compactor instance.
    
    Args:
        config: Application configuration
        config_manager: Configuration manager instance
        
    Returns:
        ContextCompactor instance
    """
    return ContextCompactor(config, config_manager)