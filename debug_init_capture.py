#!/usr/bin/env python3

"""Debug script to test the /init response capture system specifically."""

import sys
import re
from termaite.config.manager import create_config_manager
from termaite.core.task_handler import create_task_handler
from termaite.core.project_initialization import create_project_initialization_task

def debug_init_response_capture():
    """Debug the /init response capture system specifically."""
    
    print("=== DEBUG INIT RESPONSE CAPTURE ===")
    
    # Create components exactly like /init does
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
    
    # Remove any existing .termaite to ensure clean test
    import shutil
    from pathlib import Path
    termaite_dir = Path('/home/patrick/Projects/git_projects/term.ai.te/.termaite')
    if termaite_dir.exists():
        shutil.rmtree(termaite_dir)
    
    # Create the directory again
    termaite_dir.mkdir(exist_ok=True)
    print(f"Created clean .termaite directory: {termaite_dir}")
    
    # Add investigation commands like /init does
    init_task._add_investigation_commands()
    print("Added investigation commands")
    
    # Get the complex project analysis task prompt
    initialization_task = init_task._create_initialization_task()
    print(f"Created initialization task (length: {len(initialization_task)} chars)")
    
    # Now test the response capture system specifically
    original_send_request = task_handler.llm_client.send_request
    captured_responses = []
    
    def debug_capturing_send_request(*args, **kwargs):
        print(f"\n--- CAPTURED LLM REQUEST #{len(captured_responses) + 1} ---")
        response = original_send_request(*args, **kwargs)
        
        if response:
            print(f"Raw response length: {len(response)} characters")
            print(f"Response ends with: {repr(response[-100:])}")
            
            # Check for agent_command blocks
            if '```agent_command' in response:
                print("FOUND agent_command in response!")
                
                # Count backticks
                backtick_count = response.count('```')
                print(f"Total backtick blocks: {backtick_count}")
                
                if backtick_count >= 2:
                    # Try to extract the command
                    match = re.search(r'```agent_command\s*(.*?)```', response, re.DOTALL)
                    if match:
                        cmd = match.group(1).strip()
                        print(f"✅ COMPLETE command extracted: {repr(cmd)}")
                    else:
                        print("❌ Could not extract complete command despite backticks")
                else:
                    print("❌ TRUNCATED - Missing closing backticks")
                    # Show what we have
                    truncated = re.search(r'```agent_command\s*(.*?)$', response, re.DOTALL)
                    if truncated:
                        cmd = truncated.group(1).strip()
                        print(f"Partial command: {repr(cmd)}")
        else:
            print("❌ Response is None/empty")
            
        captured_responses.append(response)
        return response
    
    # Apply the capture wrapper exactly like /init does
    def capturing_send_request(*args, **kwargs):
        """Wrapper to capture LLM responses."""
        response = original_send_request(*args, **kwargs)
        if response:
            init_task.captured_responses.append(response)
        return response
    
    try:
        # Test the capture system
        print(f"\nTesting capture system with task: {initialization_task[:100]}...")
        
        # Replace the method like /init does
        task_handler.llm_client.send_request = debug_capturing_send_request
        
        # Execute one cycle to see where it breaks
        success = task_handler.handle_task(initialization_task)
        print(f"\nTask execution result: {success}")
        
    except Exception as e:
        print(f"\nException during execution: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Restore original method
        task_handler.llm_client.send_request = original_send_request
    
    print(f"\n=== ANALYSIS ===")
    print(f"Captured responses: {len(captured_responses)}")
    
    action_responses = 0
    truncated_responses = 0
    
    for i, response in enumerate(captured_responses, 1):
        if response and '```agent_command' in response:
            action_responses += 1
            complete = response.count('```') >= 2
            print(f"Response {i}: agent_command {'COMPLETE' if complete else 'TRUNCATED'}")
            if not complete:
                truncated_responses += 1
    
    print(f"Action responses: {action_responses}")
    print(f"Truncated responses: {truncated_responses}")
    
    if truncated_responses > 0:
        print("❌ TRUNCATION CONFIRMED in /init mode")
    else:
        print("✅ No truncation detected")

if __name__ == "__main__":
    debug_init_response_capture()