# /init Command Fix - Detailed Implementation Plan

## Issue Summary
**Problem**: Actor agent cannot execute bash commands during `/init` investigation phase
**Root Cause**: Tool instructions not properly provided - Actor gets "cannot use commands" message
**Solution**: Temporarily override operation mode during investigation phase

---

## Step-by-Step Implementation Plan

### Phase 1: Immediate Fix (Minimal Change)

#### Step 1.1: Identify the Exact Fix Location
**File**: `termaite/core/application.py`
**Method**: `initialize_project_prompts()`
**Target Lines**: Around line 564-566 where investigation task is called

```python
# Current problematic code:
investigation_success = self.handle_task(
    project_investigation_prompt, agentic_mode=True
)
```

#### Step 1.2: Implement Temporary Operation Mode Override
**Action**: Wrap the investigation task with operation mode override

**Before Investigation**:
```python
# Store original operation mode
original_operation_mode = self.config.get("operation_mode", "normal")

# Temporarily set to gremlin mode for investigation
self.config["operation_mode"] = "gremlin"
logger.debug(f"Temporarily set operation mode to 'gremlin' for /init investigation (was '{original_operation_mode}')")
```

**During Investigation**:
```python
try:
    investigation_success = self.handle_task(
        project_investigation_prompt, agentic_mode=True
    )
    if not investigation_success:
        logger.error("Failed to investigate project directory")
        return False
finally:
    # Always restore original operation mode
    self.config["operation_mode"] = original_operation_mode
    logger.debug(f"Restored operation mode to '{original_operation_mode}' after /init investigation")
```

#### Step 1.3: Add Debug Logging
**Purpose**: Verify the fix is working
**Location**: Same method, add logging to confirm mode changes

```python
logger.debug(f"Operation mode for investigation: {self.config.get('operation_mode')}")
```

### Phase 2: Testing the Fix

#### Step 2.1: Unit Test Verification
**File**: `tests/test_project_initialization.py`
**Test**: Verify operation mode is properly restored after /init

```python
def test_init_preserves_operation_mode(self):
    """Test that /init preserves original operation mode."""
    app = create_test_app()
    original_mode = "normal"
    app.config["operation_mode"] = original_mode
    
    # Mock handle_task to avoid actual LLM calls
    with patch.object(app, 'handle_task', return_value=True):
        app.initialize_project_prompts()
    
    # Verify operation mode was restored
    assert app.config["operation_mode"] == original_mode
```

#### Step 2.2: Integration Test
**Test**: Run `/init` in a new directory and verify Actor can execute commands
**Expected**: Should see Actor executing `ls`, `cat`, etc. commands during investigation

### Phase 3: Code Quality Improvements (Future)

#### Step 3.1: Long-term Architecture Fix
**Goal**: Remove DRY violations and properly integrate with agentic mode

**Current Issues**:
- `/init` duplicates task handling logic
- Separate prompt customization workflow
- Not leveraging existing Plan-Act-Evaluate infrastructure

**Proposed Solution**:
- Create specialized investigation prompts that work with standard agentic mode
- Ensure proper tool configuration from initialization
- Remove duplicate logic

#### Step 3.2: Configuration Improvement
**Goal**: Ensure investigation commands are always available

**Options**:
1. Default investigation commands in all configs
2. Special investigation mode that bypasses normal restrictions
3. Dynamic command allowlist during investigation

---

## Implementation Details

### Code Location and Changes

**File**: `termaite/core/application.py`
**Method**: `initialize_project_prompts()` (around line 560-570)

**Exact Change**:
```python
# Step 1: Investigate the project
logger.system("🔍 Step 1: Investigating project directory...")
project_investigation_prompt = self._create_project_investigation_prompt()

# Temporarily set permissive mode for investigation
original_operation_mode = self.config.get("operation_mode", "normal")
self.config["operation_mode"] = "gremlin"  # Allow any commands for investigation
logger.debug(f"Temporarily set operation mode to 'gremlin' for investigation (was '{original_operation_mode}')")

try:
    # Use agentic mode to investigate the project
    investigation_success = self.handle_task(
        project_investigation_prompt, agentic_mode=True
    )
    if not investigation_success:
        logger.error("Failed to investigate project directory")
        return False
finally:
    # Restore original operation mode
    self.config["operation_mode"] = original_operation_mode
    logger.debug(f"Restored operation mode to '{original_operation_mode}'")
```

### Why Gremlin Mode?
- **Gremlin Mode**: Allows any commands but prompts for permission on unknown commands
- **Goblin Mode**: Allows any commands without prompts (too permissive)
- **Normal Mode**: Requires predefined allowed commands (the current problem)

Gremlin mode strikes the right balance for investigation: Actor can suggest any command needed for investigation.

---

## Risk Assessment

### Low Risk
- **Scope**: Change is isolated to `/init` investigation phase only
- **Temporary**: Operation mode is always restored via try/finally
- **Backwards Compatible**: No breaking changes to existing functionality

### Mitigation
- **Error Handling**: try/finally ensures mode is always restored
- **Logging**: Debug logs verify mode changes are working correctly
- **Testing**: Unit tests verify behavior

---

## Testing Strategy

### Manual Testing
1. Run `/init` in a fresh directory with default config
2. Verify Actor executes commands during investigation (should see `ls`, `cat` commands)
3. Verify operation mode is restored after completion
4. Test with different initial operation modes (normal, gremlin, goblin)

### Automated Testing
1. Unit test for operation mode preservation
2. Integration test for Actor command execution during `/init`
3. Test error scenarios (failed investigation, exceptions)

---

## Success Criteria

### Immediate Fix Success
- [ ] Actor successfully executes bash commands during `/init` investigation
- [ ] Operation mode is properly restored after investigation
- [ ] No breaking changes to existing `/init` functionality
- [ ] Debug logs confirm mode changes are working

### Long-term Success  
- [ ] `/init` properly integrates with agentic mode infrastructure
- [ ] No code duplication between `/init` and normal agentic operations
- [ ] Investigation commands are always available regardless of user config

---

## Implementation Timeline

1. **Immediate**: Implement temporary operation mode override (1-2 hours)
2. **Short-term**: Add comprehensive testing (2-3 hours)
3. **Long-term**: Architectural improvements and DRY compliance (1-2 days)

This plan provides a quick fix for the immediate issue while laying groundwork for proper long-term architectural improvements.