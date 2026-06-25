/// Pragma parser for cross-engine `.test.npcs` files.
///
/// Extracts and parses the `/* @npcs-test ... */` header block,
/// splitting into steps and parsing per-step directives.
///
/// See tests/spec.md for the full specification.

use crate::value::Value;
use std::collections::BTreeMap;

// ── Types ───────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct ParsedStep {
    /// @output strings in order
    pub outputs: Vec<String>,
    /// Expected result type
    pub result_type: ResultType,
    /// Expected result value (None = any value accepted)
    pub result_value: Option<Value>,
    /// Whether a value was explicitly specified in the directive
    pub result_value_specified: bool,
    /// Substring to match in error message (only for result_type=Error)
    pub error_substring: Option<String>,
    /// Per-step timeout in ms
    pub timeout_ms: u64,
    /// Globals injected for this step (merged with global_globals)
    pub globals: BTreeMap<String, Value>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResultType {
    Yield,
    Return,
    Error,
}

#[derive(Debug, Clone)]
pub struct ParsedTest {
    /// Steps in execution order
    pub steps: Vec<ParsedStep>,
    /// Globals set before the first separator (apply to all steps)
    pub global_globals: BTreeMap<String, Value>,
    /// Default timeout for steps that don't specify their own
    pub default_timeout_ms: u64,
}

// ── MiniScript literal parser ───────────────────────────────────────

/// Parse a MiniScript literal value from a string.
/// Supports: numbers, strings, booleans, null, arrays, maps.
pub fn parse_literal(input: &str) -> Result<Value, String> {
    let s = input.trim();
    if s.is_empty() {
        return Err("empty literal".into());
    }

    match s {
        "true" => return Ok(Value::Bool(true)),
        "false" => return Ok(Value::Bool(false)),
        "null" => return Ok(Value::Nil),
        _ => {}
    }

    // String: "..." with \" and other escapes
    if s.starts_with('"') {
        return parse_string(s);
    }

    // Number: integer or float (including negative)
    let first = s.chars().next().unwrap();
    if first == '-' || first.is_ascii_digit() {
        if let Ok(n) = s.parse::<f64>() {
            return Ok(Value::Number(n));
        }
    }

    // Array: [...]
    if s.starts_with('[') {
        return parse_array(s);
    }

    // Map: {...}
    if s.starts_with('{') {
        return parse_map(s);
    }

    Err(format!("Cannot parse MiniScript literal: {s}"))
}

fn parse_string(s: &str) -> Result<Value, String> {
    let chars: Vec<char> = s.chars().collect();
    let mut result = String::new();
    let mut i = 1; // skip opening "
    while i < chars.len() {
        if chars[i] == '\\' && i + 1 < chars.len() {
            match chars[i + 1] {
                '"' => {
                    result.push('"');
                    i += 2;
                }
                '\\' => {
                    result.push('\\');
                    i += 2;
                }
                'n' => {
                    result.push('\n');
                    i += 2;
                }
                't' => {
                    result.push('\t');
                    i += 2;
                }
                _ => {
                    result.push(chars[i]);
                    i += 1;
                }
            }
        } else if chars[i] == '"' {
            return Ok(Value::String(result));
        } else {
            result.push(chars[i]);
            i += 1;
        }
    }
    Err(format!("Unterminated string: {s}"))
}

fn parse_array(s: &str) -> Result<Value, String> {
    if s.len() < 2 || !s.ends_with(']') {
        return Err(format!("Invalid array: {s}"));
    }
    let inner = s[1..s.len() - 1].trim();
    if inner.is_empty() {
        return Ok(Value::List(vec![]));
    }
    let parts = split_top_level(inner, ',');
    let mut items = Vec::new();
    for p in parts {
        items.push(parse_literal(&p)?);
    }
    Ok(Value::List(items))
}

