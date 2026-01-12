# Getting Started

## Installation

```bash
npm install npc-script
```

## Basic Usage

### 1. Import the Library

```javascript
import { NpcScript, ScriptExecutor } from 'npc-script'
```

### 2. Create a Script

```javascript
const script = new NpcScript(`
    name = "Alice"
    print "Hello, " + name
    yield "What should I do next?"
    print "Thanks for the guidance!"
`)
```

### 3. Define Execution Context

```javascript
const context = {
    print: (msg) => console.log(msg),
    // Add your custom functions and variables here
}
```

### 4. Execute the Script

```javascript
const result = script.execute(context)

if (result.type === 'yield') {
    console.log('Script yielded:', result.value)
    // Save result.state for later resumption
} else if (result.type === 'return') {
    console.log('Script completed with:', result.value)
}
```

## Complete Example

Here's a simple interactive script:

```javascript
import { NpcScript } from 'npc-script'

const script = new NpcScript(`
    print "Welcome to the game!"
    name = prompt("What's your name?")
    
    if name == "" then
        name = "Stranger"
    end if
    
    print "Hello, " + name + "!"
    
    choice = prompt("Choose: attack, defend, or run")
    
    if choice == "attack" then
        print "You attack with courage!"
        yield "attack_result"
    else if choice == "defend" then
        print "You take a defensive stance."
        yield "defend_result"
    else
        print "You run away safely."
        yield "run_result"
    end if
    
    print "Thanks for playing!"
`)

const context = {
    print: (msg) => console.log(msg),
    prompt: (question) => {
        console.log(question)
        return "attack" // In real usage, get input from user
    }
}

// Execute the script
let state = null
const result = script.execute(context, state)

console.log('Execution result:', result)
```

## Using the Executor Directly

For more control, you can use the `ScriptExecutor` directly:

```javascript
import { ScriptExecutor } from 'npc-script'

const executor = new ScriptExecutor(sourceCode, context, savedState)

// Execute one step at a time
const result = executor.execute()

// Access the current state
const currentState = executor.state

// Check if execution is complete
if (result.type === 'return') {
    console.log('Script finished:', result.value)
} else if (result.type === 'yield') {
    console.log('Script yielded:', result.value)
    // Save executor.state for later resumption
}
```

## State Management

### Saving State

```javascript
const result = script.execute(context)

if (result.type === 'yield') {
    // Save the state to disk
    const stateJson = JSON.stringify(result.state, serializeState)
    localStorage.setItem('npc_state', stateJson)
}
```

### Restoring State

```javascript
// Load state from disk
const stateJson = localStorage.getItem('npc_state')
const savedState = JSON.parse(stateJson, reviveState)

// Resume execution
const result = script.execute(context, savedState)
```

### Serialization Helpers

```javascript
import { serializeState, reviveState } from 'npc-script'

// When saving
const stateJson = JSON.stringify(result.state, serializeState)

// When loading
const savedState = JSON.parse(stateJson, reviveState)
```

## CLI Usage

You can also run MiniScript files directly from the command line:

```bash
# Run a script file
npx tsx cli.ts my-script.npcs

# Run a test fixture
npx tsx cli.ts basic
```

## Error Handling

```javascript
try {
    const result = script.execute(context)
} catch (error) {
    if (error instanceof ExecutionError) {
        console.error('Script error:', error.message)
        console.error('Location:', error.executor.script.sourceLocation(error.statement))
    } else {
        console.error('Unexpected error:', error)
    }
}
```

## Next Steps

- Read the [Language Reference](./language-reference.md) to learn MiniScript syntax
- Check out [Examples](./examples.md) for practical use cases
- Explore [Advanced Features](./advanced-features.md) for custom operators and types

