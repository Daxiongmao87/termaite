"""
Project initialization system for termaite.
"""

import os
import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from ..config.manager import ConfigManager
from ..llm.client import LLMClient


@dataclass
class ProjectInfo:
    """Information about a discovered project."""
    project_type: str
    language: str
    framework: Optional[str]
    build_system: Optional[str]
    structure: List[str]
    key_files: List[str]
    description: str


class ProjectDiscovery:
    """Discovers and analyzes project structure."""
    
    def __init__(self, root_path: str = "."):
        self.root_path = Path(root_path).resolve()
        
        # Project type detection patterns
        self.project_patterns = {
            "python": {
                "files": ["requirements.txt", "setup.py", "pyproject.toml", "Pipfile"],
                "extensions": [".py"],
                "frameworks": {
                    "flask": ["app.py", "flask", "Flask"],
                    "django": ["manage.py", "django", "Django"],
                    "fastapi": ["fastapi", "FastAPI"],
                    "streamlit": ["streamlit"],
                    "pytest": ["pytest", "test_", "tests/"],
                }
            },
            "javascript": {
                "files": ["package.json", "package-lock.json", "yarn.lock"],
                "extensions": [".js", ".jsx", ".ts", ".tsx"],
                "frameworks": {
                    "react": ["react", "React"],
                    "vue": ["vue", "Vue"],
                    "angular": ["angular", "@angular"],
                    "express": ["express"],
                    "next": ["next", "Next"],
                    "nuxt": ["nuxt"],
                }
            },
            "go": {
                "files": ["go.mod", "go.sum", "main.go"],
                "extensions": [".go"],
                "frameworks": {
                    "gin": ["gin-gonic", "gin"],
                    "echo": ["echo"],
                    "fiber": ["fiber"],
                }
            },
            "java": {
                "files": ["pom.xml", "build.gradle", "build.gradle.kts"],
                "extensions": [".java"],
                "frameworks": {
                    "spring": ["spring", "Spring"],
                    "maven": ["pom.xml"],
                    "gradle": ["build.gradle"],
                }
            },
            "rust": {
                "files": ["Cargo.toml", "Cargo.lock"],
                "extensions": [".rs"],
                "frameworks": {
                    "axum": ["axum"],
                    "actix": ["actix"],
                    "rocket": ["rocket"],
                }
            },
            "php": {
                "files": ["composer.json", "composer.lock"],
                "extensions": [".php"],
                "frameworks": {
                    "laravel": ["laravel", "artisan"],
                    "symfony": ["symfony"],
                    "codeigniter": ["codeigniter"],
                }
            }
        }
    
    def discover_project(self) -> ProjectInfo:
        """Discover and analyze the current project."""
        # Scan directory structure
        structure = self._scan_structure()
        key_files = self._find_key_files()
        
        # Detect project type and language
        project_type, language = self._detect_project_type(key_files)
        
        # Detect framework
        framework = self._detect_framework(project_type, key_files, structure)
        
        # Detect build system
        build_system = self._detect_build_system(key_files)
        
        # Generate description
        description = self._generate_description(project_type, language, framework, build_system)
        
        return ProjectInfo(
            project_type=project_type,
            language=language,
            framework=framework,
            build_system=build_system,
            structure=structure,
            key_files=key_files,
            description=description
        )
    
    def _scan_structure(self) -> List[str]:
        """Scan directory structure."""
        structure = []
        
        try:
            for root, dirs, files in os.walk(self.root_path):
                # Skip hidden directories and common ignore patterns
                dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ['node_modules', '__pycache__', 'venv', 'env', 'target', 'build', 'dist']]
                
                rel_path = os.path.relpath(root, self.root_path)
                if rel_path == '.':
                    rel_path = ''
                
                if rel_path:
                    structure.append(f"📁 {rel_path}/")
                
                # Add important files
                for file in files:
                    if not file.startswith('.') and self._is_important_file(file):
                        file_path = os.path.join(rel_path, file) if rel_path else file
                        structure.append(f"📄 {file_path}")
                
                # Limit depth to avoid too much detail
                if len(structure) > 50:
                    break
                    
        except Exception as e:
            structure = [f"📁 {self.root_path.name}/", "📄 (structure scan limited)"]
        
        return structure[:30]  # Limit to reasonable size
    
    def _find_key_files(self) -> List[str]:
        """Find key files in the project."""
        key_files = []
        
        try:
            for root, dirs, files in os.walk(self.root_path):
                # Skip hidden and ignored directories
                dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ['node_modules', '__pycache__', 'venv', 'env', 'target', 'build', 'dist']]
                
                for file in files:
                    if self._is_key_file(file):
                        rel_path = os.path.relpath(os.path.join(root, file), self.root_path)
                        key_files.append(rel_path)
                        
        except Exception:
            pass
        
        return key_files
    
    def _is_important_file(self, filename: str) -> bool:
        """Check if a file is important for project understanding."""
        important_files = [
            "README.md", "README.txt", "README.rst",
            "requirements.txt", "package.json", "go.mod", "pom.xml", "build.gradle",
            "Cargo.toml", "composer.json", "setup.py", "pyproject.toml",
            "Dockerfile", "docker-compose.yml", "Makefile",
            "main.py", "app.py", "index.js", "main.js", "main.go",
            "manage.py", "server.py", "app.js"
        ]
        
        return filename in important_files or filename.endswith(('.py', '.js', '.go', '.java', '.rs', '.php'))[:10]
    
    def _is_key_file(self, filename: str) -> bool:
        """Check if a file is a key project file."""
        key_files = [
            "requirements.txt", "setup.py", "pyproject.toml", "Pipfile",
            "package.json", "package-lock.json", "yarn.lock",
            "go.mod", "go.sum", "main.go",
            "pom.xml", "build.gradle", "build.gradle.kts",
            "Cargo.toml", "Cargo.lock",
            "composer.json", "composer.lock",
            "Dockerfile", "docker-compose.yml",
            "Makefile", "CMakeLists.txt",
            "README.md", "README.txt", "README.rst",
            ".gitignore", ".env", ".env.example"
        ]
        
        return filename in key_files
    
    def _detect_project_type(self, key_files: List[str]) -> Tuple[str, str]:
        """Detect project type and primary language."""
        for project_type, patterns in self.project_patterns.items():
            # Check for key files
            for file in patterns["files"]:
                if file in key_files:
                    return project_type, project_type
            
            # Check for file extensions
            for key_file in key_files:
                for ext in patterns["extensions"]:
                    if key_file.endswith(ext):
                        return project_type, project_type
        
        return "unknown", "unknown"
    
    def _detect_framework(self, project_type: str, key_files: List[str], structure: List[str]) -> Optional[str]:
        """Detect framework being used."""
        if project_type not in self.project_patterns:
            return None
            
        frameworks = self.project_patterns[project_type].get("frameworks", {})
        
        # Check key files content and structure
        all_content = " ".join(key_files + structure).lower()
        
        for framework, indicators in frameworks.items():
            for indicator in indicators:
                if indicator.lower() in all_content:
                    return framework
        
        return None
    
    def _detect_build_system(self, key_files: List[str]) -> Optional[str]:
        """Detect build system."""
        build_systems = {
            "pip": ["requirements.txt", "setup.py", "pyproject.toml"],
            "npm": ["package.json", "package-lock.json"],
            "yarn": ["yarn.lock"],
            "go_modules": ["go.mod"],
            "maven": ["pom.xml"],
            "gradle": ["build.gradle", "build.gradle.kts"],
            "cargo": ["Cargo.toml"],
            "composer": ["composer.json"],
            "make": ["Makefile"],
            "cmake": ["CMakeLists.txt"],
            "docker": ["Dockerfile"]
        }
        
        for build_system, files in build_systems.items():
            for file in files:
                if file in key_files:
                    return build_system
        
        return None
    
    def _generate_description(self, project_type: str, language: str, framework: Optional[str], build_system: Optional[str]) -> str:
        """Generate a project description."""
        if project_type == "unknown":
            return "Unknown project type"
        
        desc = f"{project_type.title()} project"
        
        if framework:
            desc += f" using {framework.title()}"
        
        if build_system:
            desc += f" with {build_system} build system"
        
        return desc


