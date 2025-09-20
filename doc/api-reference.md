# API Reference

## Core Classes

### NpcScript

The main class for creating and executing MiniScript code.

```typescript
class NpcScript {
    constructor(
        source: string,
        operators?: Operators,
        isaTypes?: IsaTypes
    )
    
    // Properties
    ast: any
    functions: ASTFunctionStatement[]
    functionIndexes: Map<ASTFunctionStatement, number>
    fileName: string
    
    // Methods
    function(index?: number): ASTBaseBlock
    executor(context: ExecutionContext, state?: ExecutionState): MiniScriptExecutor
    execute(context: ExecutionContext, state?: ExecutionState): NpcReturn
    evaluator<Args extends any[], Return>(
        fct: FunctionDefinition,
        context: ExecutionContext
    ): (...args: Args) => Return
    sourceLocation(expr: ASTBase): string
}
```

#### Constructor

```javascript
const script = new NpcScript(sourceCode, operators, isaTypes)
```

**Parameters:**
- `source` (string): The MiniScript source code
- `operators` (Operators, optional): Custom operators (defaults to `jsOperators`)
- `isaTypes` (IsaTypes, optional): Custom type checking functions (defaults to `jsIsaTypes`)

#### Methods

##### `executor(context, state?)`

Creates a new executor instance for this script.

```javascript
const executor = script.executor(context, savedState)
```

##### `execute(context, state?)`

Executes the script and returns the result.

```javascript
const result = script.execute(context, savedState)
```

**Returns:** `NpcReturn`
- `{type: 'return', value?: any}` - Script completed
- `{type: 'yield', value: any, state: ExecutionState}` - Script yielded

##### `evaluator(fct, context)`

Creates a JavaScript function that can be called from JavaScript code.

```javascript
const jsFunction = script.evaluator(functionDef, context)
const result = jsFunction(arg1, arg2)
```

##### `sourceLocation(expr)`

Returns a formatted string showing the source location of an AST expression.

```javascript
const location = script.sourceLocation(astNode)
// Returns: "filename:line:column\nsource line\n    ^"
```

### MiniScriptExecutor

Handles the execution of MiniScript code with state management.

```typescript
class MiniScriptExecutor {
    constructor(
        specs: NpcScript | string,
        context: ExecutionContext,
        state?: ExecutionState
    )
    
    // Properties
    script: NpcScript
    state: ExecutionState
    
    // Methods
    execute(): FunctionResult
    *[Symbol.iterator](): Generator<any, any, unknown>
}
```

#### Constructor

```javascript
const executor = new MiniScriptExecutor(script, context, state)
```

**Parameters:**
- `specs` (NpcScript | string): Script instance or source code string
- `context` (ExecutionContext): Execution context with functions and variables
- `state` (ExecutionState, optional): Saved execution state to resume from

#### Methods

##### `execute()`

Executes the script and returns the result.

```javascript
const result = executor.execute()
```

**Returns:** `FunctionResult`
- `{type: 'return', value?: any}` - Execution completed
- `{type: 'yield', value: any}` - Execution yielded

##### Iterator

The executor implements the iterator protocol for easy iteration:

```javascript
for (const value of executor) {
    console.log('Yielded:', value)
    // Break when script completes
}
```

## Types

### ExecutionContext

```typescript
type ExecutionContext = Record<string, any>
```

The execution context is a JavaScript object that provides functions and variables to the MiniScript code.

```javascript
const context = {
    print: (msg) => console.log(msg),
    prompt: (question) => getUserInput(question),
    gameState: { score: 0, level: 1 },
    customFunction: (x, y) => x + y
}
```

### ExecutionState

```typescript
type ExecutionState = ExecutionStackEntry[]
```

The execution state represents the current state of script execution and can be serialized for saving/loading.

```javascript
// Save state
const stateJson = JSON.stringify(executor.state, serializeState)

// Load state
const savedState = JSON.parse(stateJson, reviveState)
```

### ExecutionStackEntry

```typescript
interface ExecutionStackEntry {
    scope: MSScope
    ip: IP
    loopScopes: (LoopScope | ForScope | WhileScope)[]
    evaluatedCache?: Record<number, any>
    targetReturn?: number
    loopOccurrences?: number
}
```

Represents a single frame in the execution stack.

### IP (Instruction Pointer)

```typescript
type IP = {
    indexes: number[]
    functionIndex?: number
}
```

Tracks the current execution position within the script.

### FunctionResult

```typescript
type FunctionResult = { type: 'return' | 'yield'; value?: any }
```

The result of executing a function or script.

### NpcReturn

```typescript
type NpcReturn = 
    | { type: 'return'; value?: any }
    | { type: 'yield'; value: any; state: ExecutionState }
```

