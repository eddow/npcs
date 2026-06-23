# NPCS Cross-Engine Test Specification

**Version**: 0.1.0
**Status**: Draft

This document specifies the format, semantics, and harness behavior for shared `.test.npcs` test files. These files form the single source of truth for language behavior across all npcs engine implementations (TypeScript, Rust, and future ports).

---

## 1. File Format

### 1.1 Naming

Test files use the extension `.test.npcs` and live in a shared `tests/fixtures/` directory, referenced by all engine implementations.

### 1.2 Structure

A test file has two parts:

```
/*
<pragma block>
*/
<script body>
```

The pragma block is a `/* */` multi-line comment containing test directives. The script body is standard npcs source.

### 1.3 Example

```npcs
/*
@npcs-test
@global x 10
@global y 5
@output "Sum: 15"
@output "Product: 50"
@return
*/
sum = x + y
product = x * y
print "Sum: " + sum
print "Product: " + product
```

---

## 2. Pragma Directives

### 2.1 Sentinel: `@npcs-test`

**Required**. Must be the first directive. Distinguishes test files from regular `.npcs` scripts. A file without this sentinel is ignored by the test harness.

```
@npcs-test
```

### 2.2 Global injection: `@global`

Sets a context variable before execution. Multiple `@global` directives may appear in a single step block.

```
@global <name> <value>
```

- `<name>`: a valid npcs identifier
- `<value>`: a MiniScript literal — number, string (double-quoted), boolean (`true`/`false`), or `null`

The value is injected into the execution context, making it available as a variable in the script.

**Examples:**
```
@global counter 0
@global name "Alice"
@global active true
@global data null
```

### 2.3 Output assertion: `@output`

Asserts that a `print()` call produced the given string, in order. Multiple `@output` directives within a step are checked sequentially against captured `print` output.

```
@output "<exact string>"
```

- The string must match exactly (including whitespace).
- `@output` directives are consumed in order. Each one matches the next unclaimed `print` call.
- If there are more `print` calls than `@output` directives, the extras are ignored (they act as debug logging).
- If there are more `@output` directives than `print` calls, the step fails.
- An empty output capture is valid (assert with zero `@output` directives).

### 2.4 Yield expectation: `@yield`

Expects the step to end with a yield result.

```
@yield [<value>]
```

- If `<value>` is omitted, any yield value is accepted.
- If `<value>` is provided (a MiniScript literal), the yielded value must match exactly.
- A step with `@yield` must resume: the harness feeds the serialized state into the next step.

### 2.5 Return expectation: `@return`

Expects the step to end with a return result.

```
@return [<value>]
```

- If `<value>` is omitted, any return value is accepted (including no value).
- If `<value>` is provided, the returned value must match exactly.
- A step with `@return` must be the **final step** — no further steps may follow.

### 2.6 Error expectation: `@error`

Expects the step to end with an error.

```
@error [<message-substring>]
```

- If `<message-substring>` is omitted, any error is accepted.
- If provided, the error message must contain the given substring (case-insensitive).
- A step with `@error` must be the **final step** — no further steps may follow.

### 2.7 Timeout: `@timeout`

Sets a maximum wall-clock time (in milliseconds) for the step to complete. Optional; defaults to 5000ms if omitted or placed before all step separators.

```
@timeout <milliseconds>
```

Applies to the current step only. May be specified per-step.

---

## 3. Step Separation

### 3.1 Separator: `---`

A line containing only `---` in the pragma block separates execution steps. Each step corresponds to one `execute(context, state?)` call.

```npcs
/*
@npcs-test
@output "Before yield"
@yield 42
---
@output "After yield"
@return
*/
```

**Execution flow:**
1. **Step 1**: Fresh execution → assert output `["Before yield"]` → assert yield value `42` → capture serialized state
2. **Step 2**: Resume with captured state → assert output `["After yield"]` → assert return

### 3.2 Step directive scoping

Most directives are scoped to the current step block:
- `@output` — per-step print capture assertion
- `@yield` / `@return` / `@error` — per-step result assertion (exactly one per step)
- `@timeout` — per-step time limit

Directives that apply to all steps when placed before the first separator:
- `@npcs-test` (always global)
- `@global` (accumulated across all steps — globals set before step 1 remain for all subsequent steps)
- `@timeout` (if placed before the first separator, becomes the default for all steps)

### 3.3 Step result exclusivity

Each step must have **exactly one** of: `@yield`, `@return`, or `@error`. The final step must use `@return` or `@error`.