class ContextGenerator:
    """Generates .TERMAITE.md context files."""
    
    def __init__(self, config_manager: ConfigManager):
        self.config_manager = config_manager
        self.llm_client = None
        
        # Try to initialize LLM client
        try:
            self.llm_client = LLMClient(config_manager)
        except Exception:
            pass
    
    def generate_context(self, project_info: ProjectInfo, root_path: str = ".") -> str:
        """Generate .TERMAITE.md content."""
        if self.llm_client:
            return self._generate_with_llm(project_info, root_path)
        else:
            return self._generate_template(project_info, root_path)
    
    def _generate_with_llm(self, project_info: ProjectInfo, root_path: str) -> str:
        """Generate context using LLM."""
        try:
            # Create prompt for LLM
            prompt = self._create_generation_prompt(project_info, root_path)
            
            # Use LLM to generate context
            messages = [
                {"role": "system", "content": "You are a helpful assistant that creates project context files. Create a comprehensive .TERMAITE.md file based on the project information provided."},
                {"role": "user", "content": prompt}
            ]
            
            response = self.llm_client._make_request(messages, temperature=0.3)
            
            # Extract content from response
            try:
                import json
                response_data = json.loads(response)
                content = response_data.get("choices", [{}])[0].get("message", {}).get("content", "")
                
                if content:
                    return content
            except:
                pass
            
            # Fallback to template
            return self._generate_template(project_info, root_path)
            
        except Exception:
            return self._generate_template(project_info, root_path)
    
    def _create_generation_prompt(self, project_info: ProjectInfo, root_path: str) -> str:
        """Create prompt for LLM generation."""
        return f"""
Create a .TERMAITE.md file for this project:

**Project Information:**
- Type: {project_info.project_type}
- Language: {project_info.language}
- Framework: {project_info.framework or 'None'}
- Build System: {project_info.build_system or 'None'}
- Description: {project_info.description}

**Project Structure:**
{chr(10).join(project_info.structure)}

**Key Files:**
{chr(10).join(project_info.key_files)}

**Requirements:**
1. Create a project purpose and description
2. List key features and functionality
3. Provide project structure overview
4. Include general operational guidance for {project_info.project_type} projects (not project-specific)
5. Keep it concise but informative
6. Use markdown format

The file should help an AI assistant understand this project type and provide better assistance.
"""
    
    def _generate_template(self, project_info: ProjectInfo, root_path: str) -> str:
        """Generate context using template."""
        project_name = Path(root_path).resolve().name
        template = f"""# {project_name.replace('_', ' ').replace('-', ' ').title()} Project

## Project Overview

**Type:** {project_info.project_type.title()}  
**Language:** {project_info.language.title()}  
**Framework:** {project_info.framework.title() if project_info.framework else 'None'}  
**Build System:** {project_info.build_system or 'None'}  

## Description

{project_info.description}

## Project Structure

```
{chr(10).join(project_info.structure)}
```

## Key Files

{chr(10).join(f"- `{file}`" for file in project_info.key_files)}

## Operational Guidance

### {project_info.project_type.title()} Development Best Practices

{self._get_project_guidance(project_info.project_type, project_info.framework)}

### Common Commands

{self._get_common_commands(project_info.project_type, project_info.build_system)}

### Development Workflow

{self._get_workflow_guidance(project_info.project_type, project_info.framework)}

---

*This file was generated by Termaite project initialization. Update this file when the project structure or purpose changes significantly.*
"""
        return template
    
    def _get_project_guidance(self, project_type: str, framework: Optional[str]) -> str:
        """Get project-specific guidance."""
        guidance = {
            "python": {
                "general": "- Use virtual environments for dependency isolation\n- Follow PEP 8 style guidelines\n- Use type hints for better code documentation\n- Write unit tests with pytest or unittest\n- Use requirements.txt or pyproject.toml for dependencies",
                "flask": "- Organize code with blueprints for larger applications\n- Use Flask-SQLAlchemy for database operations\n- Implement proper error handling and logging\n- Use environment variables for configuration",
                "django": "- Follow Django's MVT (Model-View-Template) pattern\n- Use Django ORM for database operations\n- Implement proper URL routing and middleware\n- Use Django's built-in admin interface"
            },
            "javascript": {
                "general": "- Use package.json for dependency management\n- Follow ES6+ modern JavaScript standards\n- Use proper module imports/exports\n- Implement proper error handling and logging\n- Use npm or yarn for package management",
                "react": "- Use functional components with hooks\n- Implement proper state management\n- Use React Router for navigation\n- Follow component-based architecture",
                "express": "- Use middleware for request processing\n- Implement proper route organization\n- Use environment variables for configuration\n- Implement proper error handling middleware"
            },
            "go": {
                "general": "- Use go modules for dependency management\n- Follow Go naming conventions\n- Use proper error handling patterns\n- Write tests with go test\n- Use go fmt for code formatting"
            }
        }
        
        if project_type in guidance:
            if framework and framework in guidance[project_type]:
                return guidance[project_type][framework]
            else:
                return guidance[project_type]["general"]
        
        return f"- Follow {project_type} best practices\n- Use appropriate testing frameworks\n- Implement proper error handling\n- Use version control effectively"
    
    def _get_common_commands(self, project_type: str, build_system: Optional[str]) -> str:
        """Get common commands for project type."""
        commands = {
            "python": {
                "pip": "```bash\npip install -r requirements.txt  # Install dependencies\npython -m pytest                 # Run tests\npython app.py                     # Run application\n```",
                "general": "```bash\npython -m venv venv              # Create virtual environment\nsource venv/bin/activate         # Activate virtual environment\npython script.py                 # Run Python script\n```"
            },
            "javascript": {
                "npm": "```bash\nnpm install                      # Install dependencies\nnpm start                        # Start development server\nnpm test                         # Run tests\nnpm run build                    # Build for production\n```",
                "yarn": "```bash\nyarn install                     # Install dependencies\nyarn start                       # Start development server\nyarn test                        # Run tests\nyarn build                       # Build for production\n```"
            },
            "go": {
                "go_modules": "```bash\ngo mod tidy                      # Clean up dependencies\ngo run main.go                   # Run application\ngo test ./...                    # Run tests\ngo build                         # Build executable\n```"
            }
        }
        
        if project_type in commands:
            if build_system and build_system in commands[project_type]:
                return commands[project_type][build_system]
            else:
                return commands[project_type].get("general", "")
        
        return f"```bash\n# Add common {project_type} commands here\n```"
    
    def _get_workflow_guidance(self, project_type: str, framework: Optional[str]) -> str:
        """Get workflow guidance."""
        workflows = {
            "python": "1. Set up virtual environment\n2. Install dependencies\n3. Write/modify code\n4. Run tests\n5. Run application locally\n6. Deploy to production",
            "javascript": "1. Install dependencies\n2. Start development server\n3. Write/modify code\n4. Run tests\n5. Build for production\n6. Deploy application",
            "go": "1. Initialize/update go modules\n2. Write/modify code\n3. Run tests\n4. Build executable\n5. Deploy application"
        }
        
        return workflows.get(project_type, "1. Set up development environment\n2. Write/modify code\n3. Test changes\n4. Deploy application")


