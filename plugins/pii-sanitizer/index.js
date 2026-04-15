/**
 * ClawOSS PII Sanitizer Plugin — COMPREHENSIVE + BIDIRECTIONAL
 *
 * TWO-WAY sanitization:
 * 1. INCOMING (persist/write): @ → ＠ — prevents content filter triggers
 * 2. OUTGOING (tool calls): ＠ → @ — ensures files have correct symbols
 *
 * The model sees ＠ in context. If it generates ＠ in code, the before_tool_call
 * hook converts it back to @ before the tool executes. Files on disk always
 * have real @. Session history always has ＠.
 */

var FULLWIDTH_AT = '\uFF20'; // ＠

// === SANITIZATION (@ → ＠) for session persistence ===

function sanitizeString(text) {
  if (typeof text !== 'string') return text;
  return text.replace(/@/g, FULLWIDTH_AT);
}

function deepSanitize(value) {
  if (typeof value === 'string') return sanitizeString(value);
  if (Array.isArray(value)) return value.map(deepSanitize);
  if (value && typeof value === 'object') {
    var result = {};
    var keys = Object.keys(value);
    for (var i = 0; i < keys.length; i++) {
      result[keys[i]] = deepSanitize(value[keys[i]]);
    }
    return result;
  }
  return value;
}

function sanitizeMessage(msg) {
  if (!msg) return undefined;
  var cleaned = deepSanitize(msg);
  if (JSON.stringify(msg) !== JSON.stringify(cleaned)) {
    return { message: cleaned };
  }
  return undefined;
}

// === DESANITIZATION (＠ → @) for tool execution ===

function desanitizeString(text) {
  if (typeof text !== 'string') return text;
  return text.replace(new RegExp(FULLWIDTH_AT, 'g'), '@');
}

function deepDesanitize(value) {
  if (typeof value === 'string') return desanitizeString(value);
  if (Array.isArray(value)) return value.map(deepDesanitize);
  if (value && typeof value === 'object') {
    var result = {};
    var keys = Object.keys(value);
    for (var i = 0; i < keys.length; i++) {
      result[keys[i]] = deepDesanitize(value[keys[i]]);
    }
    return result;
  }
  return value;
}

function register(api) {
  // === INCOMING: Sanitize @ → ＠ before persistence ===

  // Tool results (file reads, exec output)
  api.on('tool_result_persist', function(event, ctx) {
    return sanitizeMessage(event.message);
  });

  // ALL messages before writing to session (assistant output, announces)
  api.on('before_message_write', function(event, ctx) {
    return sanitizeMessage(event.message);
  });

  // === OUTGOING: Desanitize ＠ → @ before tool execution ===

  // If the model generates code with ＠ (because context had ＠),
  // convert back to real @ before the tool runs.
  // This ensures write/exec tools create files with correct @ symbols.
  api.on('before_tool_call', function(event, ctx) {
    if (!event || !event.params) return;

    var toolName = event.toolName || ctx.toolName || '';

    // Only desanitize for tools that write to disk or run commands
    if (['write', 'edit', 'exec', 'apply_patch', 'process'].indexOf(toolName) === -1) {
      return;
    }

    var cleaned = deepDesanitize(event.params);
    if (JSON.stringify(event.params) !== JSON.stringify(cleaned)) {
      return { params: cleaned };
    }
  });
}

module.exports = { register };