The return type from `NpcScript.execute()`.

## Operators

### Operators Interface

```typescript
interface Operators {
    '+'(left: any, right: any): any
    '-'(left: any, right: any): any
    '*'(left: any, right: any): any
    '/'(left: any, right: any): any
    '%'(left: any, right: any): any
    '>'(left: any, right: any): any
    '<'(left: any, right: any): any
    '>='(left: any, right: any): any
    '<='(left: any, right: any): any
    '=='(left: any, right: any): any
    '!='(left: any, right: any): any
    '!.'(argument: any): any
    '-.'(argument: any): any
    '+.'(argument: any): any
}
```

### Default Operators (jsOperators)

```javascript
import { jsOperators } from 'npc-script'

// Arithmetic
jsOperators['+'](5, 3)    // 8
jsOperators['-'](5, 3)    // 2
jsOperators['*'](5, 3)    // 15
jsOperators['/'](15, 3)   // 5
jsOperators['%'](10, 3)   // 1

// Comparison
jsOperators['>'](5, 3)    // true
jsOperators['<'](5, 3)    // false
jsOperators['=='](5, 5)   // true
jsOperators['!='](5, 3)   // true

// Unary
jsOperators['!.'](true)   // false
jsOperators['-.'](5)      // -5
jsOperators['+.'](5)      // 5
```

## Type Checking

### IsaTypes Interface

```typescript
type IsaTypes = Record<string, (value: any) => boolean>
```

### Default Type Checkers (jsIsaTypes)

```javascript
import { jsIsaTypes } from 'npc-script'

jsIsaTypes.number(42)     // true
jsIsaTypes.string("hi")   // true
jsIsaTypes.boolean(true)  // true
jsIsaTypes.list([1,2,3])  // true
jsIsaTypes.map({a: 1})    // true
```

## Utility Functions

### serializeState

```typescript
function serializeState(key: string, value: any): any
```

Custom JSON serializer for execution state. Handles function definitions and other special objects.

```javascript
const stateJson = JSON.stringify(executor.state, serializeState)
```

### reviveState

```typescript
function reviveState(key: string, value: any): any
```

Custom JSON deserializer for execution state. Restores function definitions and other special objects.

```javascript
const savedState = JSON.parse(stateJson, reviveState)
```

### stack

```typescript
function stack(partial?: Partial<ExecutionStackEntry>): ExecutionStackEntry
```

Creates a new execution stack entry with default values.

```javascript
const newStackEntry = stack({
    scope: { variables: { x: 1 } }
})
```

### isCallable

```typescript
function isCallable(value: any): value is Callable
```

Checks if a value can be called as a function.

```javascript
if (isCallable(someValue)) {
    const result = someValue(args)
}
```

## Error Classes

### ExecutionError

```typescript
class ExecutionError extends Error {
    constructor(
        executor: MiniScriptExecutor,
        statement: ASTBase,
        message: string | Error
    )
    
    // Properties
    executor: MiniScriptExecutor
    statement: ASTBase
    error?: Error
}
```

Runtime error during script execution.

```javascript
try {
    const result = script.execute(context)
} catch (error) {
    if (error instanceof ExecutionError) {
        console.error('Script error:', error.message)
        console.error('Location:', error.executor.script.sourceLocation(error.statement))
    }
}
```

## Helper Functions

### lexerExceptionLocation

```typescript
function lexerExceptionLocation(
    error: LexerException | ParserException,
    source: string
): string
```

Formats lexer/parser errors with source location information.

```javascript
try {
    const script = new NpcScript(sourceCode)
} catch (error) {
    if (error instanceof LexerException || error instanceof ParserException) {
        console.error(lexerExceptionLocation(error, sourceCode))
    }
}
```

## Example Usage

```javascript
import { 
    NpcScript, 
    MiniScriptExecutor, 
    serializeState, 
    reviveState,
    ExecutionError 
} from 'npc-script'

// Create script
const script = new NpcScript(`
    print "Hello, " + name
    yield "What should I do?"
    print "Thanks for the guidance!"
`)

// Define context
const context = {
    print: (msg) => console.log(msg),
    name: "Alice"
}

// Execute script
try {
    const result = script.execute(context)
    
    if (result.type === 'yield') {
        console.log('Script yielded:', result.value)
        
        // Save state
        const stateJson = JSON.stringify(result.state, serializeState)
        localStorage.setItem('npc_state', stateJson)
        
        // Later, restore and continue
        const savedState = JSON.parse(localStorage.getItem('npc_state'), reviveState)
        const finalResult = script.execute(context, savedState)
    }
} catch (error) {
    if (error instanceof ExecutionError) {
        console.error('Script error:', error.message)
        console.error('Location:', error.executor.script.sourceLocation(error.statement))
    }
}
```

