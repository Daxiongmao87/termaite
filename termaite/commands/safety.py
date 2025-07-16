"""
Safety mechanisms for command execution.
"""

import os
import shlex
from pathlib import Path
from typing import List, Tuple, Optional
from ..config.manager import ConfigManager


class CommandSafetyChecker:
    """Validates commands for safety before execution."""
    
    def __init__(self, config_manager: ConfigManager):
        self.config_manager = config_manager
        self.config = config_manager.load_config()
        self.project_root = Path(self.config.security.project_root).resolve()
        
        # Commands that are forbidden due to TUI nature
        self.forbidden_tui_commands = {
            'nano', 'vim', 'emacs', 'vi', 'top', 'htop', 'less', 'more',
            'man', 'sudo', 'su', 'passwd', 'mysql', 'psql', 'mongo',
            'ftp', 'sftp', 'ssh', 'telnet', 'screen', 'tmux', 'python3',
            'python', 'node', 'irb', 'ghci', 'ipython', 'jupyter'
        }
        
        # Commands that require user interaction
        self.interactive_commands = {
            'read', 'confirm', 'select', 'input', 'readline'
        }
        
        # Dangerous commands that should never be allowed
        self.dangerous_commands = {
            'rm', 'rmdir', 'dd', 'mkfs', 'fdisk', 'parted', 'format',
            'del', 'deltree', 'shutdown', 'reboot', 'halt', 'poweroff',
            'kill', 'killall', 'pkill', 'chmod', 'chown', 'chgrp'
        }
    
    def validate_command(self, command: str) -> Tuple[bool, str]:
        """Validate a command for safety."""
        if not command or not command.strip():
            return False, "Empty command"
        
        try:
            # Parse command safely
            tokens = shlex.split(command)
            if not tokens:
                return False, "No command tokens"
            
            base_command = tokens[0]
            
            # Check for forbidden TUI commands
            if base_command in self.forbidden_tui_commands:
                return False, f"TUI command not allowed: {base_command}"
            
            # Check for interactive commands
            if base_command in self.interactive_commands:
                return False, f"Interactive command not allowed: {base_command}"
            
            # Check for dangerous commands
            if base_command in self.dangerous_commands:
                return False, f"Dangerous command not allowed: {base_command}"
            
            # Enhanced command security checks
            security_result = self._perform_advanced_security_checks(command, tokens)
            if not security_result[0]:
                return security_result
            
            # Validate filesystem paths
            valid, reason = self._validate_filesystem_access(command, tokens)
            if not valid:
                return False, reason
            
            return True, "Command is safe"
            
        except ValueError as e:
            return False, f"Command parsing error: {e}"
        except Exception as e:
            return False, f"Command validation error: {e}"
    
    def _validate_filesystem_access(self, command: str, tokens: List[str]) -> Tuple[bool, str]:
        """Validate that command doesn't access files outside project root."""
        # Extract potential paths from command
        paths = self._extract_paths_from_command(command, tokens)
        
        for path_str in paths:
            try:
                # Enhanced path validation
                valid, reason = self._validate_single_path(path_str)
                if not valid:
                    return False, reason
                
            except Exception:
                # If path resolution fails, be conservative and reject
                return False, f"Invalid path: {path_str}"
        
        return True, "Filesystem access is safe"
    
    def _validate_single_path(self, path_str: str) -> Tuple[bool, str]:
        """Validate a single path with comprehensive checks."""
        # Check for path traversal attempts
        if self._contains_path_traversal(path_str):
            return False, f"Path traversal detected: {path_str}"
        
        # Check for dangerous path patterns
        if self._is_dangerous_path(path_str):
            return False, f"Dangerous path pattern: {path_str}"
        
        # Check for symlink exploitation attempts
        if self._contains_symlink_exploits(path_str):
            return False, f"Potential symlink exploit: {path_str}"
        
        # Resolve and validate final path
        try:
            if path_str.startswith('/'):
                # Absolute path - more restrictive validation
                if not self._is_allowed_absolute_path(path_str):
                    return False, f"Absolute path not allowed: {path_str}"
                resolved_path = Path(path_str).resolve()
            else:
                # Relative path
                resolved_path = (self.project_root / path_str).resolve()
            
            # Final boundary check
            if not self._is_path_within_project_root(resolved_path):
                return False, f"Path outside project root: {path_str} -> {resolved_path}"
            
            # Check for access to sensitive directories within project
            if self._is_sensitive_project_path(resolved_path):
                return False, f"Access to sensitive directory not allowed: {path_str}"
                
        except (OSError, ValueError) as e:
            return False, f"Path resolution failed: {path_str} ({e})"
        
        return True, "Path is valid"
    
    def _extract_paths_from_command(self, command: str, tokens: List[str]) -> List[str]:
        """Extract potential file paths from command tokens with enhanced detection."""
        paths = []
        
        # Enhanced path extraction from tokens
        i = 1  # Skip the command itself
        while i < len(tokens):
            token = tokens[i]
            
            # Skip flags and options
            if token.startswith('-'):
                # Some flags take path arguments, check next token
                if self._flag_takes_path_argument(token) and i + 1 < len(tokens):
                    next_token = tokens[i + 1]
                    if self._looks_like_path(next_token):
                        paths.append(next_token)
                    i += 1  # Skip the path argument
                i += 1
                continue
            
            # Check if token looks like a path
            if self._looks_like_path(token):
                paths.append(token)
            
            i += 1
        
        # Extract paths from redirections and pipes
        paths.extend(self._extract_redirection_paths(command))
        
        # Extract paths from command substitutions (if any slipped through)
        paths.extend(self._extract_substitution_paths(command))
        
        return list(set(paths))  # Remove duplicates
    
    def _flag_takes_path_argument(self, flag: str) -> bool:
        """Check if a flag typically takes a path as its argument."""
        path_flags = {
            '-f', '--file', '-o', '--output', '-i', '--input',
            '-d', '--directory', '-p', '--path', '-c', '--config',
            '--include', '--exclude', '--from', '--to'
        }
        return flag in path_flags
    
    def _extract_redirection_paths(self, command: str) -> List[str]:
        """Extract paths from redirection operators."""
        import re
        paths = []
        
        # Match redirection patterns: >, >>, <, |, tee, etc.
        redirection_patterns = [
            r'\s+>\s*([^\s]+)',   # stdout redirect
            r'\s+>>\s*([^\s]+)',  # stdout append
            r'\s+<\s*([^\s]+)',   # stdin redirect
            r'\s+2>\s*([^\s]+)',  # stderr redirect
            r'\s+&>\s*([^\s]+)',  # both stdout/stderr
            r'tee\s+([^\s|]+)',   # tee command
        ]
        
        for pattern in redirection_patterns:
            matches = re.findall(pattern, command)
            for match in matches:
                if self._looks_like_path(match):
                    paths.append(match)
        
        return paths
    
    def _extract_substitution_paths(self, command: str) -> List[str]:
        """Extract paths from command substitutions (for additional safety)."""
        import re
        paths = []
        
        # Look for paths in command substitutions
        substitution_patterns = [
            r'\$\(.*?([^\s)]+\.[a-zA-Z0-9]+).*?\)',  # $(... file.ext ...)
            r'`.*?([^\s`]+\.[a-zA-Z0-9]+).*?`',       # `... file.ext ...`
        ]
        
        for pattern in substitution_patterns:
            matches = re.findall(pattern, command)
            for match in matches:
                if self._looks_like_path(match):
                    paths.append(match)
        
        return paths
    
    def _looks_like_path(self, token: str) -> bool:
        """Enhanced check if a token looks like a file path."""
        if not token or len(token) > 4096:  # Reasonable path length limit
            return False
        
        # Clear path indicators
        if '/' in token or '\\' in token:
            return True
        
        if token.startswith(('~', './', '../', '.\\', '..\\')):
            return True
        
        # Absolute path indicators
        if token.startswith(('/', '\\', 'C:', 'D:', 'E:', 'F:')):
            return True
        
        # Check for file extensions (but be more careful)
        if '.' in token:
            parts = token.split('.')
            if len(parts) >= 2:
                extension = parts[-1]
                # Common file extensions
                if extension.lower() in {
                    'txt', 'py', 'js', 'html', 'css', 'json', 'xml', 'yaml', 'yml',
                    'md', 'rst', 'log', 'conf', 'cfg', 'ini', 'toml', 'sh', 'bat',
                    'csv', 'tsv', 'sql', 'dockerfile', 'gitignore', 'env', 'lock',
                    'tar', 'gz', 'zip', 'rar', '7z', 'bz2', 'xz',
                    'jpg', 'jpeg', 'png', 'gif', 'svg', 'pdf', 'doc', 'docx'
                }:
                    return True
                # Extensions up to 4 characters (but exclude obvious non-paths)
                if len(extension) <= 4 and extension.isalnum() and not extension.isdigit():
                    return True
        
        # Check for common directory names that might be paths
        common_dirs = {
            'src', 'lib', 'bin', 'etc', 'var', 'tmp', 'home', 'usr', 'opt',
            'build', 'dist', 'node_modules', '__pycache__', '.git', '.svn',
            'docs', 'tests', 'test', 'examples', 'assets', 'static', 'public'
        }
        if token in common_dirs:
            return True
        
        return False
    
    def _is_path_within_project_root(self, path: Path) -> bool:
        """Check if a path is within the project root."""
        try:
            path.resolve().relative_to(self.project_root)
            return True
        except ValueError:
            return False
    
    def _contains_path_traversal(self, path_str: str) -> bool:
        """Check for path traversal attempts."""
        # Normalize path separators
        normalized = path_str.replace('\\', '/')
        
        # Check for obvious traversal patterns
        traversal_patterns = [
            '../', '..\\', '..\x2f', '..\x5c',  # Basic traversal
            '%2e%2e%2f', '%2e%2e%5c',           # URL encoded
            '..%2f', '..%5c',                   # Partial URL encoded
            '..../', '....\\',                  # Double dot
            '...//', '...\\\\',                  # Triple dot
            '\x2e\x2e\x2f', '\x2e\x2e\x5c',    # Hex encoded
        ]
        
        for pattern in traversal_patterns:
            if pattern in normalized.lower():
                return True
        
        # Check for excessive parent directory references
        if normalized.count('../') > 5 or normalized.count('..\\') > 5:
            return True
        
        return False
    
    def _is_dangerous_path(self, path_str: str) -> bool:
        """Check for dangerous path patterns."""
        dangerous_patterns = [
            # System directories
            '/etc/', '/bin/', '/sbin/', '/usr/bin/', '/usr/sbin/',
            '/boot/', '/sys/', '/proc/', '/dev/',
            # Windows system paths
            'C:\\Windows\\', 'C:\\Program Files\\', 'C:\\System32\\',
            # Common sensitive files
            '/etc/passwd', '/etc/shadow', '/etc/hosts', '/etc/fstab',
            '.ssh/', '.aws/', '.kube/', '.docker/',
            # Hidden/dot files that might be sensitive
            '.env', '.secret', '.key', '.pem', '.p12', '.pfx',
            # Database files
            '.db', '.sqlite', '.mdb',
            # Configuration that might contain secrets
            'config.json', 'secrets.json', 'credentials.json',
        ]
        
        path_lower = path_str.lower()
        for pattern in dangerous_patterns:
            if pattern.lower() in path_lower:
                return True
        
        return False
    
    def _contains_symlink_exploits(self, path_str: str) -> bool:
        """Check for potential symlink exploitation attempts."""
        # Check for suspicious symlink-like patterns
        if path_str.startswith('/proc/self/'):
            return True
        
        if path_str.startswith('/dev/fd/'):
            return True
        
        # Check for null bytes and other control characters
        if '\x00' in path_str or any(ord(c) < 32 for c in path_str if c not in '\t\n\r'):
            return True
        
        return False
    
    def _is_allowed_absolute_path(self, path_str: str) -> bool:
        """Check if an absolute path is allowed (very restrictive)."""
        # For now, only allow absolute paths within known safe directories
        # that are commonly used in development
        allowed_prefixes = [
            '/tmp/',
            '/var/tmp/',
            str(self.project_root),
            '/home/' + os.getenv('USER', '') + '/',  # User's home directory
        ]
        
        for prefix in allowed_prefixes:
            if path_str.startswith(prefix):
                return True
        
        return False
    
    def _is_sensitive_project_path(self, resolved_path: Path) -> bool:
        """Check if path accesses sensitive directories within the project."""
        try:
            relative_path = resolved_path.relative_to(self.project_root)
            path_str = str(relative_path).lower()
            
            # Sensitive directories/files within project
            sensitive_patterns = [
                '.git/', '.svn/', '.hg/',           # Version control
                '.env', '.secrets', '.credentials',  # Environment/secrets
                'node_modules/.cache/',             # Cache directories
                '__pycache__/',                     # Python cache
                '.pytest_cache/',                   # Test cache
                'venv/', 'env/', '.venv/',          # Virtual environments
                'private/', 'confidential/',        # Obvious sensitive dirs
                'keys/', 'certs/', 'ssl/',          # Cryptographic materials
            ]
            
            for pattern in sensitive_patterns:
                if pattern in path_str:
                    return True
            
            return False
            
        except ValueError:
            # If we can't get relative path, be conservative
            return True
    
    def get_safe_command_suggestions(self) -> List[str]:
        """Get list of safe command suggestions."""
        return [
            "ls - list directory contents",
            "find - search for files and directories",
            "grep - search text in files",
            "cat - display file contents",
            "head - show first lines of file",
            "tail - show last lines of file",
            "wc - count lines, words, characters",
            "sort - sort lines of text",
            "uniq - remove duplicate lines",
            "cut - extract columns from text",
            "sed - stream editor for filtering and transforming text",
            "awk - pattern scanning and processing language",
            "mkdir - create directories",
            "touch - create empty files",
            "cp - copy files and directories",
            "mv - move/rename files and directories",
            "pwd - print working directory",
            "whoami - print current username",
            "uname - system information",
            "date - display or set date",
            "df - display filesystem disk space usage",
            "du - display directory space usage",
            "ps - display running processes",
            "which - locate command",
            "file - determine file type",
            "basename - strip directory and suffix from filename",
            "dirname - strip last component from file name",
            "realpath - print resolved path",
            "stat - display file or file system status",
            "echo - display text",
            "printf - format and print text",
            "tr - translate or delete characters",
            "xargs - execute command with arguments from input"
        ]
    
    def sanitize_output(self, output: str) -> str:
        """Sanitize command output to remove potentially sensitive information."""
        # Remove potential passwords or secrets
        lines = output.split('\n')
        sanitized_lines = []
        
        for line in lines:
            # Skip lines that might contain sensitive information
            if any(keyword in line.lower() for keyword in ['password', 'secret', 'token', 'key', 'auth']):
                sanitized_lines.append("[POTENTIALLY SENSITIVE LINE REMOVED]")
            else:
                sanitized_lines.append(line)
        
        return '\n'.join(sanitized_lines)
    
    def check_command_timeout(self, command: str) -> int:
        """Determine appropriate timeout for a command."""
        # Commands that typically take longer
        long_running_commands = {
            'find', 'grep', 'sort', 'cp', 'mv', 'tar', 'gzip', 'gunzip',
            'zip', 'unzip', 'wget', 'curl', 'rsync', 'scp'
        }
        
        tokens = shlex.split(command)
        if tokens and tokens[0] in long_running_commands:
            return 60  # 60 seconds for potentially long-running commands
        
        return 10  # 10 seconds for most commands
    
    def _perform_advanced_security_checks(self, command: str, tokens: List[str]) -> Tuple[bool, str]:
        """Perform comprehensive security validation on the command."""
        # Check for command chaining
        if self._contains_command_chaining(command):
            return False, "Command chaining not allowed"
        
        # Check for command substitution
        if self._contains_command_substitution(command):
            return False, "Command substitution not allowed"
        
        # Check for dangerous redirections
        if self._contains_dangerous_redirection(command):
            return False, "Dangerous redirection detected"
        
        # Check for shell escape attempts
        if self._contains_shell_escapes(command):
            return False, "Shell escape attempt detected"
        
        # Check for network access attempts
        if self._attempts_network_access(command, tokens):
            return False, "Network access not allowed"
        
        # Check for privilege escalation attempts
        if self._attempts_privilege_escalation(command, tokens):
            return False, "Privilege escalation attempt detected"
        
        # Check command length (prevent buffer overflow attempts)
        if len(command) > 8192:
            return False, "Command too long"
        
        return True, "Advanced security checks passed"
    
    def _contains_command_chaining(self, command: str) -> bool:
        """Check for command chaining patterns."""
        chaining_patterns = [
            ' && ', ' || ', ' ; ', ';', '\n', '\r\n',
            ' | ', '|&',  # Pipes can be used for chaining
            '&', '\x26',  # Background execution
        ]
        
        for pattern in chaining_patterns:
            if pattern in command:
                return True
        
        return False
    
    def _contains_command_substitution(self, command: str) -> bool:
        """Check for command substitution patterns."""
        substitution_patterns = [
            '$(', '`', '<(', '>(', '${',
            '\x24\x28', '\x60',  # Hex encoded
            '%24%28', '%60',     # URL encoded
            '\\$(', '\\`',       # Escaped (might be double-escaped)
        ]
        
        for pattern in substitution_patterns:
            if pattern in command:
                return True
        
        return False
    
    def _contains_dangerous_redirection(self, command: str) -> bool:
        """Check for dangerous redirection patterns."""
        dangerous_redirections = [
            ' > /', ' >> /', ' < /',      # Absolute path redirections
            ' > /dev/', ' >> /dev/',      # Device redirections
            ' > /proc/', ' >> /proc/',    # Process filesystem
            ' > /sys/', ' >> /sys/',      # System filesystem
            '>/dev/', '>>/dev/',          # Without spaces
            '2> /', '2>> /', '&> /',      # Error redirections
            ' | sudo', ' | su',           # Pipe to privilege escalation
        ]
        
        for pattern in dangerous_redirections:
            if pattern in command:
                return True
        
        return False
    
    def _contains_shell_escapes(self, command: str) -> bool:
        """Check for shell escape attempts."""
        escape_patterns = [
            '\\x', '\\u', '\\U',        # Unicode/hex escapes
            '\\n', '\\r', '\\t',        # Control characters
            '\\0', '\\a', '\\b',        # More control characters
            '$IFS', '${IFS}',            # Internal Field Separator tricks
            '$PATH', '${PATH}',          # Path manipulation
            '$HOME', '${HOME}',          # Home directory access
            '\\"', "\\'",                 # Quote escaping
            '$(printf', '$(echo',        # Printf/echo tricks
            'eval ', 'exec ',            # Dynamic execution
            'source ', '. /',            # Script sourcing
        ]
        
        for pattern in escape_patterns:
            if pattern in command:
                return True
        
        return False
    
    def _attempts_network_access(self, command: str, tokens: List[str]) -> bool:
        """Check for network access attempts."""
        network_commands = {
            'curl', 'wget', 'nc', 'netcat', 'ncat', 'socat',
            'ssh', 'scp', 'sftp', 'rsync', 'ftp', 'tftp',
            'telnet', 'ping', 'dig', 'nslookup', 'host',
            'mail', 'sendmail', 'mutt',
        }
        
        if tokens and tokens[0] in network_commands:
            return True
        
        # Check for URLs or IP addresses in command
        import re
        url_pattern = r'https?://|ftp://|sftp://'
        ip_pattern = r'\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b'
        
        if re.search(url_pattern, command) or re.search(ip_pattern, command):
            return True
        
        return False
    
    def _attempts_privilege_escalation(self, command: str, tokens: List[str]) -> bool:
        """Check for privilege escalation attempts."""
        privilege_commands = {
            'sudo', 'su', 'doas', 'runas',
            'pkexec', 'gksudo', 'kdesudo',
            'chmod', 'chown', 'chgrp',     # File permission changes
            'mount', 'umount',             # Filesystem mounting
            'systemctl', 'service',        # Service management
            'iptables', 'ufw', 'firewall-cmd',  # Firewall
        }
        
        if tokens and tokens[0] in privilege_commands:
            return True
        
        # Check for SUID/SGID manipulation
        if any(pattern in command for pattern in ['+s', 'u+s', 'g+s', '4755', '2755']):
            return True
        
        return False