fn parse_map(s: &str) -> Result<Value, String> {
    if s.len() < 2 || !s.ends_with('}') {
        return Err(format!("Invalid map: {s}"));
    }
    let inner = s[1..s.len() - 1].trim();
    if inner.is_empty() {
        return Ok(Value::Map(BTreeMap::new()));
    }
    let entries = split_top_level(inner, ',');
    let mut map = BTreeMap::new();
    for entry in entries {
        let colon_idx = find_top_level(&entry, ':')
            .ok_or_else(|| format!("Invalid map entry: {entry}"))?;
        let key_raw = entry[..colon_idx].trim();
        // Key can be a bare identifier or a quoted string
        let key = if key_raw.starts_with('"') {
            parse_literal(key_raw)?.to_string()
        } else {
            key_raw.to_string()
        };
        let value = parse_literal(&entry[colon_idx + 1..])?;
        map.insert(key, value);
    }
    Ok(Value::Map(map))
}

/// Split by separator, respecting nested brackets/braces/quotes.
fn split_top_level(s: &str, sep: char) -> Vec<String> {
    let chars: Vec<char> = s.chars().collect();
    let mut parts = Vec::new();
    let mut depth = 0i32;
    let mut in_string = false;
    let mut start = 0usize;
    for i in 0..chars.len() {
        let c = chars[i];
        if c == '"' && (i == 0 || chars[i - 1] != '\\') {
            in_string = !in_string;
        }
        if in_string {
            continue;
        }
        if c == '[' || c == '{' {
            depth += 1;
        } else if c == ']' || c == '}' {
            depth -= 1;
        } else if c == sep && depth == 0 {
            parts.push(s[start..i].trim().to_string());
            start = i + 1;
        }
    }
    let last = s[start..].trim().to_string();
    if !last.is_empty() {
        parts.push(last);
    }
    parts
}

/// Find the first occurrence of `char` at top-level nesting (not inside brackets/braces/quotes).
fn find_top_level(s: &str, target: char) -> Option<usize> {
    let chars: Vec<char> = s.chars().collect();
    let mut depth = 0i32;
    let mut in_string = false;
    for i in 0..chars.len() {
        let c = chars[i];
        if c == '"' && (i == 0 || chars[i - 1] != '\\') {
            in_string = !in_string;
        }
        if in_string {
            continue;
        }
        if c == '[' || c == '{' {
            depth += 1;
        } else if c == ']' || c == '}' {
            depth -= 1;
        } else if c == target && depth == 0 {
            return Some(i);
        }
    }
    None
}

// ── Pragma block extraction ─────────────────────────────────────────

/// Extract the pragma block content from a .test.npcs source.
/// Returns the text between the first `/*` and `*/`, or None if none found
/// or if there is non-whitespace content before the comment.
pub fn extract_pragma_block(source: &str) -> Option<&str> {
    let start = source.find("/*")?;
    // Only allow whitespace before the comment
    if source[..start].trim() != "" {
        return None;
    }
    let end = source[start + 2..].find("*/")?;
    Some(&source[start + 2..start + 2 + end])
}

/// Extract the script body — everything after the closing `*/` of the pragma block.
pub fn extract_script_body(source: &str) -> &str {
    if let Some(start) = source.find("/*") {
        if let Some(end) = source[start + 2..].find("*/") {
            let after = start + 2 + end + 2;
            return source[after..].trim();
        }
    }
    source.trim()
}

// ── Directive parsing ───────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS: u64 = 5000;

fn unescape_string(s: &str) -> String {
    let chars: Vec<char> = s.chars().collect();
    let mut result = String::with_capacity(s.len());
    let mut i = 0;
    while i < chars.len() {
        if chars[i] == '\\' && i + 1 < chars.len() {
            match chars[i + 1] {
                '"' => result.push('"'),
                '\\' => result.push('\\'),
                'n' => result.push('\n'),
                't' => result.push('\t'),
                _ => {
                    result.push(chars[i]);
                    result.push(chars[i + 1]);
                }
            }
            i += 2;
        } else {
            result.push(chars[i]);
            i += 1;
        }
    }
    result
}

