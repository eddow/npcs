# State Management

## Overview

State management is a core feature of NPCS that allows scripts to pause execution, save their state, and resume later. This enables long-running scripts that can survive application restarts, user interruptions, or system updates.

## State Structure

### ExecutionState

The execution state is represented as an array of stack entries:

```typescript
type ExecutionState = ExecutionStackEntry[]
```

Each `ExecutionStackEntry` contains:

```typescript
interface ExecutionStackEntry {
    scope: MSScope                    // Variable scope with parent chain
    ip: IP                           // Instruction pointer
    loopScopes: (LoopScope | ForScope | WhileScope)[] // Active loop states
    evaluatedCache?: Record<number, any> // Expression evaluation cache
    targetReturn?: number            // Return target for function calls
    loopOccurrences?: number         // Loop iteration counter
}
```

### Variable Scope

```typescript
type MSScope = {
    variables: Record<string, any>    // Local variables
    parent?: MSScope                 // Parent scope (closure)
}
```

Variables are resolved by walking up the scope chain:
1. Check loop scopes (for loop variables)
2. Check current scope variables
3. Check parent scope variables
4. Check execution context (global variables)

### Instruction Pointer

```typescript
type IP = {
    indexes: number[]      // Path through nested statement blocks
    functionIndex?: number // Current function index (if in function)
}
```

The `indexes` array represents the execution path:
- `[0]` - First statement in main script
- `[1, 0]` - First statement in second nested block
- `[0, 2, 1]` - Second statement in third nested block of first block

## Serialization

### serializeState Function

```typescript
function serializeState(key: string, value: any): any
```

This function handles serialization of execution state, with special handling for:

#### Function Definitions

```javascript
if (value instanceof FunctionDefinition) {
    return {
        __type: 'FunctionDefinition',
        index: value.index,
        parameters: value.parameters,
        scope: value.scope,
        parameterDefaults: value.parameterDefaults,
    }
}
```

#### Native Functions

```javascript
if (typeof value === 'function') {
    throw new Error(`Not implemented: Functions cannot be serialized
In order to have native functions in the serialized state (in variables or used as parameters),
    a custom (de)serializer has to be provided`)
}
```

### reviveState Function

```typescript
function reviveState(key: string, value: any): any
```

Restores serialized state, with special handling for:

#### Function Definitions

```javascript
if (value && typeof value === 'object' && value.__type === 'FunctionDefinition') {
    return new FunctionDefinition(
        value.index,
        value.parameters,
        value.scope,
        value.parameterDefaults ?? []
    )
}
```

## Saving and Loading State

### Basic Usage

```javascript
// Execute script and get state
const result = script.execute(context)

if (result.type === 'yield') {
    // Save state
    const stateJson = JSON.stringify(result.state, serializeState)
    localStorage.setItem('npc_state', stateJson)
    
    // Later, load and resume
    const savedStateJson = localStorage.getItem('npc_state')
    const savedState = JSON.parse(savedStateJson, reviveState)
    
    const finalResult = script.execute(context, savedState)
}
```

### File-Based Storage

```javascript
import fs from 'fs'

// Save to file
function saveState(state, filename) {
    const stateJson = JSON.stringify(state, serializeState, 2)
    fs.writeFileSync(filename, stateJson)
}

// Load from file
function loadState(filename) {
    const stateJson = fs.readFileSync(filename, 'utf8')
    return JSON.parse(stateJson, reviveState)
}

// Usage
const result = script.execute(context)
if (result.type === 'yield') {
    saveState(result.state, 'npc_state.json')
}

// Later...
const savedState = loadState('npc_state.json')
const finalResult = script.execute(context, savedState)
```

### Database Storage

```javascript
// Save to database
async function saveStateToDB(state, npcId) {
    const stateJson = JSON.stringify(state, serializeState)
    await db.npcs.update(npcId, { state: stateJson })
}

// Load from database
async function loadStateFromDB(npcId) {
    const npc = await db.npcs.findById(npcId)
    if (npc.state) {
        return JSON.parse(npc.state, reviveState)
    }
    return null
}
```

## State Persistence Strategies

### 1. Automatic State Saving

Save state on every yield:

```javascript
class StatefulNPC {
    constructor(script, context, storage) {
        this.script = script
        this.context = context
        this.storage = storage
    }
    
    async execute(initialState = null) {
        let state = initialState
        
        while (true) {
            const result = this.script.execute(this.context, state)
            
            if (result.type === 'return') {
                return result.value
            }
            
            if (result.type === 'yield') {
                // Save state automatically
                await this.storage.save(result.state)
                
                // Wait for external input/event
                await this.waitForResume()
                
                state = result.state
            }
        }
    }
    
    async waitForResume() {
        // Implementation depends on your application
        // Could wait for user input, network event, timer, etc.
    }
}
```

### 2. Checkpoint-Based Saving

Save state at specific points:

```javascript
class CheckpointNPC {
    constructor(script, context, storage) {
        this.script = script
        this.context = context
        this.storage = storage
    }
    
    async executeWithCheckpoints(initialState = null) {
        let state = initialState
        let checkpointCount = 0
        
        while (true) {
            const result = this.script.execute(this.context, state)
            
            if (result.type === 'return') {
                return result.value
            }
            
            if (result.type === 'yield') {
                checkpointCount++
                
                // Save checkpoint every 10 yields
                if (checkpointCount % 10 === 0) {
                    await this.storage.saveCheckpoint(checkpointCount, result.state)
                }
                
                await this.waitForResume()
                state = result.state
            }
        }
    }
}
```

### 3. Event-Driven State Management

