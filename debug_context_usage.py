#!/usr/bin/env python3

"""Debug script to measure actual context usage during /init."""

import sys
import json
from termaite.config.manager import create_config_manager
from termaite.core.task_handler import create_task_handler
from termaite.core.project_initialization import create_project_initialization_task

def estimate_tokens(text):
    """Rough token estimation (1 token ≈ 4 characters for English)."""
    return len(text) // 4

def debug_context_usage():
    """Debug actual context and token usage during /init."""
    
    print("=== DEBUG CONTEXT USAGE ===")
    
    # Create components
    config_manager = create_config_manager()
    config = config_manager.config
    task_handler = create_task_handler(
        config, 
        config_manager, 
        '/home/patrick/Projects/git_projects/term.ai.te'
    )
    
    print(f"Max context tokens configured: {config.get('max_context_tokens', 'not set')}")
    print(f"Compaction threshold: {config.get('compaction_threshold', 'not set')}")
    
    # Check the task handler's current context
    if hasattr(task_handler, 'context_compactor'):
        compactor = task_handler.context_compactor
        print(f"Context compactor max tokens: {compactor.max_context_tokens}")
        print(f"Context compactor threshold: {compactor.compaction_threshold}")
        threshold_tokens = int(compactor.max_context_tokens * compactor.compaction_threshold)
        print(f"Compaction triggers at: {threshold_tokens} tokens")
    
    # Create the initialization task
    init_task = create_project_initialization_task(
        task_handler,
        '/home/patrick/Projects/git_projects/term.ai.te'
    )
    
    # Get the initialization prompt
    initialization_prompt = init_task._create_initialization_task()
    prompt_chars = len(initialization_prompt)
    prompt_tokens = estimate_tokens(initialization_prompt)
    
    print(f"\\nInitialization prompt:")
    print(f"  Characters: {prompt_chars}")
    print(f"  Estimated tokens: {prompt_tokens}")
    print(f"  Percentage of max context: {(prompt_tokens / 20480) * 100:.1f}%")
    
    # Check current context in task handler
    if hasattr(task_handler, 'context_compactor') and hasattr(task_handler.context_compactor, 'conversation_history'):
        history = task_handler.context_compactor.conversation_history
        if history:
            total_history_chars = sum(len(str(entry)) for entry in history)
            total_history_tokens = estimate_tokens(str(history))
            print(f"\\nCurrent conversation history:")
            print(f"  Entries: {len(history)}")
            print(f"  Total characters: {total_history_chars}")
            print(f"  Estimated tokens: {total_history_tokens}")
            print(f"  Percentage of max context: {(total_history_tokens / 20480) * 100:.1f}%")
        else:
            print("\\nNo conversation history found")
    
    # Let's check what the payload builder actually sends
    payload_builder = task_handler.payload_builder
    
    # Get system prompt for action phase
    action_prompt = payload_builder._get_system_prompt_for_phase("action")
    if action_prompt:
        action_chars = len(action_prompt)
        action_tokens = estimate_tokens(action_prompt)
        print(f"\\nAction agent system prompt:")
        print(f"  Characters: {action_chars}")
        print(f"  Estimated tokens: {action_tokens}")
        print(f"  Percentage of max context: {(action_tokens / 20480) * 100:.1f}%")
    
    # Check what gets sent in a payload
    try:
        test_payload = payload_builder.prepare_payload("action", "test prompt")
        if test_payload:
            payload_data = json.loads(test_payload)
            
            # Extract the actual prompt content
            system_content = ""
            user_content = ""
            
            if "prompt" in payload_data:
                # Ollama style
                full_prompt = payload_data.get("prompt", "")
                prompt_tokens = estimate_tokens(full_prompt)
                print(f"\\nFull LLM prompt:")
                print(f"  Characters: {len(full_prompt)}")
                print(f"  Estimated tokens: {prompt_tokens}")
                print(f"  Percentage of max context: {(prompt_tokens / 20480) * 100:.1f}%")
                
                # Show start and end of prompt
                print(f"\\nPrompt preview:")
                print(f"  Start: {full_prompt[:200]}...")
                print(f"  End: ...{full_prompt[-200:]}")
                
            elif "messages" in payload_data:
                # ChatGPT style
                messages = payload_data.get("messages", [])
                total_content = ""
                for msg in messages:
                    total_content += msg.get("content", "") + "\\n"
                
                prompt_tokens = estimate_tokens(total_content)
                print(f"\\nTotal messages content:")
                print(f"  Messages: {len(messages)}")
                print(f"  Characters: {len(total_content)}")
                print(f"  Estimated tokens: {prompt_tokens}")
                print(f"  Percentage of max context: {(prompt_tokens / 20480) * 100:.1f}%")
    
    except Exception as e:
        print(f"\\nError analyzing payload: {e}")
    
    # Check if there are any response length limits in the model config
    print(f"\\nChecking for response limits:")
    print(f"  LLM endpoint: {config.get('endpoint', 'not set')}")
    print(f"  LLM model: {config.get('model', 'not set')}")
    
    # Look for any response-related settings
    response_settings = {}
    for key, value in config.items():
        if any(keyword in key.lower() for keyword in ['response', 'output', 'generate', 'max', 'limit']):
            response_settings[key] = value
    
    if response_settings:
        print(f"  Response-related settings:")
        for key, value in response_settings.items():
            print(f"    {key}: {value}")
    else:
        print(f"  No response-related settings found")

if __name__ == "__main__":
    debug_context_usage()