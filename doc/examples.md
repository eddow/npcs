# Examples

This document provides practical examples of using NPCS in various scenarios.

## Basic Examples

### Do-While Loop Examples

```javascript
// Basic do-while loop
const basicLoop = new NpcScript(`
    count = 0
    do while count < 5
        print "Count: " + count
        count = count + 1
    loop
    print "Loop finished!"
`)

// Do loop without condition (infinite until break)
const infiniteLoop = new NpcScript(`
    attempts = 0
    do
        attempts = attempts + 1
        print "Attempt " + attempts
        if attempts >= 3 then
            break
        end if
    loop
    print "Exited after " + attempts + " attempts"
`)

// Multiple while clauses
const multiConditionLoop = new NpcScript(`
    value = 0
    do while value < 10
        value = value + 1
        print "Phase 1: " + value
    while value < 20
        value = value + 2
        print "Phase 2: " + value
    loop
    print "Final value: " + value
`)

// Complex game loop example
const gameLoop = new NpcScript(`
    health = 100
    energy = 50
    turn = 0
    
    do while health > 0
        turn = turn + 1
        print "Turn " + turn + " - Health: " + health + ", Energy: " + energy
        
        if energy > 20 then
            print "Attacking enemy!"
            energy = energy - 15
            health = health - 5  // Enemy counter-attack
        else
            print "Resting to recover energy..."
            energy = energy + 25
        end if
        
    while energy <= 0
        print "Exhausted! Must rest completely..."
        energy = energy + 50
        health = health - 10  // Penalty for exhaustion
    loop
    
    print "Game over after " + turn + " turns"
`)
```

### Hello World

```javascript
import { NpcScript } from 'npc-script'

const script = new NpcScript(`
    print "Hello, World!"
    name = "Alice"
    print "Hello, " + name
`)

const context = {
    print: (msg) => console.log(msg)
}

const result = script.execute(context)
// Output:
// Hello, World!
// Hello, Alice
```

### Interactive Script

```javascript
const interactiveScript = new NpcScript(`
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

// Execute with yielding
let state = null
const result = interactiveScript.execute(context, state)

if (result.type === 'yield') {
    console.log('Script yielded:', result.value)
    // Save state and resume later
    const finalResult = interactiveScript.execute(context, result.state)
}
```

## Game Examples

### NPC Conversation System

```javascript
const conversationScript = new NpcScript(`
    // NPC conversation state
    conversationStage = 0
    playerName = ""
    
    function greetPlayer()
        if conversationStage == 0 then
            print "Hello there, traveler!"
            conversationStage = 1
            yield "greeting"
        else if conversationStage == 1 then
            print "What brings you to these lands?"
            conversationStage = 2
            yield "question"
        else if conversationStage == 2 then
            print "That's interesting, " + playerName + "."
            print "I have some information that might help you."
            conversationStage = 3
            yield "information"
        else
            print "Good luck on your journey!"
            yield "farewell"
        end if
    end function
    
    function handleResponse(response)
        if conversationStage == 1 then
            playerName = response
            print "Nice to meet you, " + playerName + "!"
        else if conversationStage == 2 then
            print "I see. Well, let me tell you about the ancient temple..."
        else if conversationStage == 3 then
            print "You're welcome. Come back anytime!"
        end if
    end function
    
    // Main conversation loop
    do while conversationStage < 4
        greetPlayer()
        response = waitForPlayerInput()
        handleResponse(response)
    loop
`)

const conversationContext = {
    print: (msg) => console.log(`[NPC]: ${msg}`),
    waitForPlayerInput: () => {
        // In a real game, this would wait for player input
        return "I'm looking for the ancient temple"
    }
}
```

### Quest System

```javascript
const questScript = new NpcScript(`
    // Quest state
    questActive = false
    questStep = 0
    itemsCollected = []
    requiredItems = ["sword", "shield", "potion"]
    
    function startQuest()
        if not questActive then
            questActive = true
            questStep = 1
            print "Welcome, brave adventurer!"
            print "I need you to collect some items for me."
            print "Bring me: sword, shield, and potion."
            yield "quest_started"
        end if
    end function
    
    function checkProgress()
        if questActive then
            collectedCount = 0
            for item in requiredItems
                if hasItem(item) then
                    collectedCount = collectedCount + 1
                end if
            end for
            
            if collectedCount == requiredItems.length then
                questActive = false
                questStep = 0
                print "Excellent! You've collected all the items!"
                print "Here's your reward: 100 gold coins!"
                yield "quest_completed"
            else
                remaining = requiredItems.length - collectedCount
                print "You still need " + remaining + " more items."
                yield "quest_progress"
            end if
        end if
    end function
    
    function addItem(itemName)
        if not hasItem(itemName) then
            itemsCollected[itemsCollected.length] = itemName
            print "You found: " + itemName
            checkProgress()
        end if
    end function
    
    function hasItem(itemName)
        for item in itemsCollected
            if item == itemName then
                return true
            end if
        end for
        return false
    end function
    
    // Quest event handlers
    function onPlayerEnter()
        if not questActive then
            startQuest()
        end if
    end function
    
    function onItemFound(itemName)
        addItem(itemName)
    end function
`)

