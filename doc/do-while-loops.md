# Do-While Loops in NPCS

The `do while ... loop` syntax is a powerful looping construct in NPCS that provides flexible control flow with guaranteed execution and support for multiple conditions.

## Overview

Unlike traditional `while` loops that may never execute if the condition is false initially, `do while` loops guarantee that the main block executes at least once. NPCS extends this concept with support for multiple `while` clauses, each with their own conditions and bodies.

## Basic Syntax

### Simple Do-While Loop

```miniscript
do while condition
    // statements
loop
```

**Example:**
```miniscript
count = 0
do while count < 5
    print "Count: " + count
    count = count + 1
loop
// Output: Count: 0, Count: 1, Count: 2, Count: 3, Count: 4
```

### Do Loop Without Condition

```miniscript
do
    // statements
loop
```

This creates an infinite loop that must be exited with `break`:

```miniscript
attempts = 0
do
    attempts = attempts + 1
    print "Attempt " + attempts
    if attempts >= 3 then
        break
    end if
loop
// Output: Attempt 1, Attempt 2, Attempt 3
```

## Multiple While Clauses

The most powerful feature of NPCS do-while loops is the ability to have multiple `while` clauses:

```miniscript
do while condition1
    // statements for condition1
while condition2
    // statements for condition2
while condition3
    // statements for condition3
loop
```

**Example:**
```miniscript
value = 0
do while value < 10
    value = value + 1
    print "Phase 1: " + value
while value < 20
    value = value + 2
    print "Phase 2: " + value
loop
```

**Execution flow:**
1. Main block executes while `value < 10`
2. When `value >= 10`, first `while` clause executes while `value < 20`
3. When `value >= 20`, loop exits

## Loop Control Statements

### Break Statement

Exits the entire loop immediately:

```miniscript
do while true
    print "Looping..."
    if shouldExit then
        break
    end if
loop
print "Loop ended"
```

### Continue Statement

Skips to the next iteration:

```miniscript
count = 0
do while count < 10
    count = count + 1
    if count % 2 == 0 then
        continue
    end if
    print "Odd: " + count
loop
// Output: Odd: 1, Odd: 3, Odd: 5, Odd: 7, Odd: 9
```

## One-liner Syntax

Do-while loops can be written as single-line statements:

```miniscript
// One-liner with condition
do while condition then action() loop

// One-liner without condition
do then action() loop
```

**Examples:**
```miniscript
// Simple one-liner
do while x < 10 then x = x + 1 loop

// One-liner with multiple statements (using semicolons)
do while x < 10 then x = x + 1; print x loop
```

## Complex Examples

### Game State Machine

```miniscript
health = 100
energy = 50
state = "fighting"

do while health > 0
    print "Health: " + health + ", Energy: " + energy
    
    if state == "fighting" then
        if energy > 20 then
            print "Attacking!"
            energy = energy - 15
            health = health - 5
        else
            state = "resting"
        end if
    end if
    
while state == "resting"
    print "Resting to recover..."
    energy = energy + 25
    if energy >= 50 then
        state = "fighting"
    end if
loop

print "Game over!"
```

### Processing Pipeline

```miniscript
data = [1, 2, 3, 4, 5]
index = 0
sum = 0

do while index < data.length
    value = data[index]
    sum = sum + value
    index = index + 1
    print "Processed: " + value + ", Sum: " + sum
while sum < 10
    print "Sum reached threshold, processing remaining..."
    remaining = data.length - index
    print "Remaining items: " + remaining
loop

print "Final sum: " + sum
```

### Interactive Menu System

```miniscript
choice = ""
do
    print "Menu:"
    print "1. Option 1"
    print "2. Option 2"
    print "3. Exit"
    choice = prompt("Enter choice: ")
    
    if choice == "1" then
        print "You selected option 1"
    else if choice == "2" then
        print "You selected option 2"
    else if choice == "3" then
        print "Goodbye!"
        break
    else
        print "Invalid choice, try again"
    end if
    
while choice != "3"
```

## Best Practices

### 1. Use Clear Conditions

```miniscript
// Good: Clear, descriptive conditions
do while playerHealth > 0 and not gameOver
    // game logic
loop

// Avoid: Complex or unclear conditions
do while (x < 10 and y > 5) or (z == 0 and not flag)
    // unclear logic
loop
```

### 2. Handle Edge Cases

```miniscript
// Always consider what happens when conditions change
do while items.length > 0
    item = items.pop()
    processItem(item)
    
    // Handle case where processing might add items back
    if items.length == 0 and hasPendingItems then
        loadPendingItems()
    end if
loop
```

### 3. Use Multiple While Clauses for State Machines

```miniscript
// Good: Clear state transitions
do while state == "loading"
    loadNextChunk()
    if loadingComplete then
        state = "processing"
    end if
while state == "processing"
    processChunk()
    if processingComplete then
        state = "complete"
    end if
loop
```

### 4. Avoid Infinite Loops Without Breaks

```miniscript
// Good: Always have an exit condition
do
    processData()
    if dataComplete then
        break
    end if
loop

// Avoid: Infinite loops without clear exit
do
    processData()
    // No break condition - dangerous!
loop
```

## Common Patterns

### 1. Retry Logic

```miniscript
attempts = 0
maxAttempts = 3
success = false

do while not success and attempts < maxAttempts
    attempts = attempts + 1
    print "Attempt " + attempts
    success = tryOperation()
    if not success then
        print "Failed, retrying..."
    end if
loop

if success then
    print "Operation succeeded after " + attempts + " attempts"
else
    print "Operation failed after " + maxAttempts + " attempts"
end if
```

### 2. Data Processing with Validation

```miniscript
data = getRawData()
processedData = []

do while data.length > 0
    item = data.shift()
    if validateItem(item) then
        processedItem = processItem(item)
        processedData.push(processedItem)
    else
        print "Invalid item: " + item
    end if
while processedData.length < 10
    print "Batch complete, processing next batch..."
    data = getNextBatch()
loop
```

### 3. Game Loop with Multiple Phases

```miniscript
gamePhase = "setup"
playerCount = 0

do while gamePhase == "setup"
    player = addPlayer()
    playerCount = playerCount + 1
    if playerCount >= 2 then
        gamePhase = "playing"
    end if
while gamePhase == "playing"
    playTurn()
    if gameOver then
        gamePhase = "finished"
    end if
while gamePhase == "finished"
    showResults()
    if restartGame then
        gamePhase = "setup"
        playerCount = 0
    else
        break
    end if
loop
```

## Migration from While Loops

If you have existing `while ... end while` loops, here's how to migrate them:

### Before (Old Syntax)
```miniscript
count = 0
while count < 5
    print "Count: " + count
    count = count + 1
end while
```

### After (New Syntax)
```miniscript
count = 0
do while count < 5
    print "Count: " + count
    count = count + 1
loop
```

The main differences:
- Replace `while` with `do while`
- Replace `end while` with `loop`
- The loop body is now guaranteed to execute at least once

## Performance Considerations

- Do-while loops with multiple conditions are slightly more complex than simple while loops
- The overhead is minimal and usually not a concern
- Use break statements to exit early when possible
- Avoid deeply nested conditions in while clauses

## Error Handling

```miniscript
do while processingData
    try
        result = riskyOperation()
        if result.success then
            break
        end if
    catch error
        print "Error: " + error.message
        if error.isFatal then
            break
        end if
    end try
loop
```

This comprehensive guide covers all aspects of the new do-while loop syntax in NPCS, from basic usage to advanced patterns and best practices.
