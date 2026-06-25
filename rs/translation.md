# NPCs Rust Port — Translation Plan

**Date**: 2026-06-24
**Baseline (pre-Tier-1)**: 22 integration tests passing, recursive executor, hand-written lexer & parser.  
**Current (post-Tier-5)**: 56 tests (56 pass, 0 ignored), IP-based state machine with yield/resume, plan lifecycle with cross-engine test coverage, serialization, cross-engine test infrastructure, isa registry. All 5 tiers complete.

---

## Current Baseline

```
rs/
├── Cargo.toml          # serde, insta dependencies
├── src/
│   ├── lib.rs          # parse(), execute(), run()
│   ├── main.rs         # CLI binary
│   ├── token.rs         # TokenKind enum (64 variants)
│   ├── lexer.rs         # Hand-written char scanner (~476 loc)
│   ├── ast.rs           # Expr + Stmt + Program + Operator enums (~264 loc)
│   ├── parser.rs        # Recursive-descent parser (~1105 loc)
│   ├── value.rs         # Runtime Value enum + fuzzy JS == (~143 loc)
│   └── executor.rs      # IP-based state-machine executor (~1609 loc)
└── tests/
    └── integration_test.rs  # 32 tests (all pass)
```

**What works** (28/28 tests):
- Arithmetic, string concat, boolean logic, comparison operators
- Variable assignment and lookup
- `if/then/else/end if` (block and shortcut syntax)
- `for in` loops, `do/while/loop`, `break`/`continue` (via `Flow` enum, not strings)
- Named functions with parameters, return values, default parameter values
- Object/map literals, list literals, indexing, `.length`
- Member assignment (`person.age = 40`), nested member (`person.address.city = "NewTown"`), index assignment (`arr[1] = 25`)
- Compound assignment (`+=`, `-=`, `*=`, etc.)
- Ternary expressions, `isa` type checks, slice expressions
- Nested function calls in expressions (`double(3) + double(4)`)
- Numeric literal edge cases: `.5`, `5.`, `1e3`, `1.5e-2`
- Newline-sensitive statement separation

**Design decision**: `==` uses JS-like fuzzy equality (type coercion) — matching the TS original.

---

## Tier 1 — Yield/Resume State Machine ✅ DONE (2026-06-24)

**Why first**: Everything else (plan checking, `assert`/`fail`, cross-engine harness) depends on the engine being able to yield and resume.

### 1.1 `ExecutionState` struct

```rust
#[derive(Serialize, Deserialize, Clone, Debug)]
struct ExecutionState {
    stack: Vec<StackFrame>,
    plan_scopes: Vec<PlanScope>,
}
```

Replace the current recursive `execute_block()` with an IP-based loop that can be suspended. The state must be serializable via `serde`.

### 1.2 Stack frame

```rust
struct StackFrame {
    scope: Scope,                       // variable bindings
    ip: IP,                             // instruction pointer
    loop_scopes: Vec<LoopScope>,        // active loops
    evaluated_cache: HashMap<usize, Value>,  // expression cache
    target_return: Option<usize>,       // cache index for return value
}
```

### 1.3 IP-based execution loop

Replace recursive `execute_block(stmts)` with `step()` — execute one statement, advance IP, return `Yield/Return/Branch`. The outer loop in `execute()` drives `step()` until yield or return.

### 1.4 Expression cache

Port the TypeScript expression cache pattern (`evaluatedCache` on current stack frame, `expressionsCacheIndex` counter, `expressionsCacheStack` for nesting). **Critical invariant**: must capture `stackEntry` reference before any call that might push/pop frames, then clear on that reference in `finally`.

### 1.5 State serialization

- Derive `Serialize`/`Deserialize` on `Value`, `Scope`, `StackFrame`, `ExecutionState`
- Custom serializer for `FunctionDefinition` (stores index + params, not the body itself)
- Re-instantiation: look up function body from `NpcScript.functions[]` on deserialization

### 1.6 Public API

```rust
pub struct NpcScript {
    source: String,
    ast: Program,
    functions: Vec<Vec<Stmt>>,  // function bodies by index
}

impl NpcScript {
    pub fn new(source: &str) -> Result<Self, Error>;
    pub fn execute(&self, context: &mut dyn Context) -> Result<ExecResult, Error>;
    pub fn execute_with_state(&self, context: &mut dyn Context, state: &ExecutionState) -> Result<ExecResult, Error>;
}
```

