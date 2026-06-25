/// Cross-engine test harness.
///
/// Drives a .test.npcs file: parses pragmas, executes steps,
/// asserts output/result against expectations, serializes state between yields.
///
/// Engine-agnostic design: the execution primitives use the npcs executor
/// trait, allowing any implementation to be tested.

use std::collections::BTreeMap;
use std::time::Instant;

use crate::executor::{Context, ExecResult, ExecutionState, Executor, NpcScript};
use crate::pragma_parser::{ParsedStep, ParsedTest, ResultType};
use crate::value::Value;

// ── Test context ────────────────────────────────────────────────────

/// Context that captures print output and plan lifecycle events.
pub struct CrossEngineContext {
    /// Injected globals (from @global directives)
    pub globals: BTreeMap<String, Value>,
    /// Captured print output lines
    pub output: Vec<String>,
    /// Captured plan event strings (begin/end/cancel/finally)
    pub plan_events: Vec<String>,
    /// Whether a call to fail() has occurred
    pub failed: Option<String>,
}

impl CrossEngineContext {
    pub fn new(globals: BTreeMap<String, Value>) -> Self {
        Self {
            globals,
            output: Vec::new(),
            plan_events: Vec::new(),
            failed: None,
        }
    }
}

impl Context for CrossEngineContext {
    fn get(&self, name: &str) -> Option<Value> {
        self.globals.get(name).cloned()
    }

    fn call_native(&mut self, name: &str, args: &[Value]) -> Option<Value> {
        match name {
            "print" => {
                let msg = args
                    .iter()
                    .map(|v| v.to_string())
                    .collect::<Vec<_>>()
                    .join(" ");
                self.output.push(msg);
                Some(Value::Nil)
            }
            "yield" => Some(args.first().cloned().unwrap_or(Value::Nil)),
            "assert" => {
                let condition = args.first().map(|v| v.is_truthy()).unwrap_or(false);
                if !condition {
                    let message = args.get(1).map(|v| v.to_string()).unwrap_or_default();
                    self.failed = Some(if message.is_empty() {
                        "assertion failed".into()
                    } else {
                        message
                    });
                }
                Some(Value::Nil)
            }
            "fail" => {
                let message = args.first().map(|v| v.to_string()).unwrap_or_default();
                self.failed = Some(if message.is_empty() {
                    "fail() called".into()
                } else {
                    message
                });
                Some(Value::Nil)
            }
            _ => None,
        }
    }

    fn plan_begin(&mut self, pv: &Value) {
        self.plan_events.push(format!("begin({pv})"));
    }

    fn plan_conclude(&mut self, pv: &Value) {
        self.plan_events.push(format!("conclude({pv})"));
    }

    fn plan_cancel(&mut self, pv: &Value, reason: Option<&str>) {
        let r = reason.unwrap_or("");
        self.plan_events.push(format!("cancel({pv}, {r})"));
    }

    fn plan_finally(&mut self, pv: &Value) {
        self.plan_events.push(format!("finally({pv})"));
    }
}

// ── Step execution ──────────────────────────────────────────────────

/// Result of executing a single test step.
#[derive(Debug)]
pub struct StepResult {
    pub passed: bool,
    pub failures: Vec<String>,
    pub execution_time_ms: u64,
    /// Timeout for this step (from the pragma)
    pub timeout_ms: u64,
    /// Serialized state (JSON) if the step yielded
    pub state_json: Option<String>,
    /// Captured print output
    pub output: Vec<String>,
    /// Captured plan events
    pub plan_events: Vec<String>,
}