/// Strip leading comment decorations from a pragma block line.
/// Handles: `* `, `*`, or just whitespace at the start of the line.
fn strip_comment_line(line: &str) -> String {
    let trimmed = line.trim_start();
    if let Some(rest) = trimmed.strip_prefix("* ") {
        rest.to_string()
    } else if let Some(rest) = trimmed.strip_prefix('*') {
        rest.to_string()
    } else {
        trimmed.to_string()
    }
}

/// Parse a single pragma directive line. Returns Ok(true) if line was recognized.
fn parse_directive_line(
    line: &str,
    step: &mut ParsedStep,
    _default_timeout: u64,
) -> Result<(), String> {
    let line = line.trim();

    // @npcs-test — sentinel
    if line == "@npcs-test" {
        return Ok(());
    }

    // @global <name> <value>
    if let Some(rest) = line.strip_prefix("@global ") {
        let parts: Vec<&str> = rest.splitn(2, ' ').collect();
        if parts.len() != 2 {
            return Err(format!("Invalid @global: {line}"));
        }
        let name = parts[0].trim().to_string();
        let value = parse_literal(parts[1].trim())?;
        step.globals.insert(name, value);
        return Ok(());
    }

    // @output "<string>"
    if let Some(rest) = line.strip_prefix("@output ") {
        let trimmed = rest.trim();
        if trimmed.len() >= 2 && trimmed.starts_with('"') && trimmed.ends_with('"') {
            let inner = &trimmed[1..trimmed.len() - 1];
            step.outputs.push(unescape_string(inner));
            return Ok(());
        }
        return Err(format!("Invalid @output: {line}"));
    }

    // @yield [<value>]
    if line == "@yield" {
        step.result_type = ResultType::Yield;
        return Ok(());
    }
    if let Some(rest) = line.strip_prefix("@yield ") {
        step.result_type = ResultType::Yield;
        step.result_value = Some(parse_literal(rest.trim())?);
        step.result_value_specified = true;
        return Ok(());
    }

    // @return [<value>]
    if line == "@return" {
        step.result_type = ResultType::Return;
        return Ok(());
    }
    if let Some(rest) = line.strip_prefix("@return ") {
        step.result_type = ResultType::Return;
        step.result_value = Some(parse_literal(rest.trim())?);
        step.result_value_specified = true;
        return Ok(());
    }

    // @error [<message-substring>]
    if line == "@error" {
        step.result_type = ResultType::Error;
        return Ok(());
    }
    if let Some(rest) = line.strip_prefix("@error ") {
        let inner = rest.trim();
        // It may or may not be quoted
        let substr = if inner.len() >= 2 && inner.starts_with('"') && inner.ends_with('"') {
            unescape_string(&inner[1..inner.len() - 1])
        } else {
            inner.to_string()
        };
        step.result_type = ResultType::Error;
        step.error_substring = Some(substr);
        return Ok(());
    }

    // @timeout <milliseconds>
    if let Some(rest) = line.strip_prefix("@timeout ") {
        let ms: u64 = rest
            .trim()
            .parse()
            .map_err(|_| format!("Invalid @timeout: {line}"))?;
        step.timeout_ms = ms;
        return Ok(());
    }

    Err(format!("Unknown pragma directive: {line}"))
}

// ── Main parse functions ────────────────────────────────────────────

