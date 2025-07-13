"""Utility functions and helpers for termaite."""

from .helpers import (
    check_dependencies,
    ensure_directory_exists,
    format_template_string,
    get_current_context,
    get_nested_value,
    safe_file_write,
    validate_file_path,
)
from .logging import get_current_timestamp, log_message, logger

__all__ = [
    "logger",
    "log_message",
    "get_current_timestamp",
    "check_dependencies",
    "get_nested_value",
    "get_current_context",
    "format_template_string",
    "ensure_directory_exists",
    "validate_file_path",
    "safe_file_write",
]