---

## 4. Test Globals (Context Functions)

The test harness injects these functions into the execution context. They are available to the script body.

### 4.1 `print(...args)`

Captures each argument, converts to string (via engine's standard coercion), joins with a single space, and appends to the step's output array.

```
print "Hello"          → output: ["Hello"]
print "x =", 42        → output: ["x = 42"]
print a, b, c          → output: ["<a> <b> <c>"]
```

The captured output array is checked against `@output` directives in order.

### 4.2 `assert(condition, message?)`

Inline assertion. If `condition` is falsy, the step fails with an error.

```
assert(x > 0, "x must be positive")
assert(person.age == 30)             // message is optional
assert(items.len == 3, "expected 3 items, got " + items.len)
```

- `condition`: any npcs expression; evaluated for truthiness
- `message` (optional): a string describing the failure; if omitted, a default message is used

**Semantics**: `assert` throws/returns an error that the harness interprets as a step failure:
- If the step has no `@error` directive → test fails (unexpected error)
- If the step has an `@error` directive → test passes (expected error), and the message is checked against the `@error` substring

### 4.3 `fail(message?)`

Unconditional failure. Equivalent to `assert(false, message)`.

```
fail("should not reach this code path")
fail()                              // message is optional
```

Same error semantics as `assert`.

---

## 5. Harness Behavior

### 5.1 Test lifecycle

For each `.test.npcs` file:

1. **Parse pragmas**: Extract the pragma block, validate syntax, split into steps.
2. **Build initial context**: Create a context object with `print`, `assert`, `fail`, and all `@global` values.
3. **Step loop**:
   a. Compile script → create executor with current context (and serialized state from previous step, if any).
   b. Execute one step: `execute(context, state)`.
   c. Capture `print` output → check against `@output` directives (ordered, exact match).
   d. Check result type (`yield` / `return` / `error`) against the step's directive.
   e. If type matches and value is specified, deep-compare the value.
   f. If `@yield`: serialize state, proceed to next step.
   g. If `@return` or `@error`: assert this is the final step, end test.
4. **Report**: Pass/fail with diff of expected vs actual.

### 5.2 State serialization

Between yield steps, the harness serializes the engine's execution state. The format is **engine-specific** — each engine serializes in its own native way. The harness does not assert on the serialized form; it only passes it to the next `execute()` call on the same engine.

(This means cross-engine tests validate **observable behavior**, not internal state representation.)

### 5.3 Value comparison

When `@yield <value>` or `@return <value>` specifies an expected value, the harness performs deep structural equality:
- Numbers: `===` (no tolerance)
- Strings: exact match
- Booleans: exact match
- `null`: exact match
- Maps: same keys, same values (recursive)
- Lists: same length, same elements in order

### 5.4 Error messages

If a step fails, the harness reports:
- The file path and step number
- The directive that failed
- Expected vs actual values
- Full `print` output captured so far (as debug context)

---

## 6. Complete Examples

### 6.1 Basic execution

```npcs
/*
@npcs-test
@output "Sum: 15"
@output "Product: 50"
@return
*/
x = 10
y = 5
sum = x + y
product = x * y
print "Sum: " + sum
print "Product: " + product
```

### 6.2 Simple yield/resume

```npcs
/*
@npcs-test
@output "Before yield: x = 10"
@yield 42
---
@output "After yield: x = 10"
@output "Execution completed!"
@return
*/
x = 10
print "Before yield: x = " + x
yield 42
print "After yield: x = " + x
print "Execution completed!"
```

### 6.3 Yield inside if statement

```npcs
/*
@npcs-test
@output "Inside if: x = 15"
@yield 0
---
@output "After pause in if: x = 15"
@output "After if block"
@return
*/
x = 15
if x > 10 then
    print "Inside if: x = " + x
    yield 0
    print "After pause in if: x = " + x
end if
print "After if block"
```

### 6.4 Multiple yields (loop)

```npcs
/*
@npcs-test
@output "Loop iteration: 0"
@output "After loop iteration: 1"
@output "Before"
@yield 0
---
@output "After"
@output "Loop iteration: 1"
@output "After loop iteration: 2"
@output "Loop iteration: 2"
@output "After loop iteration: 3"
@output "Loop completed!"
@return
*/
counter = 0
do while counter < 3
    print "Loop iteration: " + counter
    counter = counter + 1
    print "After loop iteration: " + counter
    if counter == 2 then
        print "Before"
        yield 0
        print "After"
    end if
loop
print "Loop completed!"
```

### 6.5 Object state preservation across yield

```npcs
/*
@npcs-test
@output "Before pause: Alice is 30"
@yield 0
---
@output "After pause: Alice is now 31"
@return
*/
person = {name: "Alice", age: 30, active: true}
print "Before pause: " + person.name + " is " + person.age
yield 0
person.age = 31
print "After pause: " + person.name + " is now " + person.age
```

### 6.6 Inline assertions (assert/fail)

```npcs
/*
@npcs-test
@global items ["apple", "banana", "orange"]
@output "All checks passed"
@return
*/
assert(items.len == 3, "expected 3 items")
assert(items[0] == "apple")
assert(items[1] == "banana", "second item should be banana")
print "All checks passed"
```

### 6.7 Expected error via fail

```npcs
/*
@npcs-test
@global threshold 10
@error "too high"
*/
x = 15
if x > threshold then
    fail("value " + x + " is too high")
end if
print "value is fine"
```

### 6.8 Expected error via @error (no inline assert)

```npcs
/*
@npcs-test
@error
*/
undefined_var = someUndefinedVariable
print "never reached"
```

### 6.9 Plan checking

```npcs
/*
@npcs-test
@global hunger 12
@global has_job true
@output "after"
@return
*/
plan "goToWork"
    checking "Not hungry": hunger < 10
    checking has_job
    print "working"
end plan
print "after"
```

### 6.10 Globals across multiple steps

```npcs
/*
@npcs-test
@global base 100
@output "Step 1: base = 100"
@yield
---
@output "Step 2: base = 100, bonus = 50"
@return 150
*/
print "Step 1: base = " + base
yield
bonus = 50
print "Step 2: base = " + base + ", bonus = " + bonus
return base + bonus
```

---

## 7. Directory Layout

```
tests/
  fixtures/                    ← shared across all engines
    basic.test.npcs
    functions.test.npcs
    yield-basic.test.npcs
    yield-in-if.test.npcs
    yield-in-loop.test.npcs
    yield-in-function.test.npcs
    objects.test.npcs
    arrays.test.npcs
    plan-checking.test.npcs
    error-undefined.test.npcs
    inline-assert.test.npcs
    ...
  exec/
    cross-engine.test.ts       ← TS: auto-generates Jest tests from fixtures/
    ...existing ts-specific tests...
rs/
  tests/
    fixtures/                  ← symlink or copy of tests/fixtures/
    cross_engine.rs            ← Rust: auto-generates tests from fixtures/
```

---

## 8. Implementation Guidelines

### 8.1 Pragma parser

The pragma parser should:
1. Scan for `/*` ... `*/` at the start of the file (allowing whitespace before).
2. Check for `@npcs-test` on the first content line.
3. Split content by `---` lines into step blocks.
4. Parse each step block line-by-line for directives.
5. Reject unknown directives with a clear error.

The parser should be ~50-80 lines in any language.

### 8.2 Test driver

The test driver should:
1. Discover all `*.test.npcs` files in `tests/fixtures/`.
2. For each file, parse pragmas and generate a test case.
3. Within the test case, run the step loop as described in §5.1.
4. Report failures with file path, step number, and expected vs actual diff.

### 8.3 Context injection

Both engines must provide these context functions with identical semantics:

```
print:    (...args: any[]) → void          (appends joined string to capture array)
assert:   (condition: any, message?: string) → void | Error
fail:     (message?: string) → void | Error
```

`assert` and `fail` throw/return an error when triggered. The error object should have a `message` property for `@error` substring matching.

### 8.4 Conversion from existing fixtures

Existing `.npcs` fixtures (without pragmas) will be **gradually converted** to `.test.npcs` files with pragmas. The legacy `runFixture`/`runScript` test infrastructure can continue to work alongside the cross-engine harness during the transition.

---

## 9. Prior Art / Rationale

This format draws on:
- **SQL logic tests** (SQLite's `test/` suite): `----` separators, `/* */` pragmas
- **Test262** (ECMAScript conformance): inline metadata in comments, harness-driven assertions
- **Wasm spec tests**: `.wast` files with embedded expected values

Key design principles:
- **Parsable by both engines without modifying the npcs parser** — pragmas live in comments
- **Zero dependencies** — a simple line scanner is sufficient; no YAML/TOML/JSON parser needed
- **Observable behavior only** — tests assert on outputs, not internal state representation
- **Explicit is better than implicit** — every expected output, yield, and return is declared
