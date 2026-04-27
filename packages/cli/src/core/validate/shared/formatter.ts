export interface ValidationError {
  line?: number;
  errorType: string;
  message?: string;
  suggestedFix?: string;
  context?: string;
  skillDocLink?: string;
}

export interface ValidationWarning {
  line?: number;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  [key: string]: unknown;
}

export function getExitCode(result: ValidationResult): number {
  return result.valid ? 0 : 1;
}

export function formatValidationResult(result: ValidationResult, format: 'text' | 'json' = 'text'): string {
  if (format === 'json') {
    return formatJson(result);
  }
  return formatText(result);
}

function formatText(result: ValidationResult): string {
  const lines: string[] = [];
  
  if (result.valid && result.errors.length === 0 && result.warnings.length === 0) {
    lines.push('✅ Validation passed.');
    return lines.join('\n');
  }
  
  lines.push(result.valid ? '⚠️ Validation passed with warnings.' : '❌ Validation failed.');
  
  if (result.errors.length > 0) {
    lines.push('\nErrors:');
    for (const error of result.errors) {
      const parts: string[] = [];
      if (error.line) parts.push(`Line ${error.line}`);
      parts.push(`[${error.errorType}]`);
      parts.push(error.context || error.message || 'Unknown error');
      lines.push(`  • ${parts.join(' - ')}`);
      if (error.suggestedFix) {
        lines.push(`    → ${error.suggestedFix}`);
      }
    }
  }
  
  if (result.warnings.length > 0) {
    lines.push('\nWarnings:');
    for (const warning of result.warnings) {
      const parts: string[] = [];
      if (warning.line) parts.push(`Line ${warning.line}`);
      parts.push(warning.message);
      lines.push(`  • ${parts.join(' - ')}`);
    }
  }
  
  return lines.join('\n');
}

function formatJson(result: ValidationResult): string {
  return JSON.stringify(result, null, 2);
}

export function createValidationResult(
  valid: boolean,
  errors: ValidationError[] = [],
  warnings: ValidationWarning[] = [],
  extra: Record<string, unknown> = {}
): ValidationResult {
  return {
    valid,
    errors,
    warnings,
    ...extra
  };
}

export function formatError(error: ValidationError): string {
  const { errorType, context, suggestedFix, skillDocLink, message } = error;
  let formattedMessage = `[${errorType}] → ${context || message || ''} → ${suggestedFix || ''}`;

  if (skillDocLink) {
    formattedMessage += `\n   See: ${skillDocLink}`;
  }

  return formattedMessage;
}

export function addLineInfo(error: string, line: number): string {
  if (line > 0) {
    return `${error}\n   Line: ${line}`;
  }
  return error;
}
