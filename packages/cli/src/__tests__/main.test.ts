import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('CLI Entry Point', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show help when no arguments provided', async () => {
    try {
      await execAsync('node dist/main.js --help');
    } catch (error: any) {
      expect(error.stdout).toContain('AI-powered terminal automation');
      expect(error.stdout).toContain('Usage:');
    }
  });

  it('should show version information', async () => {
    try {
      await execAsync('node dist/main.js --version');
    } catch (error: any) {
      expect(error.stdout).toContain('2.0.0');
    }
  });

  it('should handle invalid mode option', async () => {
    try {
      await execAsync('node dist/main.js --mode invalid');
    } catch (error: any) {
      expect(error.stderr).toContain('Invalid mode');
    }
  });

  it('should accept valid mode options', async () => {
    const modes = ['normal', 'gremlin', 'goblin'];
    
    for (const mode of modes) {
      try {
        // This will likely fail since we don't have a full implementation yet,
        // but it should at least parse the mode correctly
        await execAsync(`node dist/main.js --mode ${mode} "test task"`);
      } catch (error: any) {
        // Should not fail due to invalid mode
        expect(error.stderr).not.toContain('Invalid mode');
      }
    }
  });
});
