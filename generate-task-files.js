#!/usr/bin/env node

/**
 * Script to automatically generate individual task files from COPILOT_IMPLEMENTATION_TASK_LIST.md
 */

const fs = require('fs');
const path = require('path');

// Read the master task list
const masterTaskFile = path.join(__dirname, 'COPILOT_IMPLEMENTATION_TASK_LIST.md');
const outputDir = path.join(__dirname, 'UX_REFACTOR_FOLDER');

console.log('Looking for master task file at:', masterTaskFile);
console.log('Output directory:', outputDir);

if (!fs.existsSync(masterTaskFile)) {
  console.error('Master task file not found:', masterTaskFile);
  process.exit(1);
}

console.log('Reading master task file...');
const masterContent = fs.readFileSync(masterTaskFile, 'utf8');
console.log('Master file length:', masterContent.length);

// Parse the master file to extract tasks
function parseTasksFromMaster(content) {
  const tasks = [];
  const lines = content.split('\n');
  
  let currentPhase = null;
  let currentSection = null;
  let currentTask = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Phase headers
    if (line.match(/^## Phase \d+:/)) {
      currentPhase = line.replace('## ', '').trim();
      continue;
    }
    
    // Section headers  
    if (line.match(/^### \d+\.\d+/)) {
      currentSection = line.replace('### ', '').trim();
      continue;
    }
    
    // Task headers
    if (line.match(/^#### Task \d+\.\d+\.\d+:/)) {
      if (currentTask) {
        tasks.push(currentTask);
      }
      
      const taskMatch = line.match(/Task (\d+)\.(\d+)\.(\d+): (.+)/);
      if (taskMatch) {
        currentTask = {
          id: `${taskMatch[1]}_${taskMatch[2]}_${taskMatch[3]}`,
          phase: parseInt(taskMatch[1]),
          section: parseInt(taskMatch[2]),
          task: parseInt(taskMatch[3]),
          title: taskMatch[4],
          content: [],
          phaseTitle: currentPhase,
          sectionTitle: currentSection
        };
      }
      continue;
    }
    
    // Collect task content
    if (currentTask && line.trim()) {
      currentTask.content.push(line);
    }
  }
  
  // Add the last task
  if (currentTask) {
    tasks.push(currentTask);
  }
  
  return tasks;
}

// Generate individual task file content
function generateTaskFileContent(task) {
  const content = `# Task ${task.phase}.${task.section}.${task.task}: ${task.title}

## Overview
${task.title} as part of ${task.phaseTitle} - ${task.sectionTitle}

## Objective
Complete implementation of ${task.title.toLowerCase()} following the detailed specifications from the master implementation plan.

## Files to Create/Modify

### Implementation Details
${task.content.slice(0, 20).join('\n')}

${task.content.length > 20 ? '\n### Additional Content\n' + task.content.slice(20).join('\n') : ''}

## Implementation Steps

1. **Analyze Requirements**
   - Review the task specifications carefully
   - Identify all files that need to be created or modified
   - Understand dependencies on other tasks

2. **Create/Modify Files**
   - Follow the file specifications exactly
   - Implement all required functionality
   - Add proper error handling

3. **Test Implementation**
   - Verify all validation criteria are met
   - Test functionality works as expected
   - Check integration with existing code

4. **Document Changes**
   - Add appropriate code comments
   - Update relevant documentation
   - Note any deviations from plan

## Validation Criteria

### ✅ Functional Requirements
- [ ] All specified files are created/modified correctly
- [ ] Implementation follows TypeScript best practices
- [ ] Code compiles without errors
- [ ] Functionality works as specified

### ✅ Quality Standards
- [ ] Code is properly typed with TypeScript
- [ ] Error handling is comprehensive
- [ ] Code follows project conventions
- [ ] Tests are included where applicable

### ✅ Integration
- [ ] Changes integrate properly with existing code
- [ ] Dependencies are correctly managed
- [ ] No breaking changes to existing functionality
- [ ] Performance requirements are met

## Dependencies Required
(Refer to specific dependencies listed in the task content above)

## Success Criteria
✅ **Task is complete when all validation criteria are met and the implementation integrates successfully with the overall system.**

## Notes for AI Implementation
- Follow the exact specifications in the task content
- Pay attention to file paths and naming conventions
- Ensure proper TypeScript typing throughout
- Test thoroughly before marking complete
- Update TASK_TRACKER.md when complete

---

*This task file was auto-generated from COPILOT_IMPLEMENTATION_TASK_LIST.md*
`;

  return content;
}

// Main execution
function main() {
  console.log('🚀 Generating individual task files...');
  
  const tasks = parseTasksFromMaster(masterContent);
  console.log(`📋 Found ${tasks.length} tasks to generate`);
  
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  let generated = 0;
  let skipped = 0;
  
  for (const task of tasks) {
    const filename = `TASK_${task.id}.md`;
    const filepath = path.join(outputDir, filename);
    
    // Skip if file already exists
    if (fs.existsSync(filepath)) {
      console.log(`⏭️  Skipping ${filename} (already exists)`);
      skipped++;
      continue;
    }
    
    const content = generateTaskFileContent(task);
    fs.writeFileSync(filepath, content, 'utf8');
    console.log(`✅ Generated ${filename}`);
    generated++;
  }
  
  console.log(`\n🎉 Generation complete!`);
  console.log(`📁 Generated: ${generated} new files`);
  console.log(`⏭️  Skipped: ${skipped} existing files`);
  console.log(`📊 Total tasks: ${tasks.length}`);
  
  // Update task tracker
  console.log(`\n📝 Remember to update TASK_TRACKER.md with the new task files!`);
}

if (require.main === module) {
  main();
}

module.exports = { parseTasksFromMaster, generateTaskFileContent };
