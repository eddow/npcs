# Architecture

## Overview

NPCS is built on a modular architecture that separates concerns between parsing, execution, and state management. The system is designed to be extensible while maintaining simplicity and performance.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    NPCS Library                            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Lexer     │  │   Parser    │  │   AST Provider      │  │
│  │             │  │             │  │                     │  │
│  │ - Tokenize  │  │ - Build AST │  │ - AST Construction  │  │
│  │ - Validate  │  │ - Validate  │  │ - Function Registry │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Executor  │  │   Context   │  │   State Manager     │  │
│  │             │  │             │  │                     │  │
│  │ - Execute   │  │ - Variables │  │ - Serialization     │  │
│  │ - Yield     │  │ - Functions │  │ - Restoration       │  │
│  │ - Resume    │  │ - Types     │  │ - Validation        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Lexer (`src/script/lexer.ts`)

The lexer tokenizes MiniScript source code into a stream of tokens.

#### Key Features:
- **Character-based scanning**: Processes source code character by character
- **Token validation**: Validates tokens during scanning
- **Error reporting**: Provides detailed error locations
- **Unicode support**: Handles Unicode characters properly

#### Token Types:
```typescript
enum TokenType {
    // Literals
    NumericLiteral = 'NumericLiteral',
    StringLiteral = 'StringLiteral',
    BooleanLiteral = 'BooleanLiteral',
    NilLiteral = 'NilLiteral',
    
    // Identifiers
    Identifier = 'Identifier',
    
    // Keywords
    Function = 'Function',
    If = 'If',
    Else = 'Else',
    While = 'While',
    For = 'For',
    Return = 'Return',
    Break = 'Break',
    Continue = 'Continue',
    
    // Operators
    Plus = 'Plus',
    Minus = 'Minus',
    Asterisk = 'Asterisk',
    Slash = 'Slash',
    Equal = 'Equal',
    NotEqual = 'NotEqual',
    // ... more operators
    
    // Punctuation
    LeftParen = 'LeftParen',
    RightParen = 'RightParen',
    LeftBracket = 'LeftBracket',
    RightBracket = 'RightBracket',
    LeftBrace = 'LeftBrace',
    RightBrace = 'RightBrace',
    Comma = 'Comma',
    Semicolon = 'Semicolon',
    Dot = 'Dot',
    Colon = 'Colon',
    
    // Special
    EndOfFile = 'EndOfFile',
    Newline = 'Newline',
    Whitespace = 'Whitespace',
    Comment = 'Comment'
}
```

#### Scanning Process:
1. **Character classification**: Determine character type (letter, digit, operator, etc.)
2. **Token extraction**: Extract complete tokens based on character sequences
3. **Validation**: Validate token format and content
4. **Error handling**: Report syntax errors with precise locations

### 2. Parser (`src/script/parser.ts`)

The parser builds an Abstract Syntax Tree (AST) from the token stream.

#### Key Features:
- **Recursive descent parsing**: Uses recursive descent algorithm
- **Error recovery**: Attempts to recover from parse errors
- **AST construction**: Builds structured representation of code
- **Function registration**: Tracks function definitions

#### Parser States:
```typescript
class Parser {
    // Runtime state
    token?: Token
    previousToken?: Token
    currentScope?: ASTBaseBlockWithScope
    outerScopes: ASTBaseBlockWithScope[]
    
    // Helpers
    literals: ASTLiteral[]
    comments: ASTComment[]
    scopes: ASTBaseBlockWithScope[]
    backPatches: Stack<PendingBlock>
    
    // Settings
    content: string
    lexer: Lexer
    validator: Validator
    astProvider: ASTProvider
}
```

#### Parsing Process:
1. **Token consumption**: Read tokens from lexer
2. **Grammar matching**: Match tokens against grammar rules
3. **AST construction**: Create AST nodes for matched constructs
4. **Scope management**: Track variable and function scopes
5. **Back-patching**: Resolve forward references

