"""LLM response parsing utilities for termaite."""

import re
from typing import Optional, Dict, List, Tuple
from pathlib import Path

from ..utils.logging import logger


def parse_suggested_command(llm_output: str) -> Optional[str]:
    """Extract a suggested command from LLM output wrapped in ```agent_command``` tags."""
    match = re.search(r"```agent_command\s*(.*?)```", llm_output, re.DOTALL)
    return match.group(1).strip() if match else None


def parse_llm_thought(llm_output: str) -> str:
    """Extract the LLM's thought process from <think> tags."""
    match = re.search(r"<think>(.*?)</think>", llm_output, re.DOTALL)
    return match.group(1).strip() if match else ""


def parse_llm_plan(llm_output: str) -> str:
    """Extract the LLM's plan from <checklist> tags."""
    match = re.search(r"<checklist>(.*?)</checklist>", llm_output, re.DOTALL)
    return match.group(1).strip() if match else ""


def parse_llm_instruction(llm_output: str) -> str:
    """Extract the LLM's instruction from <instruction> tags."""
    match = re.search(r"<instruction>(.*?)</instruction>", llm_output, re.DOTALL)
    return match.group(1).strip() if match else ""


def parse_llm_decision(llm_output: str) -> str:
    """Extract the LLM's decision from <decision> tags."""
    match = re.search(r"<decision>(.*?)</decision>", llm_output, re.DOTALL)
    return match.group(1).strip() if match else ""


def parse_llm_summary(llm_output: str) -> str:
    """Extract the LLM's summary from <summary> tags."""
    match = re.search(r"<summary>(.*?)</summary>", llm_output, re.DOTALL)
    return match.group(1).strip() if match else ""


def extract_decision_type_and_message(decision_text: str) -> tuple[str, str]:
    """Extract decision type and message from decision text.

    Args:
        decision_text: Raw decision text (e.g., "CONTINUE_PLAN: message here")

    Returns:
        Tuple of (decision_type, message)
    """
    if not decision_text:
        return "", ""

    if ":" in decision_text:
        decision_type, message = decision_text.split(":", 1)
        return decision_type.strip(), message.strip()
    else:
        return decision_text.strip(), ""


def parse_checklist_items(plan_text: str) -> list[str]:
    """Parse checklist items from plan text.

    Args:
        plan_text: Plan text containing checklist items

    Returns:
        List of checklist items
    """
    if not plan_text:
        return []

    # Split by lines and extract items that look like checklist items
    lines = plan_text.strip().split("\n")
    items = []

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Handle different checklist formats
        if line.startswith(("- ", "* ", "+ ")):
            items.append(line[2:].strip())
        elif re.match(r"^\d+\.?\s+", line):
            items.append(re.sub(r"^\d+\.?\s+", "", line).strip())
        elif line:
            # If it's not explicitly formatted as a list, still include it
            items.append(line)

    return items


def extract_response_content(response_data: dict, response_path: str) -> Optional[str]:
    """Extract content from LLM response using jq-like path.

    Args:
        response_data: LLM response JSON data
        response_path: jq-like path (e.g., ".response", ".choices[0].message.content")

    Returns:
        Extracted content or None if not found
    """
    if not response_path.startswith("."):
        logger.warning(f"Response path should start with '.': {response_path}")
        return None

    # Remove leading dot
    path = response_path[1:]

    try:
        current = response_data

        # Handle simple paths like "response"
        if "." not in path and "[" not in path:
            return current.get(path)

        # Split path by dots, but handle array indices
        parts = []
        current_part = ""
        bracket_depth = 0

        for char in path:
            if char == "[":
                bracket_depth += 1
                current_part += char
            elif char == "]":
                bracket_depth -= 1
                current_part += char
            elif char == "." and bracket_depth == 0:
                if current_part:
                    parts.append(current_part)
                current_part = ""
            else:
                current_part += char

        if current_part:
            parts.append(current_part)

        # Navigate through the path
        for part in parts:
            if "[" in part and "]" in part:
                # Handle array access like "choices[0]"
                key, bracket_part = part.split("[", 1)
                index_str = bracket_part.rstrip("]")

                if key:
                    current = current.get(key, {})

                try:
                    index = int(index_str)
                    if isinstance(current, list) and 0 <= index < len(current):
                        current = current[index]
                    else:
                        return None
                except ValueError:
                    return None
            else:
                # Simple key access
                if isinstance(current, dict):
                    current = current.get(part)
                else:
                    return None

                if current is None:
                    return None

        return current

    except Exception as e:
        logger.error(
            f"Error extracting response content with path '{response_path}': {e}"
        )
        return None


