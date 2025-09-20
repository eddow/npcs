# Execution Model

## Overview

NPCS uses a linear, stateful execution model that allows scripts to pause and resume execution. This is fundamentally different from traditional script execution where scripts run to completion in a single call.

## Core Concepts

### Execution Results

Every script execution returns one of two possible results:

1. **Return**: The script completed normally
   ```typescript
   { type: 'return', value?: any }
   ```

2. **Yield**: The script paused and yielded control
   ```typescript
   { type: 'yield', value: any, state: ExecutionState }
   ```

### Instruction Pointer (IP)

The execution model uses an instruction pointer to track progress through the script:

```typescript
type IP = {
    indexes: number[]      // Path through nested blocks
    functionIndex?: number // Current function (if any)
}
```

The `indexes` array represents a path through the AST structure:
- `[0]` - First statement in main script
- `[0, 0]` - First statement in first nested block
- `[1, 2]` - Third statement in second nested block

### Execution Stack

Scripts maintain an execution stack similar to function call stacks:

```typescript
interface ExecutionStackEntry {
    scope: MSScope                    // Variable scope
    ip: IP                           // Instruction pointer
    loopScopes: LoopScope[]          // Loop state
    evaluatedCache?: Record<number, any> // Expression cache
    targetReturn?: number            // Return target for function calls
    loopOccurrences?: number         // Loop iteration count
}
```

## Execution Flow

### 1. Initial Execution

```javascript
const script = new NpcScript(sourceCode)
const result = script.execute(context)
```

The execution starts at the main script block with IP `[0]`.

### 2. Statement Execution

Each statement is executed based on its type:

```typescript
switch (statementType) {
    case 'AssignmentStatement':
        return this.executeAssignment(statement)
    case 'IfStatement':
        return this.executeIf(statement)
    case 'WhileStatement':
        return this.executeWhile(statement)
    case 'CallStatement':
        return this.executeProcedure(statement)
    // ... other statement types
}
```

### 3. IP Advancement

After each statement, the IP is advanced:

```javascript
private incrementIP(ip: IP): void {
    ip.indexes[ip.indexes.length - 1]++
}
```

### 4. Branching Execution

Some statements cause branching (entering new blocks):

```javascript
// Enter if block
this.stack[0].ip.indexes.push(i)      // Clause index
this.stack[0].ip.indexes.push(0)      // First statement in clause
return { type: 'branched' }
```

### 5. Function Calls

Function calls create new stack entries:

```javascript
// Push new execution frame
this.stack.unshift(func.enterCall(evaluatedArgs))
return { type: 'branched' }
```

## Yielding Mechanism

### Function-Based Yielding

Functions can yield by returning a value when called as statements:

```miniscript
function askQuestion(text)
    return text  // This value is yielded
end function

// This statement yields the return value
askQuestion "What should I do?"
```

### Context Function Yielding

JavaScript functions in the context can also yield:

```javascript
const context = {
    prompt: function(question) {
        // This return value will be yielded
        return question
    }
}
```

### Yield Processing

When a function yields:

1. The return value becomes the yield value
2. The current execution state is preserved
3. Control returns to the host application
4. The host can save the state and resume later

## State Management

### State Structure

The execution state is a serializable representation of the current execution:

```typescript
type ExecutionState = ExecutionStackEntry[]
```

Each stack entry contains:
- **Scope**: Variable bindings and their values
- **IP**: Current execution position
- **Loop Scopes**: State for active loops
- **Cache**: Evaluated expressions (for performance)

### State Serialization

The state can be serialized using custom JSON replacers:

```javascript
// Serialize state
const stateJson = JSON.stringify(executor.state, serializeState)

// Deserialize state
const savedState = JSON.parse(stateJson, reviveState)
```

The `serializeState` function handles:
- Function definitions
- Circular references
- Special objects

### State Restoration

When restoring state:

1. The entire execution stack is recreated
2. Variable scopes are restored
3. Instruction pointers are reset
4. Loop states are preserved
5. Expression cache is cleared (for safety)

## Loop Execution

### While Loops

```miniscript
while condition
    // loop body
end while
```

While loops maintain:
- Loop occurrence count (for infinite loop detection)
- IP depth (for break/continue handling)

```javascript
interface WhileScope extends LoopScope {
    occurrences: number  // Prevents infinite loops
}
```

### For Loops

```miniscript
for item in collection
    // loop body
end for
```

For loops maintain:
- Iterator collection
- Current index
- Loop variable name