Save state based on game events:

```javascript
class GameNPC {
    constructor(script, context, gameState) {
        this.script = script
        this.context = context
        this.gameState = gameState
        
        // Save state on important game events
        gameState.on('playerLogin', () => this.saveState())
        gameState.on('playerLogout', () => this.saveState())
        gameState.on('gameSave', () => this.saveState())
    }
    
    async saveState() {
        if (this.currentState) {
            await this.gameState.saveNPCState(this.id, this.currentState)
        }
    }
}
```

## State Validation

### State Integrity Checks

```javascript
function validateState(state) {
    if (!Array.isArray(state)) {
        throw new Error('Invalid state: not an array')
    }
    
    for (const entry of state) {
        if (!entry.scope || !entry.ip) {
            throw new Error('Invalid state: missing required fields')
        }
        
        if (!Array.isArray(entry.ip.indexes)) {
            throw new Error('Invalid state: invalid IP structure')
        }
    }
    
    return true
}

// Usage
try {
    validateState(savedState)
    const result = script.execute(context, savedState)
} catch (error) {
    console.error('State validation failed:', error.message)
    // Start fresh
    const result = script.execute(context)
}
```

### State Migration

Handle state format changes:

```javascript
function migrateState(state, version) {
    switch (version) {
        case 1:
            // Migrate from version 1 to 2
            return migrateV1ToV2(state)
        case 2:
            // Already current version
            return state
        default:
            throw new Error(`Unknown state version: ${version}`)
    }
}

function migrateV1ToV2(state) {
    // Add new fields, transform old fields, etc.
    return state.map(entry => ({
        ...entry,
        // Add new fields with defaults
        newField: 'defaultValue'
    }))
}
```

## Cross-Session State Restoration

### Application Restart

```javascript
class PersistentNPC {
    constructor(script, context, storage) {
        this.script = script
        this.context = context
        this.storage = storage
    }
    
    async initialize() {
        // Try to restore previous state
        const savedState = await this.storage.load()
        
        if (savedState) {
            console.log('Restoring NPC from saved state')
            this.currentState = savedState
        } else {
            console.log('Starting NPC fresh')
            this.currentState = null
        }
    }
    
    async resume() {
        const result = this.script.execute(this.context, this.currentState)
        
        if (result.type === 'yield') {
            this.currentState = result.state
            await this.storage.save(this.currentState)
            return result.value
        }
        
        return result.value
    }
}
```

### Cross-Instance State Sharing

Share state between multiple application instances:

```javascript
class SharedStateNPC {
    constructor(script, context, sharedStorage) {
        this.script = script
        this.context = context
        this.sharedStorage = sharedStorage
        this.npcId = 'npc_' + Math.random().toString(36).substr(2, 9)
    }
    
    async execute() {
        // Load state from shared storage
        const savedState = await this.sharedStorage.get(this.npcId)
        
        const result = this.script.execute(this.context, savedState)
        
        if (result.type === 'yield') {
            // Save state to shared storage
            await this.sharedStorage.set(this.npcId, result.state)
            return result.value
        }
        
        // Clear state when complete
        await this.sharedStorage.delete(this.npcId)
        return result.value
    }
}
```

## Performance Considerations

### State Size Optimization

```javascript
// Minimize state size by excluding unnecessary data
function optimizeState(state) {
    return state.map(entry => ({
        scope: {
            variables: entry.scope.variables,
            // Don't include parent scope if not needed
            parent: entry.scope.parent ? { variables: {} } : undefined
        },
        ip: entry.ip,
        loopScopes: entry.loopScopes,
        // Clear expression cache to reduce size
        evaluatedCache: undefined,
        targetReturn: entry.targetReturn,
        loopOccurrences: entry.loopOccurrences
    }))
}
```

### Compression

```javascript
import zlib from 'zlib'

// Compress state before storage
function compressState(state) {
    const stateJson = JSON.stringify(state, serializeState)
    return zlib.gzipSync(stateJson)
}

// Decompress state after loading
function decompressState(compressedState) {
    const stateJson = zlib.gunzipSync(compressedState).toString()
    return JSON.parse(stateJson, reviveState)
}
```

## Error Handling

### State Corruption Recovery

```javascript
function safeStateRestore(state, fallbackState = null) {
    try {
        // Validate state structure
        validateState(state)
        
        // Test state by creating executor
        const testExecutor = new ScriptExecutor('', {}, state)
        
        return state
    } catch (error) {
        console.warn('State corruption detected:', error.message)
        
        if (fallbackState) {
            console.log('Using fallback state')
            return fallbackState
        }
        
        console.log('Starting with fresh state')
        return null
    }
}
```

### State Backup

```javascript
class BackupNPC {
    constructor(script, context, storage) {
        this.script = script
        this.context = context
        this.storage = storage
        this.backupCount = 0
    }
    
    async saveWithBackup(state) {
        // Save current state as backup
        if (this.backupCount > 0) {
            await this.storage.saveBackup(this.backupCount - 1, state)
        }
        
        // Save new state
        await this.storage.save(state)
        this.backupCount++
        
        // Keep only last 5 backups
        if (this.backupCount > 5) {
            await this.storage.deleteBackup(this.backupCount - 6)
        }
    }
}
```

## Best Practices

1. **Always validate state** before restoration
2. **Use compression** for large states
3. **Implement fallback mechanisms** for corrupted states
4. **Save state frequently** but not too frequently
5. **Clear expression cache** when saving (it will be regenerated)
6. **Handle state migration** for long-running applications
7. **Use unique identifiers** for cross-instance state sharing
8. **Implement state cleanup** when scripts complete

