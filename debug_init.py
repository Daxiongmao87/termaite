#!/usr/bin/env python3

"""Debug script to trace exactly where the /init response truncation occurs."""

import sys
import re
from termaite.config.manager import create_config_manager
from termaite.core.task_handler import create_task_handler
from termaite.core.project_initialization import create_project_initialization_task

def debug_init_truncation():
    """Debug the /init truncation issue with detailed logging."""
    
    print("=== DEBUG INIT TRUNCATION ===")
    
    # Create components
    config_manager = create_config_manager()
    config = config_manager.config
    task_handler = create_task_handler(
        config, 
        config_manager, 
        '/home/patrick/Projects/git_projects/term.ai.te'
    )
    
    # Create project initialization task  
    init_task = create_project_initialization_task(
        task_handler,
        '/home/patrick/Projects/git_projects/term.ai.te'
    )
    
    # Patch the LLM client to capture exact responses
    original_send_request = task_handler.llm_client.send_request
    captured_requests_responses = []
    
    def debug_send_request(*args, **kwargs):
        print(f"\n--- LLM REQUEST #{len(captured_requests_responses) + 1} ---")
        response = original_send_request(*args, **kwargs)
        
        if response:
            print(f"Response length: {len(response)} characters")
            print(f"Response ends with: {repr(response[-50:])}")
            
            # Check if it's a truncated agent_command response
            if '```agent_command' in response:
                print("FOUND agent_command response:")
                print(f"Has opening agent_command: {'```agent_command' in response}")
                print(f"Has closing backticks after agent_command: {response.count('```') >= 2}")
                
                # Extract the agent_command block specifically
                agent_cmd_match = re.search(r'```agent_command\s*(.*?)```', response, re.DOTALL)
                if agent_cmd_match:
                    print(f"✅ COMPLETE agent_command block found: {repr(agent_cmd_match.group(1).strip())}")
                else:
                    # Look for truncated pattern
                    truncated_match = re.search(r'```agent_command\s*(.*?)$', response, re.DOTALL)
                    if truncated_match:
                        print(f"❌ TRUNCATED agent_command block: {repr(truncated_match.group(1).strip())}")
                        print("Missing closing backticks!")
        else:
            print("Response is None/empty")
            
        captured_requests_responses.append((args, kwargs, response))
        return response
    
    # Apply the debug wrapper
    task_handler.llm_client.send_request = debug_send_request
    
    # Create a simple task prompt that should trigger the issue
    simple_task = "List the contents of the /home/patrick/Projects/git_projects/term.ai.te directory to analyze the project structure."
    
    print(f"\nExecuting simple task: {simple_task}")
    
    try:
        # Execute just one step to see the truncation
        success = task_handler.handle_task(simple_task)
        print(f"\nTask result: {success}")
        
    except Exception as e:
        print(f"\nException during task: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Restore original method
        task_handler.llm_client.send_request = original_send_request
    
    print(f"\n=== SUMMARY ===")
    print(f"Total LLM requests made: {len(captured_requests_responses)}")
    
    # Analyze each response for truncation patterns
    for i, (args, kwargs, response) in enumerate(captured_requests_responses, 1):
        if response and '```agent_command' in response:
            complete = response.count('```') >= 2
            print(f"Request {i}: agent_command response - {'COMPLETE' if complete else 'TRUNCATED'}")

if __name__ == "__main__":
    debug_init_truncation()