const questContext = {
    print: (msg) => console.log(`[Quest NPC]: ${msg}`),
    // Quest events would be triggered by game events
}
```

### Combat System

```javascript
const combatScript = new NpcScript(`
    // Combat state
    health = 100
    maxHealth = 100
    attackPower = 20
    defense = 10
    isAlive = true
    
    function takeDamage(amount)
        actualDamage = amount - defense
        if actualDamage < 0 then
            actualDamage = 0
        end if
        
        health = health - actualDamage
        print "NPC takes " + actualDamage + " damage!"
        print "Health: " + health + "/" + maxHealth
        
        if health <= 0 then
            isAlive = false
            print "NPC has been defeated!"
            yield "defeated"
        end if
    end function
    
    function attack(target)
        if isAlive then
            damage = attackPower + random(0, 10)
            print "NPC attacks for " + damage + " damage!"
            yield "attack_" + damage
        end if
    end function
    
    function heal(amount)
        if isAlive then
            health = health + amount
            if health > maxHealth then
                health = maxHealth
            end if
            print "NPC heals for " + amount + " health!"
            print "Health: " + health + "/" + maxHealth
        end if
    end function
    
    function isInCombat()
        return isAlive and health < maxHealth
    end function
    
    function combatTurn()
        if isAlive then
            if health < maxHealth / 2 then
                // Try to heal if low on health
                if random(0, 100) < 30 then
                    heal(20)
                else
                    attack("player")
                end if
            else
                attack("player")
            end if
        end if
    end function
`)

const combatContext = {
    print: (msg) => console.log(`[Combat NPC]: ${msg}`),
    random: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
}
```

## Business Logic Examples

### Order Processing System

```javascript
const orderScript = new NpcScript(`
    // Order processing state
    orderId = ""
    orderItems = []
    orderTotal = 0
    processingStage = "created"  // created, validated, paid, shipped, delivered
    
    function createOrder(items, customerId)
        orderId = "ORD-" + getCurrentTime()
        orderItems = items
        orderTotal = calculateTotal(items)
        processingStage = "created"
        
        print "Order " + orderId + " created for customer " + customerId
        print "Items: " + items.length + ", Total: $" + orderTotal
        yield "order_created"
    end function
    
    function validateOrder()
        if processingStage == "created" then
            valid = true
            for item in orderItems
                if not isItemAvailable(item.id) then
                    valid = false
                    print "Item " + item.id + " is not available"
                end if
            end for
            
            if valid then
                processingStage = "validated"
                print "Order " + orderId + " validated successfully"
                yield "order_validated"
            else
                print "Order " + orderId + " validation failed"
                yield "order_invalid"
            end if
        end if
    end function
    
    function processPayment(paymentMethod)
        if processingStage == "validated" then
            success = chargePayment(paymentMethod, orderTotal)
            if success then
                processingStage = "paid"
                print "Payment processed for order " + orderId
                yield "payment_success"
            else
                print "Payment failed for order " + orderId
                yield "payment_failed"
            end if
        end if
    end function
    
    function shipOrder()
        if processingStage == "paid" then
            trackingNumber = generateTrackingNumber()
            processingStage = "shipped"
            print "Order " + orderId + " shipped with tracking " + trackingNumber
            yield "order_shipped"
        end if
    end function
    
    function markDelivered()
        if processingStage == "shipped" then
            processingStage = "delivered"
            print "Order " + orderId + " has been delivered"
            yield "order_delivered"
        end if
    end function
    
    function calculateTotal(items)
        total = 0
        for item in items
            total = total + (item.price * item.quantity)
        end for
        return total
    end function
`)