```javascript
interface ForScope extends LoopScope {
    iterator: MSValue[]  // The collection being iterated
    index: number        // Current position in collection
    variable: string     // Loop variable name
}
```

### Loop Control

- **Break**: Exits the innermost loop
- **Continue**: Skips to next iteration

```javascript
// Break handling
this.stack[0].ip.indexes.splice(this.stack[0].loopScopes.shift()!.ipDepth)
this.incrementIP(this.stack[0].ip)
return { type: 'branched' }

// Continue handling
const lastLoop = this.stack[0].loopScopes[0]
this.stack[0].ip.indexes.splice(lastLoop.ipDepth)
// Reset to loop start
```

## Function Execution

### Function Definition

Functions are defined as AST nodes and create `FunctionDefinition` objects:

```javascript
class FunctionDefinition {
    constructor(
        public index: number,           // Function index in script
        public parameters: string[],    // Parameter names
        public scope: MSScope,         // Closure scope
        public parameterDefaults: any[] // Default parameter values
    ) {}
}
```

### Function Calls

When a function is called:

1. New execution stack entry is created
2. Parameters are bound to local variables
3. Default parameters are applied
4. Execution continues in function body

```javascript
enterCall(args: any[], targetReturn?: number): ExecutionStackEntry {
    const variables = {}
    for (let i = 0; i < this.parameters.length; i++) {
        variables[this.parameters[i]] = 
            args[i] !== undefined ? args[i] : this.parameterDefaults[i]
    }
    return stack({
        scope: { variables, parent: this.scope },
        ip: { indexes: [0], functionIndex: this.index },
        targetReturn
    })
}
```

### Function Returns

When a function returns:

1. The return value is captured
2. The function's stack entry is removed
3. Execution continues in the calling context
4. If the function was called as a statement, the return value is yielded

## Expression Evaluation

### Expression Caching

Expressions are cached during execution to avoid re-evaluation:

```javascript
// Cache key is based on expression index
if (expressionsCacheIndex in this.stack[0].evaluatedCache!) {
    return this.stack[0].evaluatedCache![expressionsCacheIndex]
}

// Evaluate and cache
const calculated = this.evaluateExpression(expr)
this.stack[0].evaluatedCache![expressionsCacheIndex] = calculated
```

### L-Value Evaluation

Some expressions can be used as assignment targets:

```javascript
interface LValue {
    get(): MSValue
    set(value: MSValue): void
}
```

Examples:
- Variable references: `x`
- Object properties: `obj.property`
- Array elements: `arr[index]`

## Error Handling

### Execution Errors

Errors during execution are wrapped in `ExecutionError`:

```javascript
class ExecutionError extends Error {
    constructor(
        public executor: MiniScriptExecutor,
        public statement: ASTBase,
        message: string | Error
    )
}
```

### Error Context

Errors include:
- The executor instance (for state inspection)
- The AST statement that caused the error
- Source location information

### Error Recovery

The execution model doesn't include built-in error recovery, but the host application can:
1. Catch execution errors
2. Inspect the current state
3. Decide whether to continue or abort
4. Provide fallback behavior

## Performance Considerations

### Expression Caching

- Expressions are cached during single execution
- Cache is cleared between executions
- Prevents redundant calculations

### Loop Limits

- While loops are limited to 1000 iterations
- Prevents infinite loops
- Can be customized per executor

### Memory Management

- Execution stack grows with function calls
- Loop scopes are cleaned up on completion
- Expression cache is bounded by expression count

## Example Execution Flow

```miniscript
// Script
print "Starting..."
name = prompt("What's your name?")
if name != "" then
    print "Hello, " + name
end if
```

1. **IP: [0]** - Execute `print "Starting..."`
   - Calls context.print()
   - Advances IP to [1]

2. **IP: [1]** - Execute `name = prompt("What's your name?")`
   - Calls context.prompt()
   - Yields "What's your name?"
   - Returns to host application

3. **Host resumes** - Continue with IP [1]
   - Assignment completes
   - Advances IP to [2]

4. **IP: [2]** - Execute `if name != "" then`
   - Evaluates condition
   - Branches into if block
   - IP becomes [2, 0]

5. **IP: [2, 0]** - Execute `print "Hello, " + name`
   - Calls context.print()
   - Advances IP to [2, 1]

6. **IP: [2, 1]** - End of if block
   - Exits if block
   - IP becomes [3]

7. **IP: [3]** - End of script
   - Returns completion result