class ProjectInitializer:
    """Main project initialization coordinator."""
    
    def __init__(self, config_manager: ConfigManager):
        self.config_manager = config_manager
        self.discovery = ProjectDiscovery()
        self.generator = ContextGenerator(config_manager)
    
    def initialize_project(self, root_path: str = ".") -> bool:
        """Initialize project with .TERMAITE.md file."""
        try:
            # Discover project
            print("🔍 Analyzing project structure...")
            project_info = self.discovery.discover_project()
            
            print(f"📋 Detected: {project_info.description}")
            
            # Generate context
            print("📝 Generating project context...")
            context_content = self.generator.generate_context(project_info, root_path)
            
            # Write .TERMAITE.md file
            context_file = Path(root_path) / ".TERMAITE.md"
            with open(context_file, 'w') as f:
                f.write(context_content)
            
            print(f"✅ Created {context_file}")
            print(f"📄 Project context file created successfully!")
            
            return True
            
        except Exception as e:
            print(f"❌ Error initializing project: {e}")
            return False
    
    def load_project_context(self, root_path: str = ".") -> Optional[str]:
        """Load .TERMAITE.md content if it exists."""
        try:
            context_file = Path(root_path) / ".TERMAITE.md"
            if context_file.exists():
                with open(context_file, 'r', encoding='utf-8') as f:
                    return f.read()
            return None
        except Exception as e:
            print(f"Warning: Could not load .TERMAITE.md: {e}")
            return None
    
    def get_project_context_for_llm(self, root_path: str = ".") -> str:
        """Get project context formatted for LLM system prompt."""
        context = self.load_project_context(root_path)
        if context:
            return f"\n\n# PROJECT CONTEXT\n\n{context}\n\n"
        return ""