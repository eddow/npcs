# NPCS Documentation

## Overview
NPCS is an executor for **MiniScript**, focusing on linear stateful execution with pause/resume capabilities (yield).

## Key Features
*   **MiniScript**: A BASIC-like scripting language.
*   **Yielding**:
    *   **Statement Syntax**: `myFunc arg1, arg2` (without parentheses) -> **Yields** the return value of `myFunc`. Use this for long-running actions (e.g., `walkTo x, y`).
    *   **Expression Syntax**: `myFunc(arg1, arg2)` (with parentheses) -> **Evaluates** to the value immediately.
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
