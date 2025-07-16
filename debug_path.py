#!/usr/bin/env python3

import tempfile
import os
from pathlib import Path

# Create temp directory and test path validation
temp_dir = tempfile.mkdtemp()
os.chdir(temp_dir)

# Create config-like structure
class MockConfig:
    def __init__(self):
        self.security = MockSecurity()

class MockSecurity:
    def __init__(self):
        self.project_root = "."

# Test path resolution
config = MockConfig()
project_root = Path(config.security.project_root).resolve()
print(f"Project root: {project_root}")
print(f"Temp dir: {temp_dir}")
print(f"Are they equal? {project_root == Path(temp_dir)}")
print(f"Absolute temp dir: {os.path.abspath(temp_dir)}")
print(f"Absolute project root: {os.path.abspath(config.security.project_root)}")

# Test subdirectory validation
subdir = os.path.join(temp_dir, "subdir")
os.makedirs(subdir)
print(f"Subdir: {subdir}")

# Test relative_to
try:
    Path(subdir).resolve().relative_to(project_root)
    print(f"Subdir is within project root: True")
except ValueError as e:
    print(f"Subdir is within project root: False - {e}")

# Cleanup
import shutil
shutil.rmtree(temp_dir)