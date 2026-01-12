# Advanced Features

## Custom Operators

NPCS allows you to define custom operators to extend the language with domain-specific functionality.

### Defining Custom Operators

```javascript
import { NpcScript } from 'npc-script'

const customOperators = {
    // Standard operators
    '+': (left, right) => left + right,
    '-': (left, right) => left - right,
    '*': (left, right) => left * right,
    '/': (left, right) => left / right,
    
    // Custom operators
    '**': (left, right) => Math.pow(left, right),  // Exponentiation
    '//': (left, right) => Math.floor(left / right), // Integer division
    '..': (left, right) => {  // Range operator
        const result = []
        for (let i = left; i <= right; i++) {
            result.push(i)
        }
        return result
    },
    
    // String operators
    '~': (left, right) => left.includes(right),     // Contains
    '^': (left, right) => left.startsWith(right),   // Starts with
    '$': (left, right) => left.endsWith(right),     // Ends with
    
    // Unary operators
    '!.': (arg) => !arg,
    '-.': (arg) => -arg,
    '+.': (arg) => +arg,
    '#': (arg) => arg.length,  // Length operator
}

const script = new NpcScript(`
    // Use custom operators
    power = 2 ** 3          // 8
    div = 10 // 3           // 3
    range = 1..5            // [1, 2, 3, 4, 5]
    hasHello = "hello world" ~ "hello"  // true
    startsWithH = "hello" ^ "h"         // true
    length = #"hello"       // 5
`, customOperators)
```

### Game-Specific Operators

```javascript
const gameOperators = {
    // Distance calculation
    'distance': (pos1, pos2) => {
        const dx = pos1.x - pos2.x
        const dy = pos1.y - pos2.y
        return Math.sqrt(dx * dx + dy * dy)
    },
    
    // Vector addition
    'vec+': (vec1, vec2) => ({
        x: vec1.x + vec2.x,
        y: vec1.y + vec2.y
    }),
    
    // Vector scaling
    'vec*': (vec, scalar) => ({
        x: vec.x * scalar,
        y: vec.y * scalar
    }),
    
    // Standard operators
    '+': (left, right) => left + right,
    // ... other standard operators
}

const gameScript = new NpcScript(`
    playerPos = {x: 10, y: 20}
    targetPos = {x: 30, y: 40}
    
    distance = playerPos distance targetPos
    newPos = playerPos vec+ {x: 5, y: 5}
    scaledPos = newPos vec* 2
`, gameOperators)
```

## Custom Type Checking

Define custom type checking functions for the `isa` operator.

### Defining Custom ISA Types

```javascript
import { NpcScript } from 'npc-script'

const customIsaTypes = {
    // Standard types
    number: (value) => typeof value === 'number',
    string: (value) => typeof value === 'string',
    boolean: (value) => typeof value === 'boolean',
    list: (value) => Array.isArray(value),
    map: (value) => value !== null && typeof value === 'object' && !Array.isArray(value),
    
    // Custom types
    vector: (value) => {
        return value && 
               typeof value === 'object' && 
               typeof value.x === 'number' && 
               typeof value.y === 'number'
    },
    
    color: (value) => {
        return typeof value === 'string' && 
               /^#[0-9A-Fa-f]{6}$/.test(value)
    },
    
    weapon: (value) => {
        return value && 
               typeof value === 'object' && 
               typeof value.damage === 'number' &&
               typeof value.durability === 'number'
    },
    
    npc: (value) => {
        return value && 
               typeof value === 'object' &&
               typeof value.name === 'string' &&
               typeof value.health === 'number'
    }
}

const script = new NpcScript(`
    pos = {x: 10, y: 20}
    if pos isa vector then
        print "It's a vector!"
    end if
    
    weapon = {damage: 10, durability: 100}
    if weapon isa weapon then
        print "It's a weapon!"
    end if
`, undefined, customIsaTypes)
```

### Game Entity Types

```javascript
const gameIsaTypes = {
    // ... standard types
    
    player: (value) => {
        return value && 
               typeof value === 'object' &&
               typeof value.id === 'string' &&
               typeof value.health === 'number' &&
               typeof value.level === 'number'
    },
    
    item: (value) => {
        return value && 
               typeof value === 'object' &&
               typeof value.id === 'string' &&
               typeof value.stackable === 'boolean'
    },
    
    quest: (value) => {
        return value && 
               typeof value === 'object' &&
               typeof value.id === 'string' &&
               typeof value.completed === 'boolean'
    },
    
    location: (value) => {
        return value && 
               typeof value === 'object' &&
               typeof value.name === 'string' &&
               Array.isArray(value.exits)
    }
}
```