/// Parse a pragma block into a ParsedTest.
/// `block` is the inner text of the `/* ... */` comment.
pub fn parse_pragmas(block: &str) -> Result<ParsedTest, String> {
    let mut test = ParsedTest {
        steps: Vec::new(),
        global_globals: BTreeMap::new(),
        default_timeout_ms: DEFAULT_TIMEOUT_MS,
    };

    let mut current_step = ParsedStep {
        outputs: Vec::new(),
        result_type: ResultType::Return,
        result_value: None,
        result_value_specified: false,
        error_substring: None,
        timeout_ms: test.default_timeout_ms,
        globals: BTreeMap::new(),
    };

    let mut seen_steps = false;
    let mut seen_sentinel = false;

    for raw_line in block.lines() {
        let line = strip_comment_line(raw_line);
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        // Step separator
        if line == "---" {
            seen_steps = true;
            // Finalize current step
            current_step.globals.extend(
                test.global_globals
                    .iter()
                    .map(|(k, v)| (k.clone(), v.clone())),
            );
            if current_step.timeout_ms == 0 || current_step.timeout_ms == test.default_timeout_ms {
                current_step.timeout_ms = test.default_timeout_ms;
            }
            test.steps.push(current_step);

            current_step = ParsedStep {
                outputs: Vec::new(),
                result_type: ResultType::Return,
                result_value: None,
                result_value_specified: false,
                error_substring: None,
                timeout_ms: test.default_timeout_ms,
                globals: BTreeMap::new(),
            };
            continue;
        }

        // Sentinel
        if line == "@npcs-test" {
            seen_sentinel = true;
            continue;
        }

        if !seen_sentinel {
            continue; // skip lines before sentinel
        }

        // Parse directive
        parse_directive_line(line, &mut current_step, test.default_timeout_ms)?;
    }

    // Finalize last step
    current_step.globals.extend(
        test.global_globals
            .iter()
            .map(|(k, v)| (k.clone(), v.clone())),
    );
    if current_step.timeout_ms == 0 {
        current_step.timeout_ms = test.default_timeout_ms;
    }
    test.steps.push(current_step);

    // Validate: must have at least one step
    if test.steps.is_empty() {
        return Err("No steps defined".into());
    }

    // Validate: last step must be return or error (not yield)
    if let Some(last) = test.steps.last() {
        if last.result_type == ResultType::Yield {
            return Err("Last step cannot be @yield".into());
        }
    }

    Ok(test)
}

/// Parse a full .test.npcs file into a ParsedTest + script body.
pub fn parse_test_file(source: &str) -> Result<(ParsedTest, String), String> {
    let block = extract_pragma_block(source)
        .ok_or_else(|| "No pragma block found".to_string())?;
    let test = parse_pragmas(block)?;
    let body = extract_script_body(source).to_string();
    Ok((test, body))
}

