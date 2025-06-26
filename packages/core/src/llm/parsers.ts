/**
 * LLM response parsing utilities for termaite TypeScript implementation
 * Migrated from Python implementation in termaite/llm/parsers.py
 */

/**
 * Extract a suggested command from LLM output wrapped in ```agent_command``` tags
 */
export function parseSuggestedCommand(llmOutput: string): string | null {
  const match = llmOutput.match(/```agent_command\s*\n(.*?)\n```/s);
  return match ? match[1].trim() : null;
}

/**
 * Extract the LLM's thought process from <think> tags
 */
export function parseLLMThought(llmOutput: string): string {
  const match = llmOutput.match(/<think>(.*?)<\/think>/s);
  return match ? match[1].trim() : '';
}

/**
 * Extract the LLM's plan from <checklist> tags
 */
export function parseLLMPlan(llmOutput: string): string {
  const match = llmOutput.match(/<checklist>(.*?)<\/checklist>/s);
  return match ? match[1].trim() : '';
}

/**
 * Extract the LLM's instruction from <instruction> tags
 */
export function parseLLMInstruction(llmOutput: string): string {
  const match = llmOutput.match(/<instruction>(.*?)<\/instruction>/s);
  return match ? match[1].trim() : '';
}

/**
 * Extract the LLM's decision from <decision> tags
 */
export function parseLLMDecision(llmOutput: string): string {
  const match = llmOutput.match(/<decision>(.*?)<\/decision>/s);
  return match ? match[1].trim() : '';
}

/**
 * Extract the LLM's summary from <summary> tags
 */
export function parseLLMSummary(llmOutput: string): string {
  const match = llmOutput.match(/<summary>(.*?)<\/summary>/s);
  return match ? match[1].trim() : '';
}

/**
 * Extract decision type and message from decision text
 * @param decisionText Raw decision text (e.g., "CONTINUE_PLAN: message here")
 * @returns Tuple of [decision_type, message]
 */
export function extractDecisionTypeAndMessage(decisionText: string): [string, string] {
  if (!decisionText) {
    return ['', ''];
  }

  const colonIndex = decisionText.indexOf(':');
  if (colonIndex !== -1) {
    const decisionType = decisionText.substring(0, colonIndex).trim();
    const message = decisionText.substring(colonIndex + 1).trim();
    return [decisionType, message];
  } else {
    return [decisionText.trim(), ''];
  }
}

/**
 * Parse checklist items from plan text
 * @param planText Plan text containing checklist items
 * @returns Array of checklist items
 */
export function parseChecklistItems(planText: string): string[] {
  if (!planText) {
    return [];
  }

  const lines = planText.trim().split('\n');
  const items: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      continue;
    }

    // Handle different checklist formats
    if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ') || trimmedLine.startsWith('+ ')) {
      items.push(trimmedLine.substring(2).trim());
    } else if (/^\d+\.?\s+/.test(trimmedLine)) {
      items.push(trimmedLine.replace(/^\d+\.?\s+/, '').trim());
    } else if (trimmedLine) {
      // If it's not explicitly formatted as a list, still include it
      items.push(trimmedLine);
    }
  }

  return items;
}

/**
 * Extract content from LLM response using object path
 * @param responseData Response object from LLM
 * @param responsePath Dot-notation path to extract from response
 * @returns Extracted content or null if not found
 */
export function extractResponseContent(responseData: any, responsePath: string): string | null {
  if (!responseData || !responsePath) {
    return null;
  }

  try {
    const pathParts = responsePath.split('.');
    let current = responseData;

    for (const part of pathParts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return null;
      }
    }

    return typeof current === 'string' ? current : null;
  } catch (error) {
    return null;
  }
}

/**
 * Validate that an LLM response contains required elements
 * @param response LLM response text
 * @param requiredElements Array of required XML tags
 * @returns true if all required elements are present
 */
export function validateResponseFormat(response: string, requiredElements: string[]): boolean {
  for (const element of requiredElements) {
    const pattern = new RegExp(`<${element}>.*?<\/${element}>`, 's');
    if (!pattern.test(response)) {
      return false;
    }
  }
  return true;
}

/**
 * Extract all XML-tagged content from LLM response
 * @param response LLM response text
 * @returns Object with all found XML tags as keys and their content as values
 */
export function extractAllTags(response: string): Record<string, string> {
  const tags: Record<string, string> = {};
  
  // Find all XML tags in the response
  const tagPattern = /<(\w+)>(.*?)<\/\1>/gs;
  let match;
  
  while ((match = tagPattern.exec(response)) !== null) {
    const tagName = match[1];
    const content = match[2].trim();
    tags[tagName] = content;
  }
  
  return tags;
}