/// Execute one step: parse source, inject globals, run, check assertions.
pub fn execute_step(
    script: &NpcScript,
    step: &ParsedStep,
    state_json: Option<&str>,
) -> StepResult {
    let start = Instant::now();

    // Helper: build a StepResult with common defaults
    let make_result = |passed: bool, failures: Vec<String>, state_json: Option<String>| StepResult {
        passed,
        failures,
        execution_time_ms: start.elapsed().as_millis() as u64,
        timeout_ms: step.timeout_ms,
        state_json,
        output: vec![],
        plan_events: vec![],
    };

    // Build context with globals merged
    let mut ctx = CrossEngineContext::new(step.globals.clone());

    // Create executor (fresh or from saved state)
    let mut exec = if let Some(json) = state_json {
        let state: ExecutionState = match serde_json::from_str(json) {
            Ok(s) => s,
            Err(e) => {
                return make_result(false, vec![format!("Failed to deserialize state: {e}")], None);
            }
        };
        Executor::from_state(script, &state)
    } else {
        Executor::new(script)
    };

    // Run the script
    let result_maybe = exec.execute(&mut ctx);
    let elapsed = start.elapsed().as_millis() as u64;
    // Extract captured state before checking fail (to avoid borrow conflicts)
    let output = std::mem::take(&mut ctx.output);
    let plan_events = std::mem::take(&mut ctx.plan_events);
    let failed = ctx.failed.take();

    // Check for fail() calls
    if let Some(fail_msg) = failed {
        if step.result_type != ResultType::Error {
            return StepResult {
                passed: false,
                failures: vec![format!("Script called fail(): {fail_msg}")],
                execution_time_ms: elapsed,
                timeout_ms: step.timeout_ms,
                state_json: None,
                output,
                plan_events,
            };
        }
        // If expecting error, check error substring match
        if let Some(ref expected_substr) = step.error_substring {
            if !fail_msg
                .to_lowercase()
                .contains(&expected_substr.to_lowercase())
            {
                return StepResult {
                    passed: false,
                    failures: vec![format!(
                        "Error mismatch: expected substring '{}', got '{}'",
                        expected_substr, fail_msg
                    )],
                    execution_time_ms: elapsed,
                    timeout_ms: step.timeout_ms,
                    state_json: None,
                    output,
                    plan_events,
                };
            }
        }
        return StepResult {
            passed: true,
            failures: vec![],
            execution_time_ms: elapsed,
            timeout_ms: step.timeout_ms,
            state_json: None,
            output,
            plan_events,
        };
    }

    match result_maybe {
        Ok(result) => {
            let mut failures = Vec::new();

            // Check result type
            match (&result, step.result_type) {
                (ExecResult::Yield(_), ResultType::Yield) => {}
                (ExecResult::Return(_), ResultType::Return) => {}
                (ExecResult::Yield(_), _) => {
                    failures.push(format!(
                        "Expected {:?} but got Yield",
                        step.result_type
                    ));
                }
                (ExecResult::Return(_), _) => {
                    failures.push(format!(
                        "Expected {:?} but got Return",
                        step.result_type
                    ));
                }
            }

            // Check result value (if specified)
            if step.result_value_specified {
                let actual = match &result {
                    ExecResult::Yield(v) => v,
                    ExecResult::Return(v) => v.as_ref().unwrap_or(&Value::Nil),
                };
                let expected = step.result_value.as_ref().unwrap();
                if actual != expected {
                    failures.push(format!(
                        "Value mismatch: expected {}, got {}",
                        expected, actual
                    ));
                }
            }

            // Check outputs
            if output.len() != step.outputs.len() {
                failures.push(format!(
                    "Output count mismatch: expected {} lines, got {} lines: {:?}",
                    step.outputs.len(),
                    output.len(),
                    output
                ));
            } else {
                for (i, (expected, actual)) in
                    step.outputs.iter().zip(output.iter()).enumerate()
                {
                    if expected != actual {
                        failures.push(format!(
                            "Output[{}] mismatch: expected {:?}, got {:?}",
                            i, expected, actual
                        ));
                    }
                }
            }

            // Serialize state if yielded
            let state_json = if matches!(result, ExecResult::Yield(_)) {
                let state = exec.state();
                match serde_json::to_string(&state) {
                    Ok(json) => Some(json),
                    Err(e) => {
                        failures.push(format!("Failed to serialize state: {e}"));
                        None
                    }
                }
            } else {
                None
            };

            StepResult {
                passed: failures.is_empty(),
                failures,
                execution_time_ms: elapsed,
                timeout_ms: step.timeout_ms,
                state_json,
                output,
                plan_events,
            }
        }
        Err(e) => {
            if step.result_type == ResultType::Error {
                // Check error substring if specified
                if let Some(ref expected_substr) = step.error_substring {
                    if !e.to_lowercase().contains(&expected_substr.to_lowercase()) {
                        return StepResult {
                            passed: false,
                            failures: vec![format!(
                                "Error mismatch: expected substring '{}', got '{}'",
                                expected_substr, e
                            )],
                            execution_time_ms: elapsed,
                            timeout_ms: step.timeout_ms,
                            state_json: None,
                            output,
                            plan_events,
                        };
                    }
                }
                StepResult {
                    passed: true,
                    failures: vec![],
                    execution_time_ms: elapsed,
                    timeout_ms: step.timeout_ms,
                    state_json: None,
                    output,
                    plan_events,
                }
            } else {
                StepResult {
                    passed: false,
                    failures: vec![format!(
                        "Execution error (expected {:?}): {}",
                        step.result_type, e
                    )],
                    execution_time_ms: elapsed,
                    timeout_ms: step.timeout_ms,
                    state_json: None,
                    output,
                    plan_events,
                }
            }
        }
    }
}

// ── Test file runner ────────────────────────────────────────────────

/// Result of running an entire test file.
#[derive(Debug)]
pub struct TestFileResult {
    pub file_name: String,
    pub passed: bool,
    pub total_time_ms: u64,
    pub steps: Vec<StepResult>,
}

/// Run all steps in a .test.npcs file.
pub fn run_test_file(file_path: &str) -> Result<TestFileResult, String> {
    let source = std::fs::read_to_string(file_path)
        .map_err(|e| format!("Cannot read {file_path}: {e}"))?;
    run_test_source(&source, file_path)
}

/// Run all steps from in-memory source.
pub fn run_test_source(source: &str, file_name: &str) -> Result<TestFileResult, String> {
    let (parsed, _body) = crate::pragma_parser::parse_test_file(source)?;

    // TODO: body is currently unused — the executor runs the source directly.
    // The script body is already embedded in the source string used for parsing.
    // We re-parse via NpcScript::parse for execution since it needs the full source.

    let script = NpcScript::parse(source)?;

    let mut step_results = Vec::new();
    let mut state_json: Option<String> = None;
    let total_start = Instant::now();
    let mut all_passed = true;

    for (i, step) in parsed.steps.iter().enumerate() {
        let result = execute_step(&script, step, state_json.as_deref());

        if !result.passed {
            all_passed = false;
        }

        // Capture state for yield steps to pass to next step
        state_json = result.state_json.clone();

        step_results.push(result);

        // Stop on first failure for error/return steps
        if !all_passed && i + 1 < parsed.steps.len() {
            break;
        }
    }

    Ok(TestFileResult {
        file_name: file_name.to_string(),
        passed: all_passed,
        total_time_ms: total_start.elapsed().as_millis() as u64,
        steps: step_results,
    })
}