**Effort**: 4-5 days

---

## Tier 2 — Expression Completeness ✅ DONE (2026-06-24)

All sub-items implemented and covered by 28 integration tests.

### 2.1 Member and index assignment (LValue) ✅

Implemented via `evaluate_mut()` with proper nesting support. Handles:
- `person.age = 40` — simple member assignment
- `person.address.city = "NewTown"` — nested member assignment (reads inner, mutates at correct level, writes back via `assign_to`)
- `arr[1] = 25` — index assignment

Key helpers: `apply_lvalue_mutation()`, `get_prop()`, `set_prop()`.

### 2.2 Compound assignment (`+=`, `-=`, etc.) ✅

Parser desugars `x += 5` into `Assignment { target: x, value: Binary(Add, x, 5) }`. Executor evaluates naturally.

### 2.3 Break/continue via proper error type ✅

Replaced string-based errors with `enum Flow { Break, Continue }`. `propagate_break()` and `propagate_continue()` use proper matching. Continue fixed for do-while nested under if-clauses (captures `on_complete` from popped child frames, merges scope before re-entry).

### 2.4 Numeric literal edge cases ✅

Lexer handles: `.5`, `5.`, `5.5`, `1e3`, `1.5e-2`. Trailing dot fix: always consume `.` after digits as part of the number.

### 2.5 Function parameter defaults ✅

Default expressions evaluated in caller's scope when building function frame. `function greet(name = "World")` works.

### 2.6 Nested function calls in expressions ✅

`double(3) + double(4)` — handled by `execute_inline()` which pushes a sub-frame for the call, runs to completion, and returns the value to the expression evaluator.

---

## Tier 3 — Plan / Checking Execution ✅ DONE (2026-06-24)

Core plan lifecycle fully implemented and tested (32 tests, all pass).

### 3.1 Plan lifecycle ✅

Implemented the full plan lifecycle in the IP-based executor:

1. **Begin**: On `Stmt::Plan`, evaluate plan_value, run checking conditions (conjunctive). If any fail → skip the plan. If all pass → call `ctx.plan_begin()`, push `PlanScope` with saved state, push plan body frame.
2. **Execute**: Plan body runs as a child frame with `FrameComplete::PlanBody`.
3. **Conclude/Finally**: On plan body frame completion (or resume detection via `Done` + plan scope depth match), call `ctx.plan_conclude()` then `ctx.plan_finally()`.

### 3.2 Plan cancellation ✅

- **`Executor::cancel(plan_value, reason)`**: Finds plan in scopes by value, cancels it and all sub-plans, restores stack to saved parent IP. Returns new `ExecutionState` or `None` (all plans cancelled, script done).
- **Flow control cancellation**: `propagate_return`, `propagate_break`, and `propagate_continue` call `cancel_plans_below_current_stack()` when popping frames, ensuring plans are cleaned up on return/break/continue.
- **`cancel_plans_at_depth()`**: Helper that walks plan scopes from newest to oldest, calling `ctx.plan_cancel()` and `ctx.plan_finally()` for each.

**Bug fix (2026-06-24)**: Plan cancellation on return inside functions called inline (via `execute_inline`) was hanging due to `target_return` inheritance. Control-structure frames (PlanBody, IfClause, ForLoop, etc.) were inheriting `target_return` from their parent function frame. When `return` executed inside a plan body, the inline Return handler stopped at the plan body (which had inherited `target_return`) instead of the actual function boundary, leaking the function frame onto the main stack and causing an infinite re-execution loop. Fixed by only inheriting `target_return` for `FrameComplete::Done` frames (real function bodies, not control structures).

### 3.3 Resume-time checking ✅

`recheck_plans()` is called at the start of `execute()`. It iterates all active plan scopes, re-evaluating their checking conditions. If any fail, that plan (and all sub-plans) are cancelled and the stack is restored to after the failed plan block.

### Context trait additions

```rust
pub trait Context {
    fn plan_begin(&mut self, _plan_value: &Value) {}
    fn plan_conclude(&mut self, _plan_value: &Value) {}
    fn plan_cancel(&mut self, _plan_value: &Value, _reason: Option<&str>) {}
    fn plan_finally(&mut self, _plan_value: &Value) {}
}
```

