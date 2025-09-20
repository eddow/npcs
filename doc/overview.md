# Overview

## What is NPCS?

NPCS (NPC Script) is a comprehensive MiniScript executor with linear stateful execution. It's designed to solve a specific problem: **creating NPCs that can pause their complex async scripts and resume them later**.

## The Problem

Imagine your NPC is executing a complex script:
```
go to that room → open a chest → kill an apple → ...
```

Of course, these are full of async/await as each step takes time. When your goblin is about to open a door, your mom comes home, you save, install a windows update, reboot...

In the evening, you load your game again - and your goblin finishes opening the door and the remaining of his script.

## The Solution

NPCS provides:

1. **Stateful Execution**: Scripts can yield control back to the host application
2. **State Serialization**: Complete execution state can be saved to disk
3. **Cross-Session Restoration**: Resume execution in a completely new executor instance
4. **MiniScript Language**: A simple, readable scripting language

## Core Concepts

### Execution Results

When you execute a script, it returns one of two results:

- `{type: 'return', value?: any}` - The script completed and returned a value
- `{type: 'yield', value: any, state: string}` - The script yielded, use the value and store the state to resume later

### Yielding in MiniScript

Functions can be *evaluated* with `a(x, y, z)` or *stated* - like in `print "Hello"`.

When a function is *stated*, if it returns a value, this value is yielded.

This will yield "Hello!":
```miniscript
say = function(text)
    return text + "!"
end function

say "Hello"
```

### Context Integration

A context with "global" values is provided by JavaScript, and the context can provide functions that can return stuff (which will be yielded if these functions are stated).

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   MiniScript    │───▶│   Lexer/Parser   │───▶│   AST (Tree)    │
│   Source Code   │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Execution      │◀───│  MiniScript      │◀───│  Function       │
│  Context        │    │  Executor        │    │  Definitions    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Components

1. **Lexer**: Tokenizes MiniScript source code
2. **Parser**: Builds Abstract Syntax Tree (AST)
3. **Executor**: Executes the AST with state management
4. **Context**: JavaScript environment with functions and variables
5. **State**: Serializable execution state for pause/resume

## Key Features

### 1. Complete MiniScript Support
- Variables and assignments
- Function definitions and calls
- Control flow (if/else, while, for loops)
- Data structures (objects, arrays)
- Operators and expressions

### 2. Stateful Execution
- Scripts can yield control at any point
- Execution state is fully serializable
- Can resume from any saved state
- Cross-session state restoration

### 3. Extensible Context
- Provide custom JavaScript functions
- Access to host application data
- Custom operators and type checks
- Seamless JavaScript integration

### 4. Error Handling
- Detailed error messages with source locations
- Syntax error reporting
- Runtime error context
- Debug-friendly stack traces

## Example Use Case

```javascript
// Create an NPC script
const script = new NpcScript(`
    print "I'm walking to the door..."
    yield "Should I open it?"
    
    if playerSaidYes then
        print "Opening the door..."
        yield "Door opened!"
    else
        print "I'll wait here..."
        yield "Waiting..."
    end if
`)

// First execution
const context = { 
    print: (msg) => console.log(msg),
    playerSaidYes: false 
}
const result1 = script.execute(context)
// { type: 'yield', value: 'Should I open it?', state: [...] }

// Save state to disk, user closes game...

// Later, restore and continue
const savedState = loadFromDisk()
const result2 = script.execute(context, savedState)
// { type: 'yield', value: 'Waiting...', state: [...] }
```

This is the core value proposition of NPCS: **scripts that can pause and resume across sessions**.