### 3. AST (Abstract Syntax Tree)

The AST represents the parsed code structure.

#### AST Node Types:
```typescript
// Base AST node
abstract class ASTBase {
    type: string
    start?: Position
    end?: Position
}

// Statement types
class ASTAssignmentStatement extends ASTBase {
    variable: ASTBase
    init?: ASTBase
}

class ASTIfStatement extends ASTBase {
    clauses: ASTClause[]
}

class ASTWhileStatement extends ASTBase {
    condition: ASTBase
    body: ASTBaseBlock
}

class ASTForGenericStatement extends ASTBase {
    variable: ASTIdentifier
    iterator: ASTBase
    body: ASTBaseBlock
}

class ASTFunctionStatement extends ASTBase {
    name?: ASTIdentifier
    parameters: ASTBase[]
    body: ASTBaseBlock
}

// Expression types
class ASTBinaryExpression extends ASTBase {
    left: ASTBase
    operator: string
    right: ASTBase
}

class ASTCallExpression extends ASTBase {
    base: ASTBase
    arguments?: ASTBase[]
}

class ASTIdentifier extends ASTBase {
    name: string
}
```

### 4. Executor (`src/executor.ts`)

The executor runs the AST with stateful execution.

#### Key Features:
- **Instruction pointer**: Tracks execution position
- **Execution stack**: Manages function calls and scopes
- **State management**: Handles pause/resume functionality
- **Expression caching**: Caches evaluated expressions

#### Execution Stack:
```typescript
interface ExecutionStackEntry {
    scope: MSScope                    // Variable scope
    ip: IP                           // Instruction pointer
    loopScopes: LoopScope[]          // Loop state
    evaluatedCache?: Record<number, any> // Expression cache
    targetReturn?: number            // Return target
    loopOccurrences?: number         // Loop counter
}
```

#### Execution Process:
1. **Statement execution**: Execute current statement based on type
2. **IP advancement**: Move to next statement
3. **Branch handling**: Handle control flow (if, while, for)
4. **Function calls**: Manage function call stack
5. **Yielding**: Pause execution and return state

### 5. Context System

The context provides the execution environment.

#### Context Structure:
```typescript
type ExecutionContext = Record<string, any>
```

#### Context Features:
- **Variable access**: Global variables accessible to scripts
- **Function binding**: JavaScript functions callable from scripts
- **Type checking**: Custom type checking functions
- **Operator overloading**: Custom operators

### 6. State Management

State management enables pause/resume functionality.

#### State Serialization:
```typescript
function serializeState(key: string, value: any): any {
    // Handle function definitions
    if (value instanceof FunctionDefinition) {
        return {
            __type: 'FunctionDefinition',
            index: value.index,
            parameters: value.parameters,
            scope: value.scope,
            parameterDefaults: value.parameterDefaults,
        }
    }
    
    // Handle native functions (throw error)
    if (typeof value === 'function') {
        throw new Error('Functions cannot be serialized')
    }
    
    return value
}
```

#### State Restoration:
```typescript
function reviveState(key: string, value: any): any {
    if (value && typeof value === 'object' && value.__type === 'FunctionDefinition') {
        return new FunctionDefinition(
            value.index,
            value.parameters,
            value.scope,
            value.parameterDefaults ?? []
        )
    }
    return value
}
```

## Data Flow

### 1. Script Compilation

```
Source Code → Lexer → Tokens → Parser → AST → Function Registry
```

1. **Source code** is provided to `NpcScript` constructor
2. **Lexer** tokenizes the source code
3. **Parser** builds AST from tokens
4. **Function registry** tracks function definitions
5. **AST** is stored for execution

### 2. Script Execution

```
AST + Context + State → Executor → Execution Result
```

1. **Executor** is created with AST, context, and optional state
2. **Execution loop** processes statements sequentially
3. **State updates** track execution progress
4. **Result** is returned (return or yield)

### 3. State Persistence

```
Execution State → Serialization → Storage → Deserialization → Execution State
```