## Context Extensions

### Rich Context Objects

Create sophisticated context objects with methods and properties:

```javascript
class GameContext {
    constructor(gameState) {
        this.gameState = gameState
        this.player = gameState.player
        this.world = gameState.world
    }
    
    // Utility functions
    print(...args) {
        console.log(...args)
    }
    
    log(level, message) {
        console.log(`[${level.toUpperCase()}] ${message}`)
    }
    
    // Game-specific functions
    movePlayer(direction) {
        return this.world.movePlayer(this.player.id, direction)
    }
    
    getNearbyNPCs(radius = 5) {
        return this.world.getNPCsInRadius(this.player.position, radius)
    }
    
    sendMessage(npcId, message) {
        return this.world.sendMessage(npcId, message)
    }
    
    // Async functions that yield
    async waitForInput(prompt) {
        // This will yield the prompt and wait for user input
        return prompt
    }
    
    async waitForEvent(eventType, timeout = 5000) {
        return new Promise((resolve) => {
            const timeoutId = setTimeout(() => {
                this.gameState.off(eventType, handler)
                resolve(null)
            }, timeout)
            
            const handler = (data) => {
                clearTimeout(timeoutId)
                this.gameState.off(eventType, handler)
                resolve(data)
            }
            
            this.gameState.on(eventType, handler)
        })
    }
    
    // Property accessors
    get playerHealth() {
        return this.player.health
    }
    
    set playerHealth(value) {
        this.player.health = Math.max(0, Math.min(100, value))
    }
}

const context = new GameContext(gameState)
```

### Plugin System

Create a plugin system for extending context:

```javascript
class ContextPlugin {
    constructor(name, methods, properties = {}) {
        this.name = name
        this.methods = methods
        this.properties = properties
    }
    
    install(context) {
        // Add methods
        for (const [name, fn] of Object.entries(this.methods)) {
            context[name] = fn.bind(context)
        }
        
        // Add properties
        for (const [name, descriptor] of Object.entries(this.properties)) {
            Object.defineProperty(context, name, descriptor)
        }
    }
}

// Math plugin
const mathPlugin = new ContextPlugin('math', {
    sin: (x) => Math.sin(x),
    cos: (x) => Math.cos(x),
    tan: (x) => Math.tan(x),
    sqrt: (x) => Math.sqrt(x),
    abs: (x) => Math.abs(x),
    floor: (x) => Math.floor(x),
    ceil: (x) => Math.ceil(x),
    round: (x) => Math.round(x),
    random: () => Math.random(),
    max: (...args) => Math.max(...args),
    min: (...args) => Math.min(...args),
}, {
    pi: {
        get: () => Math.PI,
        enumerable: true
    },
    e: {
        get: () => Math.E,
        enumerable: true
    }
})

// String plugin
const stringPlugin = new ContextPlugin('string', {
    upper: (str) => str.toUpperCase(),
    lower: (str) => str.toLowerCase(),
    trim: (str) => str.trim(),
    split: (str, delimiter) => str.split(delimiter),
    join: (arr, delimiter) => arr.join(delimiter),
    replace: (str, search, replace) => str.replace(search, replace),
    substring: (str, start, end) => str.substring(start, end),
    indexOf: (str, search) => str.indexOf(search),
    lastIndexOf: (str, search) => str.lastIndexOf(search),
})

// Install plugins
const context = {}
mathPlugin.install(context)
stringPlugin.install(context)

const script = new NpcScript(`
    print "Pi is " + pi
    print "Random number: " + random()
    print "Square root of 16: " + sqrt(16)
    print "Uppercase: " + upper("hello world")
`, undefined, undefined)

script.execute(context)
```

## Advanced Script Patterns

### State Machines

