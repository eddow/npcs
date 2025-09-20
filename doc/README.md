# NPCS Documentation

Welcome to the NPCS (NPC Script) library documentation. This is a comprehensive MiniScript executor with linear stateful execution, designed for creating interactive NPCs and game scripts that can be paused, saved, and resumed.

## Table of Contents

- [Overview](./overview.md) - Introduction and core concepts
- [Getting Started](./getting-started.md) - Installation and basic usage
- [Language Reference](./language-reference.md) - Complete MiniScript syntax guide
- [Do-While Loops](./do-while-loops.md) - Comprehensive guide to the new do-while loop syntax
- [API Reference](./api-reference.md) - JavaScript API documentation
- [Execution Model](./execution-model.md) - How scripts execute and yield
- [State Management](./state-management.md) - Saving and restoring execution state
- [Advanced Features](./advanced-features.md) - Custom operators, types, and extensions
- [Examples](./examples.md) - Practical examples and use cases
- [Architecture](./architecture.md) - Internal structure and design
- [Testing](./testing.md) - Testing strategies and examples
- [VSCode Extension](./vscode-extension.md) - Language support and tooling

## Quick Start

```javascript
import { NpcScript } from 'npc-script'

const script = new NpcScript(`
    name = "Alice"
    print "Hello, " + name
    yield "What should I do next?"
    print "Thanks for the guidance!"
`)

const context = {
    print: (msg) => console.log(msg)
}

const result = script.execute(context)
// { type: 'yield', value: 'What should I do next?', state: [...] }
```

## Key Features

- ✅ **Complete MiniScript Support**: Variables, functions, objects, arrays, control flow
- ✅ **Stateful Execution**: Scripts can be paused and resumed
- ✅ **State Serialization**: Complete execution state can be saved and restored
- ✅ **Cross-Executor Restoration**: Resume execution in a completely new executor instance
- ✅ **Custom Context**: Provide JavaScript functions and values to scripts
- ✅ **Error Handling**: Detailed error reporting with source locations
- ✅ **TypeScript Support**: Full type definitions included

## Use Cases

- **NPCs in Games**: Create interactive characters that can pause their behavior
- **Scripted Sequences**: Complex multi-step processes that can be interrupted
- **Interactive Stories**: Branching narratives with state preservation
- **Automation Scripts**: Long-running processes that need to be resumable

## License

This project is based on the [MiniScript Core](https://github.com/ayecue/miniscript-core) and extends it with stateful execution capabilities.

