# Pre-Commit Hook Documentation

This project includes a comprehensive pre-commit hook that ensures code quality, testing, and security standards before allowing commits.

## Overview

The pre-commit hook automatically runs when you attempt to commit changes using `git commit`. It performs comprehensive checks including:

- **Code Quality**: Black formatting, Flake8 linting, syntax validation
- **Testing**: Unit tests with coverage reporting (minimum 50% coverage)
- **Security**: Basic security pattern detection
- **Best Practices**: File size checks, TODO/FIXME tracking

## What Gets Checked

### Phase 1: Code Quality Checks
1. **Python Syntax Check**: Ensures all Python files compile without syntax errors
2. **Black Formatting Check**: Verifies code follows Black formatting standards
3. **Flake8 Linting**: Checks for style violations and potential issues
4. **Import Check**: Ensures all modules can be imported successfully

### Phase 2: Testing & Coverage
5. **Basic Functionality Tests**: Quick smoke tests for core functionality
6. **Unit Tests with Coverage**: Runs the full test suite with coverage reporting
7. **Integration Tests**: Verifies key components work together

### Phase 3: Security & Best Practices
8. **Security Check**: Scans for potentially dangerous patterns in code
9. **TODO/FIXME Check**: Reports any TODO or FIXME comments
10. **Large File Check**: Warns about files larger than 1MB
11. **Coverage Report**: Generates final coverage summary

## Hook Location

The pre-commit hook is located at:
```
.git/modules/term.ai.te/hooks/pre-commit
```

## Requirements

Before the hook can run successfully, ensure you have:

1. **Virtual Environment**: The hook expects a `venv/` directory with required packages
2. **Required Packages**: Install development dependencies:
   ```bash
   pip install black flake8 pytest pytest-cov
   ```

## Running the Hook Manually

You can run the pre-commit checks manually at any time:

```bash
# Run the hook directly
.git/modules/term.ai.te/hooks/pre-commit

# Or test specific components
python -m black termaite/                    # Format code
python -m flake8 termaite/                   # Check linting
python -m pytest tests/ --cov=termaite      # Run tests with coverage
```

## What Happens on Failure

If the pre-commit hook fails:

1. **Critical Failures**: The commit is blocked and you must fix the issues
2. **Warnings**: The commit can proceed, but you're encouraged to address warnings

### Common Fixes

- **Formatting Issues**: Run `python -m black termaite/` to auto-format
- **Test Failures**: Fix failing tests in the `tests/` directory
- **Coverage Issues**: Add tests to increase coverage above 50%
- **Linting Issues**: Address specific flake8 warnings shown in output

## Hook Output

The hook provides colorful, informative output:

- 🟢 **Green**: Successful checks
- 🟡 **Yellow**: Warnings (non-blocking)
- 🔴 **Red**: Critical failures (blocking)
- 🔵 **Blue**: Informational messages

## Coverage Requirements

- **Minimum Coverage**: 50% (configurable in the hook)
- **Coverage Report**: Shows line-by-line coverage information
- **Missing Lines**: Identifies specific lines not covered by tests

## Security Checks

The hook scans for potentially dangerous patterns:

- `eval()`, `exec()`, `__import__`
- `subprocess.call`, `os.system`
- Context-aware checking (some patterns allowed in specific files)

## Bypassing the Hook

**⚠️ Not Recommended**: You can bypass the hook with:
```bash
git commit --no-verify
```

However, this should only be used in emergency situations as it skips all quality checks.

## Customization

### Adjusting Coverage Requirements

Edit the hook file and modify line 108:
```bash
run_coverage_check "Unit tests with coverage" "python -m pytest tests/ --cov=termaite --cov-report=term-missing --cov-fail-under=50 -v" 50
```

Change the final `50` to your desired minimum coverage percentage.

### Adding New Checks

Add new checks using the provided functions:

```bash
# For critical checks (will block commit)
run_check "My Check" "my_command_here"

# For warning-only checks
run_check "My Check" "my_command_here" false

# For coverage-based checks
run_coverage_check "My Coverage Check" "my_coverage_command" 75
```

## Troubleshooting

### Hook Not Running

1. Ensure the hook file is executable:
   ```bash
   chmod +x .git/modules/term.ai.te/hooks/pre-commit
   ```

2. Verify you're in a git repository with the correct setup

### Virtual Environment Issues

1. Ensure `venv/` exists and is activated
2. Install required packages:
   ```bash
   source venv/bin/activate
   pip install black flake8 pytest pytest-cov
   ```

### Permission Errors

Ensure the hook file has execute permissions:
```bash
ls -la .git/modules/term.ai.te/hooks/pre-commit
# Should show: -rwxr-xr-x
```

## Integration with Development Workflow

1. **Before Committing**: The hook runs automatically
2. **During Development**: Run checks manually to catch issues early
3. **CI/CD**: Consider running the same checks in your CI pipeline

## Best Practices

1. **Run Tests Locally**: Don't rely solely on the pre-commit hook
2. **Fix Issues Promptly**: Address warnings even if they don't block commits  
3. **Keep Coverage High**: Aim for >75% coverage for robust code
4. **Regular Updates**: Keep the hook updated as the project evolves

---

This comprehensive pre-commit hook ensures that all code meets quality standards before being committed, helping maintain a clean and reliable codebase.