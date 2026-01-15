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