All methods have default no-op implementations — host code only overrides what it needs.

### Bug fix: double IP advance on yield

While implementing plan yield/resume, discovered that both `call_fn_step` and `execute()`'s Yield handler advanced IP, causing a skip on resume. Fixed by removing the `f.ip += 1` from `execute()`'s Yield handler (both call sites already advance before returning `StepResult::Yield`).

### Tests

32 integration tests (all passing). Tests cover:
- Basic plan lifecycle with callback tracking (begin/conclude/finally)
- Checking conditions pass and fail (skip plan on fail)
- Yield/resume within plans (plan concludes on resume)
- Plan cancellation via cancel() API
- Return/continue cleanup via flow control cancel helpers

---

## Tier 4 — Cross-Engine Test Infrastructure ✅ DONE (2026-06-24)

All cross-engine testing infrastructure implemented and verified against existing `.test.npcs` fixtures.

### 4.1 Pragma parser (`rs/src/pragma_parser.rs`) ✅

Port `ts/tests/pragma-parser.ts` to Rust:

```rust
struct ParsedStep {
    outputs: Vec<String>,
    result_type: ResultType,  // Yield, Return, Error
    result_value: Option<Value>,
    result_value_specified: bool,
    error_substring: Option<String>,
    timeout_ms: u64,
    globals: Vec<(String, Value)>,
}

struct ParsedTest {
    steps: Vec<ParsedStep>,
    global_globals: Vec<(String, Value)>,
    default_timeout_ms: u64,
}

fn parse_test_file(source: &str) -> Result<ParsedTest, Error>;
fn extract_script_body(source: &str) -> &str;
fn extract_pragma_block(source: &str) -> Option<&str>;
```

Key sub-parsers:
- `parse_literal(input: &str) -> Value` — numbers, strings, booleans, null, arrays, maps
- `parse_string(s: &str)` — handle escaped quotes
- `parse_array(s: &str)` — comma-separated with bracket nesting
- `parse_map(s: &str)` — `{key: val, ...}` with nesting

**Effort**: 1-2 days

### 4.2 Cross-engine harness (`rs/tests/cross_engine.rs`)

Rust equivalent of `ts/tests/cross-engine-harness.ts`:

```rust
struct TestContext {
    output: RefCell<Vec<String>>,
    // mock plan callbacks
}

impl Context for TestContext { ... }

fn execute_step(source: &str, context: &mut TestContext, state: Option<&str>) -> StepResult;
fn assert_step(actual: &StepResult, expected: &ParsedStep, step_index: usize) -> AssertionResult;
fn deep_equal(a: &Value, b: &Value) -> bool;
fn run_test_file(path: &Path) -> TestFileResult;
```

**Critical difference from TS**: State serialization is engine-specific. The harness serializes to JSON via `serde`, passes it to the next step's `execute_with_state()`. Cross-engine tests only assert on observable behavior (output + yield/return values), not internal state representation.

**Effort**: 2-3 days

### 4.3 Test runner (`rs/tests/cross_engine_test.rs`)

Auto-discovers all `.test.npcs` files and generates Rust tests (one `#[test]` per file). Since Rust has no dynamic test generation at runtime like Jest, use a build script or `include!` macro approach:

**Option A**: Build script (`build.rs`) that scans `tests/` (repo root) and generates a `tests/generated_tests.rs` file with one `#[test] fn` per fixture.

**Option B**: Single test that iterates all `.test.npcs` files (simpler but less granular failure reporting).

Recommend **Option A** for parity with the TS harness (one `it()` per file).

**Effort**: 1 day

### 4.4 Fixture sharing

`.test.npcs` files live at the repo root `tests/` directory, shared by both TS and Rust engines via `include_str!` from `build.rs`. No symlink needed.

### Implementation notes

- **Harness location**: `src/cross_engine.rs` (not `tests/`) — needed as a library module so generated tests can import it
- **Generated tests**: 11 tests from repo-root `tests/*.test.npcs`: basic, yield-basic, yield-in-loop, error, assert, plus 6 plan tests (plan-basic, plan-checking, plan-checking-fail, plan-yield, plan-cancel-return, plan-cancel-break)
- **Bug fix**: `FrameComplete` now derives `Serialize/Deserialize` and `on_complete` is no longer `#[serde(skip)]` — loop state was being lost on yield/resume because `from_state` reset `on_complete` to `Done`
- **Bug fix**: `Value::PartialEq` now includes `List`/`Map` structural comparison arms
- **Test results**: 56 pass (13 pragma parser + 32 integration + 11 generated), 0 ignored

