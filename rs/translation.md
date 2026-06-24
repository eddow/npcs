# NPCs Rust Port — Translation Plan

**Date**: 2026-06-24
**Baseline**: 14 integration tests passing, recursive executor, hand-written lexer & parser.

---

## Current Baseline

```
rs/
├── Cargo.toml          # serde, insta dependencies
├── src/
│   ├── lib.rs          # parse(), execute(), run()
│   ├── main.rs         # CLI binary
│   ├── token.rs         # TokenKind enum (45 variants)
│   ├── lexer.rs         # Hand-written char scanner (~310 loc)
│   ├── ast.rs           # Expr + Stmt + Program + Operator enums (~230 loc)
│   ├── parser.rs        # Recursive-descent parser (~1060 loc)
│   ├── value.rs         # Runtime Value enum + fuzzy JS == (~140 loc)
│   └── executor.rs      # Recursive tree-walking executor (~470 loc)
└── tests/
    └── integration_test.rs  # 14 tests, all passing
```

**What works** (14/14):
- Arithmetic, string concat, boolean logic, comparison operators
- Variable assignment and lookup (scalar identifiers only)
- `if/then/else/end if` (block and shortcut syntax)
- `for in` loops, `do/while/loop`, `break`/`continue` (via error strings)
- Named functions with parameters, return values
- Object/map literals, list literals, indexing, `.length`
- Ternary expressions, `isa` type checks, slice expressions
- Newline-sensitive statement separation

**Design decision**: `==` uses JS-like fuzzy equality (type coercion) — matching the TS original.

---

## Tier 1 — Yield/Resume State Machine

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

## Tier 2 — Expression Completeness

### 2.1 Member and index assignment (LValue)

Current status: `person.age = 40` → error ("complex assignment targets not yet supported").

**Approach**: Extract an `LValue` concept. When evaluating the left side of an assignment:
- `Expr::Identifier` → set variable in scope
- `Expr::Member { object, property }` → evaluate object to `&mut Value`, then mutate
- `Expr::Index { object, index }` → evaluate both, then mutate collection

Requires the executor to track mutable references to values (perhaps via `Scope` owning values and returning indices).

**Effort**: 1-2 days

### 2.2 Compound assignment (`+=`, `-=`, etc.)

Parser already produces `Stmt::Assignment` with a `Binary` expression. Executor just needs to detect the pattern and evaluate accordingly, or the parser could produce a dedicated `Stmt::CompoundAssign`.

**Effort**: 0.5 day

### 2.3 Break/continue via proper error type

Currently uses `Err("break".into())` / `Err("continue".into())` — fragile string matching. Replace with a proper enum:

```rust
enum FlowControl {
    Break,
    Continue,
    Return(Option<Value>),
}
```

All loop handlers catch `FlowControl` instead of matching error strings.

**Effort**: 0.5 day

### 2.4 Numeric literal edge cases

Cases like `.5` (no leading zero), `5.` (trailing dot), negative scientific notation. The lexer's number scanning needs a few fixes.

**Effort**: 0.5 day

### 2.5 Function parameter defaults

Currently parsed but never evaluated (always set to `Value::Nil`). Need to evaluate the default expression in the caller's scope when building the function frame.

**Effort**: 1 day

### 2.6 Nested function calls in expressions

`work(3) + work(7)` — the recursive executor needs to handle `Expr::Call` returning from a sub-frame and picking up evaluation at the caller's position. This is naturally handled by the IP-based executor (Tier 1) but not the current recursive one.

**Effort**: resolved by Tier 1

---

## Tier 3 — Plan / Checking Execution

### 3.1 Plan lifecycle

Parser already produces `Stmt::Plan { plan_value, checkings, body }`. Executor needs to:
1. Evaluate `plan_value`
2. Run `checking` conditions (conjunctive)
3. Call `context.plan.begin()` if passes
4. Execute body until `end plan`
5. Call `context.plan.conclude()` / `context.plan.finally()`

### 3.2 Plan cancellation

- `cancel(plan)` — find plan in scope stack, cancel it and all sub-plans, restore IP to after the plan block
- Plan cancellation on `break`/`continue`/`return` exiting a function containing a plan

### 3.3 Resume-time checking

When resuming from yield, re-evaluate all active `checking` conditions. If any fail, cancel the plan.

**Effort**: 2-3 days

---

## Tier 4 — Cross-Engine Test Infrastructure

The TS side now has a `.test.npcs` format (see `tests/spec.md`) with a pragma parser, harness, and Jest test suite. The Rust port needs equivalent infrastructure.

### 4.1 Pragma parser (`rs/src/pragma_parser.rs`)

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

**Option A**: Build script (`build.rs`) that scans `tests/fixtures/` and generates a `tests/generated_tests.rs` file with one `#[test] fn` per fixture.

**Option B**: Single test that iterates all `.test.npcs` files (simpler but less granular failure reporting).

Recommend **Option A** for parity with the TS harness (one `it()` per file).

**Effort**: 1 day

### 4.4 Fixture sharing

```bash
# Symlink the shared fixtures dir
rs/tests/fixtures/ -> ../../tests/fixtures/
```

The `tests/fixtures/` directory at the repo root holds `.test.npcs` files shared by TS and Rust.

**Effort**: trivial

---

## Tier 5 — Polish & Gaps

### 5.1 Custom `isa` type registry

Currently hardcoded to `number`, `string`, `boolean`, `list`, `map`, `function`. Need a registry similar to TS `IsaTypes`:

```rust
pub trait Context {
    fn get(&self, name: &str) -> Option<Value>;
    fn call_native(&mut self, name: &str, args: &[Value]) -> Option<Value>;
    fn isa_check(&self, type_name: &str, value: &Value) -> Option<bool>;
}
```

Fall back to built-in types if `isa_check` returns `None`.

**Effort**: 0.5 day

### 5.2 Escape sequences in strings

Currently handles `\\`, `\"`, `\n`, `\t`. Missing: `\r`, `\0`, hex escapes. Review against TS lexer.

**Effort**: 0.5 day

### 5.3 Shortcut statement syntax

`if x > 5 then print "yes"` — parser handles the one-liner detection, executor needs to ensure the body is executed inline (not as a block with IP push).

**Effort**: 0.5 day (mostly testing)

### 5.4 Block comments in weird places

The TS parser handles `/* comment */` inside expressions. The Rust lexer handles standalone block comments; need to verify they don't break expression parsing.

**Effort**: 0.5 day

### 5.5 `ImportCodeExpression`

Throws "not implemented". Low priority — the TS side also has this stubbed.

**Effort**: 1 day if needed

---

## Summary Timeline

| Tier | Items | Effort |
|------|-------|--------|
| **1** | Yield/resume state machine, expression cache, serialization | 4-5 days |
| **2** | LValue assignment, compound assign, break/continue, number edge cases, param defaults | 3-5 days |
| **3** | Plan/checking lifecycle, cancellation, resume checking | 2-3 days |
| **4** | Pragma parser, cross-engine harness, test runner, fixture symlink | 4-6 days |
| **5** | isa registry, string escapes, shortcut syntax, import stub | 2-3 days |
| **Total** | | **15-22 days** |

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

5. **Test fixture location**: The shared `tests/fixtures/` directory at repo root should hold `.test.npcs` files. The `rs/tests/fixtures/` would be a symlink. The `ts/tests/exec/fixtures/` legacy `.npcs` files can gradually migrate to `.test.npcs` format.
