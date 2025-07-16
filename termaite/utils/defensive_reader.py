"""
Defensive reading utility for handling large command outputs.
"""

import re
from typing import Tuple, Optional, List
from ..config.manager import ConfigManager
from .context_compactor import ContextCompactor


class DefensiveReader:
    """Handles large command outputs to prevent context window overflow."""
    
    def __init__(self, config_manager: ConfigManager):
        self.config_manager = config_manager
        self.config = config_manager.load_config()
        self.context_compactor = ContextCompactor(config_manager)
    
    def check_output_size(self, output: str) -> Tuple[bool, int]:
        """Check if output is too large for context window."""
        token_count = self.context_compactor.estimate_tokens(output)
        is_too_large = self.context_compactor.check_output_size(output)
        return is_too_large, token_count
    
    def handle_large_output(self, command: str, output: str, stderr: str) -> Tuple[str, str]:
        """Handle large output by providing defensive reading guidance."""
        is_too_large, token_count = self.check_output_size(output)
        
        if not is_too_large:
            return output, stderr
        
        # Create defensive reading error message
        error_msg = self.context_compactor.create_defensive_reading_error(token_count)
        
        # Add command-specific suggestions
        specific_suggestions = self._get_command_specific_suggestions(command)
        if specific_suggestions:
            error_msg += f"\n\nCommand-specific suggestions for '{command}':\n{specific_suggestions}"
        
        return "", error_msg
    
    def _get_command_specific_suggestions(self, command: str) -> str:
        """Get command-specific suggestions for handling large output."""
        command_parts = command.split()
        if not command_parts:
            return ""
        
        base_command = command_parts[0]
        
        suggestions = {
            'find': [
                "Use 'find . -name \"*.py\" | head -20' to limit results",
                "Use 'find . -type f -name \"*.py\" -exec basename {} \\;' for just filenames",
                "Use 'find . -maxdepth 2' to limit search depth",
                "Use 'find . -name \"*.py\" | wc -l' to count matches first"
            ],
            'ls': [
                "Use 'ls -la | head -20' to see first 20 entries",
                "Use 'ls -la | grep pattern' to filter results",
                "Use 'ls -ld */' to see only directories",
                "Use 'ls -la | wc -l' to count entries first"
            ],
            'grep': [
                "Use 'grep -n pattern file | head -20' to limit matches",
                "Use 'grep -c pattern file' to count matches first",
                "Use 'grep -l pattern *.py' to see only matching filenames",
                "Use 'grep -A5 -B5 pattern file' for context around matches"
            ],
            'cat': [
                "Use 'head -20 file' to see first 20 lines",
                "Use 'tail -20 file' to see last 20 lines",
                "Use 'wc -l file' to count lines first",
                "Use 'grep -n pattern file' to find specific content"
            ],
            'ps': [
                "Use 'ps aux | head -20' to see first 20 processes",
                "Use 'ps aux | grep pattern' to filter processes",
                "Use 'ps aux | wc -l' to count processes first"
            ],
            'df': [
                "Use 'df -h' for human-readable sizes",
                "Use 'df -h | grep -v tmpfs' to filter out temporary filesystems"
            ],
            'du': [
                "Use 'du -h --max-depth=1' to limit depth",
                "Use 'du -h | sort -hr | head -20' to see largest directories first",
                "Use 'du -sh *' to summarize each directory"
            ],
            'history': [
                "Use 'history | tail -20' to see recent commands",
                "Use 'history | grep pattern' to search history",
                "Use 'history | wc -l' to count history entries"
            ],
            'git': [
                "Use 'git log --oneline -20' to limit commit history",
                "Use 'git status -s' for short status",
                "Use 'git diff --stat' for diff summary"
            ],
            'tar': [
                "Use 'tar -tf archive.tar | head -20' to see first 20 files",
                "Use 'tar -tf archive.tar | wc -l' to count files first"
            ],
            'sort': [
                "Use 'sort file | head -20' to see first 20 sorted lines",
                "Use 'sort file | tail -20' to see last 20 sorted lines"
            ]
        }
        
        if base_command in suggestions:
            return "\n".join(f"- {suggestion}" for suggestion in suggestions[base_command])
        
        return ""
    
    def suggest_alternative_commands(self, command: str) -> List[str]:
        """Suggest alternative commands for large output scenarios."""
        alternatives = []
        
        if 'find' in command:
            alternatives.extend([
                "find . -name '*.py' | head -20",
                "find . -name '*.py' | wc -l",
                "find . -maxdepth 2 -name '*.py'"
            ])
        
        if 'ls' in command and '-R' in command:
            alternatives.extend([
                "ls -la",
                "find . -maxdepth 2 -type d",
                "tree -L 2"
            ])
        
        if 'cat' in command:
            alternatives.extend([
                "head -20 " + " ".join(command.split()[1:]),
                "tail -20 " + " ".join(command.split()[1:]),
                "wc -l " + " ".join(command.split()[1:])
            ])
        
        if 'grep' in command:
            alternatives.extend([
                command + " | head -20",
                command.replace('grep', 'grep -c'),
                command.replace('grep', 'grep -l')
            ])
        
        return alternatives
    
    def create_summary_from_large_output(self, output: str, max_lines: int = 50) -> str:
        """Create a summary from large output."""
        lines = output.split('\n')
        
        if len(lines) <= max_lines:
            return output
        
        # Take first and last portions
        first_portion = lines[:max_lines//2]
        last_portion = lines[-max_lines//2:]
        
        summary = "\n".join(first_portion)
        summary += f"\n\n... [{len(lines) - max_lines} lines omitted] ...\n\n"
        summary += "\n".join(last_portion)
        
        return summary
    
    def analyze_output_pattern(self, output: str) -> str:
        """Analyze output pattern to suggest better commands."""
        lines = output.split('\n')
        
        analysis = []
        
        # Check for repeated patterns
        if len(lines) > 100:
            analysis.append(f"Output has {len(lines)} lines - consider using pagination")
        
        # Check for file listings
        if any(line.startswith('-') or line.startswith('d') for line in lines[:10]):
            analysis.append("Appears to be file listing - use 'ls | head -20' or 'ls | grep pattern'")
        
        # Check for search results
        if any(':' in line for line in lines[:10]):
            analysis.append("Appears to be search results - use 'grep -n pattern | head -20'")
        
        # Check for process listing
        if any('PID' in line or 'USER' in line for line in lines[:3]):
            analysis.append("Appears to be process listing - use 'ps aux | head -20'")
        
        return "\n".join(analysis) if analysis else "Large output detected"
    
    def get_truncation_message(self, original_size: int, max_size: int) -> str:
        """Get a message explaining truncation."""
        return f"""
[OUTPUT TRUNCATED]

Original output: {original_size} tokens
Maximum allowed: {max_size} tokens

The output was too large for the context window. Use more specific commands to get targeted information.
"""