const orderContext = {
    print: (msg) => console.log(`[Order System]: ${msg}`),
    getCurrentTime: () => Date.now().toString(),
    isItemAvailable: (itemId) => true, // Simplified
    chargePayment: (method, amount) => true, // Simplified
    generateTrackingNumber: () => "TRK-" + Math.random().toString(36).substr(2, 9)
}
```

### Workflow Automation

```javascript
const workflowScript = new NpcScript(`
    // Workflow state
    workflowId = ""
    currentStep = 0
    totalSteps = 0
    completedSteps = []
    workflowData = {}
    
    function startWorkflow(id, steps, data)
        workflowId = id
        totalSteps = steps.length
        workflowData = data
        currentStep = 0
        completedSteps = []
        
        print "Starting workflow " + workflowId
        print "Total steps: " + totalSteps
        yield "workflow_started"
    end function
    
    function executeNextStep()
        if currentStep < totalSteps then
            stepName = getStepName(currentStep)
            print "Executing step: " + stepName
            
            // Execute the step
            result = executeStep(stepName, workflowData)
            
            if result.success then
                completedSteps[completedSteps.length] = currentStep
                currentStep = currentStep + 1
                print "Step " + stepName + " completed successfully"
                
                if currentStep >= totalSteps then
                    print "Workflow " + workflowId + " completed!"
                    yield "workflow_completed"
                else
                    yield "step_completed"
                end if
            else
                print "Step " + stepName + " failed: " + result.error
                yield "step_failed"
            end if
        end if
    end function
    
    function pauseWorkflow()
        print "Workflow " + workflowId + " paused at step " + currentStep
        yield "workflow_paused"
    end function
    
    function resumeWorkflow()
        print "Resuming workflow " + workflowId + " from step " + currentStep
        yield "workflow_resumed"
    end function
    
    function getProgress()
        return {
            workflowId: workflowId,
            currentStep: currentStep,
            totalSteps: totalSteps,
            completedSteps: completedSteps,
            progress: (currentStep / totalSteps) * 100
        }
    end function
`)

const workflowContext = {
    print: (msg) => console.log(`[Workflow]: ${msg}`),
    getStepName: (stepIndex) => `step_${stepIndex}`,
    executeStep: (stepName, data) => {
        // Simulate step execution
        return { success: Math.random() > 0.2, error: null }
    }
}
```

## Integration Examples

### Express.js API Integration

```javascript
import express from 'express'
import { NpcScript } from 'npc-script'

const app = express()
app.use(express.json())

// Store active NPCs
const activeNPCs = new Map()

