# NPCS Documentation

## Overview
NPCS is an executor for **MiniScript**, focusing on linear stateful execution with pause/resume capabilities (yield).

## Key Features
*   **MiniScript**: A BASIC-like scripting language.
*   **Yielding**:
    *   **Statement Syntax**: `myFunc arg1, arg2` (without parentheses) -> **Yields** the return value of `myFunc`. Use this for long-running actions (e.g., `walkTo x, y`).
    *   **Expression Syntax**: `myFunc(arg1, arg2)` (with parentheses) -> **Evaluates** to the value immediately.
*   **Guarded Plans**:
    *   `plan` is the long-lived behavior region.
    *   `checking ...` lines can appear at the top of a `plan` block before the body starts.
    *   Forms:
        *   `checking condition`
        *   `checking payload: condition`
    *   Multiple `checking` lines are conjunctive.
    *   Checks run on plan entry and on resume after a `yield`.
    *   v1 does not use listeners and does not reevaluate on ordinary writes between yields.
*   **Yield Object**: When yielded, the executor returns `{ type: 'yield', value: ..., state: ... }`.
    *   **Resume**: You can resume execution later by passing the `state` back.
*   **Serialization**: The entire execution state is serializable, allowing game saves to persist running scripts.

## Usage
Useful for Game AI and quest scripting where actions take time and game state must be saved at any point.

## Internals

### Expression Caching & Stack Management
The executor uses an `evaluatedCache` on the **current stack frame** (`this.stack[0]`) to store intermediate results of expression evaluation (e.g. arguments for a function call).

**Critical Invariant**: This cache MUST be cleared after the statement finishes executing.

**Gotcha**: Calling a function pushes a **NEW** stack frame.
*   When a statement (like a function call) finishes, `this.stack[0]` might point to a **NEW, DIFFERENT** frame than the one where the statement started.
*   **Fix**: Always capture the stack frame reference (`const stackEntry = this.stack[0]`) *before* execution, and use that reference to clear the cache in the `finally` block.
*   **Failure to do this** results in stale cache on the caller's frame, causing variables in subsequent statements to resolve to incorrect values (e.g., the function definition itself instead of the variable value).

### Guard reevaluation and cache setup
Resume-time `checking` reevaluation happens outside the normal `executeStatement()` path, but it still evaluates MiniScript expressions.

**Critical Invariant**: resume-time guard checks must initialize and clean up `this.stack[0].evaluatedCache` exactly like statement execution does.

If you forget this, reevaluating a guard on resume can crash with `Cannot use 'in' operator to search for ... in undefined`.