```miniscript
// NPC state machine
currentState = "idle"
lastStateChange = 0

function updateState()
    now = getTime()
    
    if currentState == "idle" then
        if now - lastStateChange > 5000 then
            currentState = "patrol"
            lastStateChange = now
        end if
    else if currentState == "patrol" then
        if playerNearby then
            currentState = "alert"
            lastStateChange = now
        else if now - lastStateChange > 10000 then
            currentState = "idle"
            lastStateChange = now
        end if
    else if currentState == "alert" then
        if not playerNearby then
            currentState = "idle"
            lastStateChange = now
        end if
    end if
end function

function executeState()
    if currentState == "idle" then
        yield "NPC is idle"
    else if currentState == "patrol" then
        yield "NPC is patrolling"
    else if currentState == "alert" then
        yield "NPC is alert!"
    end if
end function

// Main loop
while true
    updateState()
    executeState()
    wait(100)  // Wait 100ms
end while
```

### Event-Driven Scripts

```miniscript
// Event-driven NPC
eventHandlers = {
    "player_entered": function(data)
        print "Player " + data.playerName + " entered the area"
        yield "greeting_" + data.playerName
    end function,
    
    "player_left": function(data)
        print "Player " + data.playerName + " left the area"
    end function,
    
    "item_dropped": function(data)
        print "Item " + data.itemName + " was dropped"
        yield "item_pickup_" + data.itemName
    end function
}

function handleEvent(eventType, eventData)
    if eventType in eventHandlers then
        return eventHandlers[eventType](eventData)
    else
        print "Unknown event: " + eventType
    end if
end function

// Wait for events
while true
    event = waitForEvent()
    handleEvent(event.type, event.data)
end while
```

### Coroutine Patterns

```miniscript
// Coroutine-style script
function walkToLocation(targetX, targetY)
    currentX = position.x
    currentY = position.y
    
    while currentX != targetX or currentY != targetY
        if currentX < targetX then
            currentX = currentX + 1
        else if currentX > targetX then
            currentX = currentX - 1
        end if
        
        if currentY < targetY then
            currentY = currentY + 1
        else if currentY > targetY then
            currentY = currentY - 1
        end if
        
        position = {x: currentX, y: currentY}
        yield "walking to " + currentX + "," + currentY
    end while
    
    return "arrived at destination"
end function

function patrolRoute()
    locations = [
        {x: 10, y: 10},
        {x: 20, y: 10},
        {x: 20, y: 20},
        {x: 10, y: 20}
    ]
    
    for location in locations
        result = walkToLocation(location.x, location.y)
        yield result
        wait(2000)  // Wait 2 seconds at each location
    end for
end function

// Start patrol
patrolRoute()
```

## Performance Optimization

### Expression Caching

The executor automatically caches expression evaluations, but you can optimize further:

```javascript
class OptimizedExecutor extends ScriptExecutor {
    constructor(script, context, state) {
        super(script, context, state)
        this.expressionCache = new Map()
        this.functionCache = new Map()
    }
    
    // Override expression evaluation with custom caching
    evaluateExpression(expr) {
        const cacheKey = this.getExpressionKey(expr)
        
        if (this.expressionCache.has(cacheKey)) {
            return this.expressionCache.get(cacheKey)
        }
        
        const result = super.evaluateExpression(expr)
        this.expressionCache.set(cacheKey, result)
        return result
    }
    
    getExpressionKey(expr) {
        // Create a unique key for the expression
        return `${expr.type}_${expr.start?.line}_${expr.start?.character}`
    }
}
```

### Lazy Loading

```miniscript
// Lazy loading pattern
expensiveData = null

function getExpensiveData()
    if expensiveData == null then
        print "Loading expensive data..."
        expensiveData = loadExpensiveData()
    end if
    return expensiveData
end function

// Use lazy loading
data = getExpensiveData()
print "Data loaded: " + data.length + " items"
```

## Debugging and Development

### Debug Context

```javascript
class DebugContext {
    constructor(baseContext) {
        Object.assign(this, baseContext)
        this.debug = true
        this.logLevel = 'info'
    }
    
    print(...args) {
        console.log('[SCRIPT]', ...args)
    }
    
    log(level, message) {
        if (this.shouldLog(level)) {
            console.log(`[${level.toUpperCase()}] ${message}`)
        }
    }
    
    shouldLog(level) {
        const levels = { error: 0, warn: 1, info: 2, debug: 3 }
        return levels[level] <= levels[this.logLevel]
    }
    
    // Add debugging utilities
    inspect(variable) {
        console.log('Variable inspection:', {
            type: typeof variable,
            value: variable,
            constructor: variable?.constructor?.name,
            keys: typeof variable === 'object' ? Object.keys(variable) : undefined
        })
        return variable
    }
    
    trace(message) {
        if (this.debug) {
            console.trace(`[TRACE] ${message}`)
        }
        return message
    }
}
```