---

## Tier 5 — Polish & Gaps ✅ DONE (2026-06-24)

All 56 tests pass (13 pragma parser + 11 cross-engine generated + 32 integration), 0 ignored.

### 5.1 Custom `isa` type registry ✅

Added `isa_check` to the Context trait with a default `None` return (fallback to built-in types). The executor checks `ctx.isa_check(type_name, value)` first; if `None`, falls back to hardcoded `number`/`string`/`boolean`/`list`/`map`/`function`.

### 5.2 Escape sequences in strings ✅

Added `\r` and `\0` to the lexer. Now handles: `\\`, `\"`, `\'`, `\n`, `\t`, `\r`, `\0`. Verified via `string_escape_sequences` test.

### 5.3 Shortcut statement syntax ✅

Already handled by the parser — `if x > 5 then print "yes"` produces an `IfClause` with a single-statement body. Verified via `shortcut_if_then` test.

### 5.4 Block comments in expressions ✅

Added `skip_comments()` method that skips only `Comment` tokens (not newlines). Called in `parse_add_sub`, `parse_mul_div`, `parse_comparison`, and `parse_call_member_index` before operator checks. `10 /* inline */ + 5` now parses correctly.

### 5.5 `ImportCodeExpression` — skipped

Does not exist in the TS codebase either. Nothing to port.

### Implementation notes

- **Bug fix**: Initial fix used `skip_newlines()` inside expression parsers, which consumed statement-terminating newlines, causing subsequent statements to be parsed as function call arguments. Fixed by using `skip_comments()` which only skips `Comment` tokens.
- **Test results**: 32 integration tests (all pass), 0 ignored

---

## Summary Timeline

| Tier | Items | Effort |
|------|-------|--------|
| **1** | Yield/resume state machine, expression cache, serialization | 4-5 days | ✅ Done |
| **2** | LValue assignment, compound assign, break/continue, number edge cases, param defaults | 3-5 days | ✅ Done |
| **3** | Plan/checking lifecycle, cancellation, resume checking | 2-3 days | ✅ Done |
| **4** | Pragma parser, cross-engine harness, test runner, fixture symlink | 4-6 days | ✅ Done |
| **5** | isa registry, string escapes, shortcut syntax, import stub | 2-3 days | ✅ Done |
| **Total** | | **Complete!** |

### Dependency Graph

```
Tier 1 (yield/resume) ──┬──> Tier 3 (plan/checking) ──> Tier 4 (cross-engine tests)
                         │
                         ├──> Tier 2 (expression completeness)
                         │
                         └──> Tier 5 (polish)
```

Tier 4 can be partially done before Tier 3 (pragma parser + harness for non-plan tests), but full cross-engine coverage requires Tier 1 + Tier 3.

---

## Architecture Decisions (Open)

1. **Fuzzy `==` vs strict equality**: Keeping the JS-like fuzzy coercion for now (`"" == 0`, `null == false`, etc.). This matches the TS reference implementation. Revisit if it causes issues.

2. **IP-based vs recursive executor**: The IP-based state machine (Tier 1) should fully replace the current recursive executor, not sit alongside it. The recursive approach served well for initial development but can't support yield/resume.

3. **`Scope` ownership model**: Currently `Scope` stores `HashMap<String, Value>`. For LValue assignment (Tier 2.1), we need mutable access to nested values. Options:
   - Clone the value, mutate, write back (simple but allocates)
   - Use `Rc<RefCell<Value>>` for map/list values (more complex but zero-copy)
   - Add indices/references to `Scope` (complex)

4. **`serde` integration point**: Add `Serialize`/`Deserialize` derives once Tier 1 begins. Until then, the `Value` type stays clean of serialization concerns.

5. **Test fixture location**: `.test.npcs` fixtures live at repo-root `tests/`. `build.rs` reads them via `include_str!` with absolute paths. No symlink or copy directory needed in `rs/tests/`.