def parse_file_content_blocks(llm_output: str) -> Dict[str, str]:
    """Extract file content from LLM output using markdown code blocks with filenames.
    
    Looks for patterns like:
    ```markdown
    # .termaite/PLANNER.md
    [content here]
    ```
    
    or
    
    **File: .termaite/PLANNER.md**
    ```markdown
    [content here]
    ```
    
    Args:
        llm_output: LLM response text
        
    Returns:
        Dictionary mapping filenames to their content
    """
    file_contents = {}
    
    # Pattern 1: Code blocks with filename comments
    # ```markdown\n# filename\ncontent```
    pattern1 = r"```(?:markdown|md)?\s*\n#\s*([^\n]+)\n(.*?)```"
    matches = re.findall(pattern1, llm_output, re.DOTALL | re.IGNORECASE)
    
    for filename, content in matches:
        filename = filename.strip()
        content = content.strip()
        if filename and content:
            file_contents[filename] = content
            logger.debug(f"Extracted content for {filename} (pattern 1)")
    
    # Pattern 2: File headers followed by code blocks
    # **File: filename**\n```markdown\ncontent```
    pattern2 = r"\*\*File:\s*([^\*\n]+)\*\*\s*\n```(?:markdown|md)?\s*\n(.*?)```"
    matches = re.findall(pattern2, llm_output, re.DOTALL | re.IGNORECASE)
    
    for filename, content in matches:
        filename = filename.strip()
        content = content.strip()
        if filename and content and filename not in file_contents:
            file_contents[filename] = content
            logger.debug(f"Extracted content for {filename} (pattern 2)")
    
    # Pattern 3: Filename headers followed by content blocks
    # ## .termaite/PLANNER.md\n```markdown\ncontent```
    pattern3 = r"#{1,3}\s*([^\n]*\.termaite/[^\n]+)\s*\n```(?:markdown|md)?\s*\n(.*?)```"
    matches = re.findall(pattern3, llm_output, re.DOTALL | re.IGNORECASE)
    
    for filename, content in matches:
        filename = filename.strip()
        content = content.strip()
        if filename and content and filename not in file_contents:
            file_contents[filename] = content
            logger.debug(f"Extracted content for {filename} (pattern 3)")
    
    # Pattern 4: Simple mention of .termaite files with following code blocks
    # .termaite/PLANNER.md should contain:\n```markdown\ncontent```
    pattern4 = r"(\.termaite/[^\s\n:]+)(?:\s+should contain:?)?[\s\n]*```(?:markdown|md)?\s*\n(.*?)```"
    matches = re.findall(pattern4, llm_output, re.DOTALL | re.IGNORECASE)
    
    for filename, content in matches:
        filename = filename.strip()
        content = content.strip()
        if filename and content and filename not in file_contents:
            file_contents[filename] = content
            logger.debug(f"Extracted content for {filename} (pattern 4)")
    
    return file_contents


def extract_and_save_generated_files(
    llm_output: str, 
    target_directory: str,
    allowed_extensions: Optional[List[str]] = None
) -> List[str]:
    """Extract file content from LLM output and save to target directory.
    
    Args:
        llm_output: LLM response containing file content
        target_directory: Directory to save files to
        allowed_extensions: List of allowed file extensions (e.g., ['.md', '.txt'])
        
    Returns:
        List of successfully created file paths
    """
    if allowed_extensions is None:
        allowed_extensions = ['.md', '.txt', '.yaml', '.yml', '.json', '.py']
    
    file_contents = parse_file_content_blocks(llm_output)
    created_files = []
    target_path = Path(target_directory)
    
    for filename, content in file_contents.items():
        try:
            # Validate filename
            file_path = Path(filename)
            if file_path.suffix.lower() not in allowed_extensions:
                logger.warning(f"Skipping file with disallowed extension: {filename}")
                continue
            
            # Handle relative paths and ensure they're within target directory
            if file_path.is_absolute():
                logger.warning(f"Skipping absolute path: {filename}")
                continue
            
            # Resolve full path
            full_path = target_path / file_path
            
            # Ensure the file is within the target directory (security check)
            try:
                full_path.resolve().relative_to(target_path.resolve())
            except ValueError:
                logger.warning(f"Skipping file outside target directory: {filename}")
                continue
            
            # Create parent directories if needed
            full_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Write file content
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            created_files.append(str(full_path))
            logger.system(f"Created file: {full_path}")
            
        except Exception as e:
            logger.error(f"Failed to create file {filename}: {e}")
    
    return created_files


def validate_generated_prompt_files(file_paths: List[str]) -> Tuple[bool, List[str]]:
    """Validate that generated prompt files have reasonable content.
    
    Args:
        file_paths: List of file paths to validate
        
    Returns:
        Tuple of (all_valid, list_of_issues)
    """
    issues = []
    all_valid = True
    
    expected_files = {'PLANNER.md', 'ACTOR.md', 'EVALUATOR.md'}
    found_files = set()
    
    for file_path in file_paths:
        path = Path(file_path)
        filename = path.name
        
        if filename in expected_files:
            found_files.add(filename)
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read().strip()
            
            # Basic content validation
            if len(content) < 100:
                issues.append(f"{filename}: Content too short (< 100 characters)")
                all_valid = False
            
            if "Project-Specific" not in content:
                issues.append(f"{filename}: Missing 'Project-Specific' section")
                all_valid = False
            
            if content.count("TODO") > 0 or content.count("placeholder") > 0:
                issues.append(f"{filename}: Contains TODO or placeholder content")
                all_valid = False
                
        except Exception as e:
            issues.append(f"{filename}: Failed to read file - {e}")
            all_valid = False
    
    # Check if all expected files were created
    missing_files = expected_files - found_files
    if missing_files:
        issues.append(f"Missing expected files: {', '.join(missing_files)}")
        all_valid = False
    
    return all_valid, issues