### Script Profiling

```javascript
class ProfiledExecutor extends ScriptExecutor {
    constructor(script, context, state) {
        super(script, context, state)
        this.profile = {
            statementCount: 0,
            functionCalls: 0,
            yieldCount: 0,
            startTime: Date.now()
        }
    }
    
    execute() {
        const result = super.execute()
        
        if (result.type === 'yield') {
            this.profile.yieldCount++
        }
        
        this.profile.statementCount++
        return result
    }
    
    getProfile() {
        return {
            ...this.profile,
            duration: Date.now() - this.profile.startTime,
            statementsPerSecond: this.profile.statementCount / ((Date.now() - this.profile.startTime) / 1000)
        }
    }
}
```

## Integration Patterns

### React Integration

```javascript
import React, { useState, useEffect } from 'react'
import { NpcScript } from 'npc-script'

function NPCComponent({ scriptSource, context }) {
    const [script, setScript] = useState(null)
    const [state, setState] = useState(null)
    const [output, setOutput] = useState('')
    
    useEffect(() => {
        const npcScript = new NpcScript(scriptSource)
        setScript(npcScript)
        
        const result = npcScript.execute({
            ...context,
            print: (msg) => setOutput(prev => prev + msg + '\n')
        })
        
        if (result.type === 'yield') {
            setState(result.state)
        }
    }, [scriptSource])
    
    const resume = () => {
        if (script && state) {
            const result = script.execute({
                ...context,
                print: (msg) => setOutput(prev => prev + msg + '\n')
            }, state)
            
            if (result.type === 'yield') {
                setState(result.state)
            } else {
                setState(null)
            }
        }
    }
    
    return (
        <div>
            <pre>{output}</pre>
            {state && <button onClick={resume}>Continue</button>}
        </div>
    )
}
```

### Node.js Integration

```javascript
import { NpcScript } from 'npc-script'
import EventEmitter from 'events'

class NPCManager extends EventEmitter {
    constructor() {
        super()
        this.npcs = new Map()
        this.scripts = new Map()
    }
    
    loadScript(id, source) {
        const script = new NpcScript(source)
        this.scripts.set(id, script)
        return script
    }
    
    createNPC(id, scriptId, context) {
        const script = this.scripts.get(scriptId)
        if (!script) {
            throw new Error(`Script ${scriptId} not found`)
        }
        
        const npc = {
            id,
            script,
            context,
            state: null,
            active: true
        }
        
        this.npcs.set(id, npc)
        this.startNPC(npc)
        return npc
    }
    
    async startNPC(npc) {
        while (npc.active) {
            try {
                const result = npc.script.execute(npc.context, npc.state)
                
                if (result.type === 'return') {
                    this.emit('npcComplete', npc.id, result.value)
                    npc.active = false
                    break
                }
                
                if (result.type === 'yield') {
                    npc.state = result.state
                    this.emit('npcYield', npc.id, result.value)
                    
                    // Wait for resume signal
                    await this.waitForResume(npc.id)
                }
            } catch (error) {
                this.emit('npcError', npc.id, error)
                npc.active = false
                break
            }
        }
    }
    
    async waitForResume(npcId) {
        return new Promise((resolve) => {
            this.once(`resume_${npcId}`, resolve)
        })
    }
    
    resumeNPC(npcId) {
        this.emit(`resume_${npcId}`)
    }
    
    pauseNPC(npcId) {
        const npc = this.npcs.get(npcId)
        if (npc) {
            npc.active = false
        }
    }
    
    saveNPCState(npcId) {
        const npc = this.npcs.get(npcId)
        if (npc && npc.state) {
            return JSON.stringify(npc.state, serializeState)
        }
        return null
    }
    
    loadNPCState(npcId, stateJson) {
        const npc = this.npcs.get(npcId)
        if (npc) {
            npc.state = JSON.parse(stateJson, reviveState)
        }
    }
}
```

This covers the advanced features of NPCS, including custom operators, type checking, context extensions, performance optimization, and integration patterns. These features allow you to create sophisticated, domain-specific scripting solutions while maintaining the core benefits of stateful execution.