1. **Execution state** is extracted from executor
2. **Serialization** converts state to JSON
3. **Storage** saves state to persistent medium
4. **Deserialization** restores state from storage
5. **Execution** resumes with restored state

## Memory Management

### Object Lifecycle

1. **Script Creation**: AST is built and stored
2. **Execution**: Executor creates temporary objects
3. **State Saving**: State is serialized and stored
4. **State Loading**: State is deserialized and restored
5. **Cleanup**: Temporary objects are garbage collected

### Memory Optimization

- **Expression caching**: Prevents redundant evaluations
- **Lazy evaluation**: Expressions evaluated only when needed
- **State compression**: Minimize serialized state size
- **Garbage collection**: Automatic cleanup of unused objects

## Error Handling

### Error Types

1. **Lexer errors**: Invalid token sequences
2. **Parser errors**: Invalid syntax
3. **Execution errors**: Runtime errors
4. **State errors**: Serialization/deserialization errors

### Error Recovery

- **Lexer recovery**: Skip invalid tokens and continue
- **Parser recovery**: Attempt to parse remaining code
- **Execution recovery**: Provide error context and location
- **State recovery**: Validate state before restoration

## Performance Considerations

### Optimization Strategies

1. **Expression caching**: Cache evaluated expressions
2. **Lazy loading**: Load data only when needed
3. **State compression**: Minimize state size
4. **Loop limits**: Prevent infinite loops
5. **Memory pooling**: Reuse objects when possible

### Performance Metrics

- **Parse time**: Time to build AST from source
- **Execution time**: Time to execute statements
- **State size**: Size of serialized state
- **Memory usage**: Runtime memory consumption

## Extensibility

### Custom Operators

```typescript
interface Operators {
    [operator: string]: (left: any, right: any) => any
}

const customOperators: Operators = {
    '**': (left, right) => Math.pow(left, right),
    '//': (left, right) => Math.floor(left / right),
    // ... more operators
}
```

### Custom Types

```typescript
type IsaTypes = Record<string, (value: any) => boolean>

const customIsaTypes: IsaTypes = {
    vector: (value) => value && typeof value.x === 'number' && typeof value.y === 'number',
    color: (value) => typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value),
    // ... more types
}
```

### Custom AST Nodes

```typescript
class CustomASTNode extends ASTBase {
    type = 'CustomNode'
    customProperty: any
    
    constructor(customProperty: any) {
        super()
        this.customProperty = customProperty
    }
}
```

## Security Considerations

### Sandboxing

- **Context isolation**: Scripts only access provided context
- **Function restrictions**: Limit available JavaScript functions
- **Resource limits**: Prevent excessive resource usage
- **State validation**: Validate state before restoration

### Best Practices

1. **Validate inputs**: Check all script inputs
2. **Limit context**: Provide minimal necessary context
3. **Monitor execution**: Track execution time and resources
4. **Secure storage**: Encrypt sensitive state data

## Testing Architecture

### Unit Testing

- **Lexer tests**: Test tokenization
- **Parser tests**: Test AST construction
- **Executor tests**: Test execution logic
- **State tests**: Test serialization/deserialization

### Integration Testing

- **End-to-end tests**: Test complete workflows
- **Performance tests**: Test execution performance
- **State persistence tests**: Test state saving/loading
- **Error handling tests**: Test error scenarios

## Future Extensions

### Planned Features

1. **Async/await support**: Native async operation support
2. **Module system**: Import/export functionality
3. **Debugger integration**: Step-through debugging
4. **Performance profiling**: Built-in performance monitoring
5. **Hot reloading**: Runtime script updates

### Architecture Evolution

The current architecture is designed to support these future extensions:

- **Modular design**: Easy to add new components
- **Extensible interfaces**: Support for custom implementations
- **State management**: Foundation for advanced features
- **Error handling**: Robust error reporting and recovery

This architecture provides a solid foundation for the NPCS library while maintaining flexibility for future enhancements and customizations.