// ── Tests ───────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_literal_bool() {
        assert_eq!(parse_literal("true").unwrap(), Value::Bool(true));
        assert_eq!(parse_literal("false").unwrap(), Value::Bool(false));
    }

    #[test]
    fn parse_literal_null() {
        assert_eq!(parse_literal("null").unwrap(), Value::Nil);
    }

    #[test]
    fn parse_literal_number() {
        assert_eq!(parse_literal("42").unwrap(), Value::Number(42.0));
        assert_eq!(parse_literal("-5").unwrap(), Value::Number(-5.0));
        assert_eq!(parse_literal("3.14").unwrap(), Value::Number(3.14));
        assert_eq!(parse_literal("1e3").unwrap(), Value::Number(1000.0));
    }

    #[test]
    fn parse_literal_string() {
        assert_eq!(
            parse_literal("\"hello\"").unwrap(),
            Value::String("hello".into())
        );
        assert_eq!(
            parse_literal("\"escaped \\\"quote\\\"\"").unwrap(),
            Value::String("escaped \"quote\"".into())
        );
    }

    #[test]
    fn parse_literal_array() {
        assert_eq!(parse_literal("[]").unwrap(), Value::List(vec![]));
        assert_eq!(
            parse_literal("[1, 2, 3]").unwrap(),
            Value::List(vec![
                Value::Number(1.0),
                Value::Number(2.0),
                Value::Number(3.0),
            ])
        );
        assert_eq!(
            parse_literal("[\"a\", \"b\"]").unwrap(),
            Value::List(vec![Value::String("a".into()), Value::String("b".into())])
        );
    }

    #[test]
    fn parse_literal_map() {
        assert_eq!(parse_literal("{}").unwrap(), Value::Map(BTreeMap::new()));
        let mut expected = BTreeMap::new();
        expected.insert("x".into(), Value::Number(1.0));
        expected.insert("y".into(), Value::Number(2.0));
        assert_eq!(
            parse_literal("{x: 1, y: 2}").unwrap(),
            Value::Map(expected)
        );
    }

    #[test]
    fn parse_literal_nested() {
        let val = parse_literal("[{a: 1}, {b: 2}]").unwrap();
        match val {
            Value::List(items) => {
                assert_eq!(items.len(), 2);
                assert!(matches!(&items[0], Value::Map(_)));
                assert!(matches!(&items[1], Value::Map(_)));
            }
            _ => panic!("expected list"),
        }
    }

    #[test]
    fn extract_basic_pragma() {
        let source = "/*\n@npcs-test\n@output \"hello\"\n@return\n*/\nx = 1";
        let block = extract_pragma_block(source).unwrap();
        assert!(block.contains("@npcs-test"));
        assert!(block.contains("@output \"hello\""));

        let body = extract_script_body(source);
        assert_eq!(body, "x = 1");
    }

    #[test]
    fn parse_basic_test_file() {
        let source = "/*\n@npcs-test\n@output \"Sum: 15\"\n@return\n*/\nx = 10\ny = 5\nprint \"Sum: \" + x + y\n";
        let (test, body) = parse_test_file(source).unwrap();
        assert_eq!(test.steps.len(), 1);
        assert_eq!(test.steps[0].outputs, vec!["Sum: 15"]);
        assert_eq!(test.steps[0].result_type, ResultType::Return);
        assert!(!body.is_empty());
    }

    #[test]
    fn parse_multi_step() {
        let source = "/*\n@npcs-test\n@output \"before\"\n@yield 42\n---\n@output \"after\"\n@return\n*/\nprint \"before\"\nyield 42\nprint \"after\"\n";
        let (test, _body) = parse_test_file(source).unwrap();
        assert_eq!(test.steps.len(), 2);
        assert_eq!(test.steps[0].result_type, ResultType::Yield);
        assert_eq!(test.steps[0].result_value, Some(Value::Number(42.0)));
        assert!(test.steps[0].result_value_specified);
        assert_eq!(test.steps[1].result_type, ResultType::Return);
        assert_eq!(test.steps[0].outputs, vec!["before"]);
        assert_eq!(test.steps[1].outputs, vec!["after"]);
    }

    #[test]
    fn parse_error_step() {
        let source = "/*\n@npcs-test\n@error\n*/\nundefined_var = x\n";
        let (test, _body) = parse_test_file(source).unwrap();
        assert_eq!(test.steps.len(), 1);
        assert_eq!(test.steps[0].result_type, ResultType::Error);
    }

    #[test]
    fn parse_global_directive() {
        let source = "/*\n@npcs-test\n@global x 10\n@global name \"Alice\"\n@output \"done\"\n@return\n*/\nprint \"done\"\n";
        let (test, _body) = parse_test_file(source).unwrap();
        let step = &test.steps[0];
        assert_eq!(step.globals.get("x"), Some(&Value::Number(10.0)));
        assert_eq!(
            step.globals.get("name"),
            Some(&Value::String("Alice".into()))
        );
    }

    #[test]
    fn parse_with_stars_in_pragma() {
        let source = "/*\n * @npcs-test\n * @output \"hello\"\n * @return\n */\nx = 1\n";
        let (test, _body) = parse_test_file(source).unwrap();
        assert_eq!(test.steps[0].outputs, vec!["hello"]);
    }
}
