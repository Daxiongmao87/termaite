#!/usr/bin/env python3
"""
Test the --init functionality.
"""

import os
import sys
import tempfile
from pathlib import Path

# Add the project root to the path
sys.path.insert(0, os.path.abspath('.'))

def test_init_basic():
    """Test basic --init functionality."""
    from termaite.core.project_init import ProjectInitializer
    from termaite.config.manager import ConfigManager
    
    print("Testing project initialization...")
    
    # Test in current directory
    config_manager = ConfigManager()
    initializer = ProjectInitializer(config_manager)
    
    # Remove existing .TERMAITE.md if it exists
    termaite_file = Path('.TERMAITE.md')
    if termaite_file.exists():
        termaite_file.unlink()
    
    # Initialize project
    success = initializer.initialize_project()
    
    if success:
        print("✅ Project initialization succeeded")
        
        # Check if file was created
        if termaite_file.exists():
            print("✅ .TERMAITE.md file created")
            
            # Check file content
            content = termaite_file.read_text()
            if "Term.Ai.Te Project" in content:
                print("✅ File contains expected project name")
            else:
                print("❌ File doesn't contain expected project name")
                
            if "Python" in content:
                print("✅ File contains expected project type")
            else:
                print("❌ File doesn't contain expected project type")
                
        else:
            print("❌ .TERMAITE.md file was not created")
    else:
        print("❌ Project initialization failed")
        
    return success

def test_project_discovery():
    """Test project discovery functionality."""
    from termaite.core.project_init import ProjectDiscovery
    
    print("\nTesting project discovery...")
    
    discovery = ProjectDiscovery()
    project_info = discovery.discover_project()
    
    print(f"✅ Project type: {project_info.project_type}")
    print(f"✅ Language: {project_info.language}")
    print(f"✅ Framework: {project_info.framework}")
    print(f"✅ Build system: {project_info.build_system}")
    print(f"✅ Description: {project_info.description}")
    print(f"✅ Key files: {len(project_info.key_files)} files")
    print(f"✅ Structure: {len(project_info.structure)} items")
    
    return True

def test_context_generation():
    """Test context generation."""
    from termaite.core.project_init import ProjectDiscovery, ContextGenerator
    from termaite.config.manager import ConfigManager
    
    print("\nTesting context generation...")
    
    # Discover project
    discovery = ProjectDiscovery()
    project_info = discovery.discover_project()
    
    # Generate context
    config_manager = ConfigManager()
    generator = ContextGenerator(config_manager)
    content = generator.generate_context(project_info)
    
    if content:
        print("✅ Context generated successfully")
        
        # Check for expected sections
        sections = ["Project Overview", "Description", "Project Structure", "Key Files", "Operational Guidance"]
        for section in sections:
            if section in content:
                print(f"✅ Contains {section} section")
            else:
                print(f"❌ Missing {section} section")
    else:
        print("❌ Context generation failed")
    
    return bool(content)

def test_different_project_types():
    """Test detection of different project types."""
    from termaite.core.project_init import ProjectDiscovery
    
    print("\nTesting different project types...")
    
    # Test with temporary directories
    test_cases = [
        {
            "files": ["package.json", "index.js"],
            "expected_type": "javascript"
        },
        {
            "files": ["go.mod", "main.go"],
            "expected_type": "go"
        },
        {
            "files": ["pom.xml", "Main.java"],
            "expected_type": "java"
        },
        {
            "files": ["Cargo.toml", "src/main.rs"],
            "expected_type": "rust"
        }
    ]
    
    for case in test_cases:
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            # Create test files
            for file_path in case["files"]:
                file_full_path = temp_path / file_path
                file_full_path.parent.mkdir(parents=True, exist_ok=True)
                file_full_path.write_text("# Test file")
            
            # Test discovery
            discovery = ProjectDiscovery(str(temp_path))
            project_info = discovery.discover_project()
            
            if project_info.project_type == case["expected_type"]:
                print(f"✅ Correctly detected {case['expected_type']} project")
            else:
                print(f"❌ Expected {case['expected_type']}, got {project_info.project_type}")

def main():
    """Run all tests."""
    print("Testing Termaite --init Functionality")
    print("=" * 40)
    
    tests = [
        test_project_discovery,
        test_context_generation,
        test_different_project_types,
        test_init_basic,
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            if test():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"❌ Test {test.__name__} failed with exception: {e}")
            failed += 1
    
    print(f"\n" + "=" * 40)
    print(f"Tests completed: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("🎉 All init functionality tests passed!")
        return 0
    else:
        print(f"❌ {failed} tests failed.")
        return 1

if __name__ == "__main__":
    sys.exit(main())