// NPC endpoint
app.post('/api/npc/:id/execute', async (req, res) => {
    const npcId = req.params.id
    const { script, context, state } = req.body
    
    try {
        let npcScript
        if (activeNPCs.has(npcId)) {
            npcScript = activeNPCs.get(npcId)
        } else {
            npcScript = new NpcScript(script)
            activeNPCs.set(npcId, npcScript)
        }
        
        const result = npcScript.execute(context, state)
        
        if (result.type === 'yield') {
            res.json({
                type: 'yield',
                value: result.value,
                state: result.state
            })
        } else {
            res.json({
                type: 'return',
                value: result.value
            })
            activeNPCs.delete(npcId)
        }
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

// Resume NPC endpoint
app.post('/api/npc/:id/resume', async (req, res) => {
    const npcId = req.params.id
    const { context, state } = req.body
    
    try {
        const npcScript = activeNPCs.get(npcId)
        if (!npcScript) {
            return res.status(404).json({ error: 'NPC not found' })
        }
        
        const result = npcScript.execute(context, state)
        
        if (result.type === 'yield') {
            res.json({
                type: 'yield',
                value: result.value,
                state: result.state
            })
        } else {
            res.json({
                type: 'return',
                value: result.value
            })
            activeNPCs.delete(npcId)
        }
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

app.listen(3000, () => {
    console.log('NPC API server running on port 3000')
})
```

### WebSocket Integration

```javascript
import WebSocket from 'ws'
import { NpcScript } from 'npc-script'

const wss = new WebSocket.Server({ port: 8080 })
const npcs = new Map()

wss.on('connection', (ws) => {
    console.log('Client connected')
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message)
            const { type, npcId, script, context, state } = data
            
            if (type === 'create_npc') {
                const npcScript = new NpcScript(script)
                npcs.set(npcId, npcScript)
                
                const result = npcScript.execute(context)
                ws.send(JSON.stringify({
                    type: 'npc_created',
                    npcId,
                    result
                }))
            } else if (type === 'resume_npc') {
                const npcScript = npcs.get(npcId)
                if (npcScript) {
                    const result = npcScript.execute(context, state)
                    ws.send(JSON.stringify({
                        type: 'npc_result',
                        npcId,
                        result
                    }))
                }
            }
        } catch (error) {
            ws.send(JSON.stringify({
                type: 'error',
                message: error.message
            }))
        }
    })
    
    ws.on('close', () => {
        console.log('Client disconnected')
    })
})
```

### React Hook Integration

```javascript
import { useState, useEffect, useCallback } from 'react'
import { NpcScript } from 'npc-script'

function useNPCScript(scriptSource, context) {
    const [script, setScript] = useState(null)
    const [state, setState] = useState(null)
    const [output, setOutput] = useState([])
    const [isComplete, setIsComplete] = useState(false)
    const [error, setError] = useState(null)
    
    useEffect(() => {
        try {
            const npcScript = new NpcScript(scriptSource)
            setScript(npcScript)
            setError(null)
        } catch (err) {
            setError(err.message)
        }
    }, [scriptSource])
    
    const execute = useCallback(() => {
        if (!script) return
        
        try {
            const result = script.execute({
                ...context,
                print: (msg) => setOutput(prev => [...prev, msg])
            }, state)
            
            if (result.type === 'yield') {
                setState(result.state)
                setIsComplete(false)
                return result.value
            } else {
                setState(null)
                setIsComplete(true)
                return result.value
            }
        } catch (err) {
            setError(err.message)
            return null
        }
    }, [script, context, state])
    
    const reset = useCallback(() => {
        setState(null)
        setOutput([])
        setIsComplete(false)
        setError(null)
    }, [])
    
    return {
        execute,
        reset,
        output,
        isComplete,
        error,
        hasState: state !== null
    }
}

// Usage in component
function NPCDialog({ scriptSource, onComplete }) {
    const { execute, output, isComplete, error, hasState } = useNPCScript(
        scriptSource,
        {
            prompt: (question) => {
                // Handle user input
                return "user response"
            }
        }
    )
    
    useEffect(() => {
        if (isComplete) {
            onComplete()
        }
    }, [isComplete, onComplete])
    
    return (
        <div>
            <div className="output">
                {output.map((line, i) => (
                    <div key={i}>{line}</div>
                ))}
            </div>
            {error && <div className="error">{error}</div>}
            {hasState && (
                <button onClick={execute}>Continue</button>
            )}
        </div>
    )
}
```

## Testing Examples

### Unit Testing NPCs

```javascript
import { NpcScript } from 'npc-script'
import { describe, it, expect } from 'jest'

describe('NPC Scripts', () => {
    it('should execute basic script', () => {
        const script = new NpcScript(`
            x = 5
            y = 10
            result = x + y
        `)
        
        const context = {}
        const result = script.execute(context)
        
        expect(result.type).toBe('return')
    })
    
    it('should yield when function returns value', () => {
        const script = new NpcScript(`
            function askQuestion(text)
                return text
            end function
            
            askQuestion "What's your name?"
        `)
        
        const context = {}
        const result = script.execute(context)
        
        expect(result.type).toBe('yield')
        expect(result.value).toBe("What's your name?")
    })
    
    it('should handle state restoration', () => {
        const script = new NpcScript(`
            step = 0
            step = step + 1
            yield "step_" + step
            step = step + 1
            yield "step_" + step
        `)
        
        const context = {}
        const result1 = script.execute(context)
        
        expect(result1.type).toBe('yield')
        expect(result1.value).toBe('step_1')
        
        const result2 = script.execute(context, result1.state)
        expect(result2.type).toBe('yield')
        expect(result2.value).toBe('step_2')
    })
})
```

### Integration Testing

```javascript
import { NpcScript } from 'npc-script'

describe('NPC Integration', () => {
    it('should handle complex conversation flow', async () => {
        const conversationScript = new NpcScript(`
            stage = 0
            
            function nextStage()
                stage = stage + 1
                if stage == 1 then
                    return "Hello there!"
                else if stage == 2 then
                    return "What's your name?"
                else if stage == 3 then
                    return "Nice to meet you!"
                else
                    return "Goodbye!"
                end if
            end function
            
            nextStage()
        `)
        
        const context = {}
        let state = null
        const responses = []
        
        // Simulate conversation flow
        for (let i = 0; i < 4; i++) {
            const result = conversationScript.execute(context, state)
            
            if (result.type === 'yield') {
                responses.push(result.value)
                state = result.state
            } else {
                break
            }
        }
        
        expect(responses).toEqual([
            "Hello there!",
            "What's your name?",
            "Nice to meet you!",
            "Goodbye!"
        ])
    })
})
```

These examples demonstrate the versatility of NPCS across different domains, from games to business applications, showing how the stateful execution model can be applied to various real-world scenarios.

