# Language Reference

MiniScript is a simple, readable scripting language designed for NPCs and game scripts. It's inspired by BASIC but with modern features like functions and objects.

## Syntax Overview

MiniScript uses a simple, readable syntax:
- Case-sensitive
- Statements end with newlines (no semicolons)
- Indentation is optional but recommended for readability
- Comments start with `//` or use multi-line `/* */`

## Data Types

### Literals

```miniscript
// Numbers
age = 25
price = 3.14
negative = -10

// Strings
name = "Alice"
greeting = 'Hello, world!'
empty = ""

// Booleans
isActive = true
isHidden = false

// Null
nothing = null
```

### Objects (Maps)

```miniscript
// Basic object
person = {name: "Alice", age: 30}

// Access properties
print person.name  // "Alice"
person.age = 31

// Shorthand notation (NPCS extension)
name = "Alice"
age = 30
person = {name, age}  // Equivalent to {name: name, age: age}

// Nested objects
gameState = {
    player: {name: "Hero", health: 100},
    inventory: ["sword", "potion"]
}
```

### Arrays (Lists)

```miniscript
// Create arrays
items = ["sword", "shield", "potion"]
numbers = [1, 2, 3, 4, 5]
mixed = [1, "hello", true, null]

// Access elements
firstItem = items[0]  // "sword"
items[1] = "armor"

// Array length
count = items.length
```

## Variables

### Declaration and Assignment

```miniscript
// Variables are declared by assignment
name = "Alice"
age = 25
isActive = true

// Reassignment
name = "Bob"
age = age + 1
```

### Scope

Variables have lexical scope:
- Global variables are accessible everywhere
- Function parameters create local scope
- Variables in blocks are accessible to nested blocks

```miniscript
globalVar = "I'm global"

function testScope(param)
    localVar = "I'm local"
    print globalVar  // "I'm global"
    print param      // Parameter value
    print localVar   // "I'm local"
end function

// print localVar  // Error: not accessible here
```

## Functions

### Function Definition

```miniscript
// Basic function
function greet(name)
    return "Hello, " + name
end function

// Function with multiple parameters
function add(a, b)
    return a + b
end function

// Function with default parameters
function greetWithDefault(name = "World")
    return "Hello, " + name
end function
```

### Named Functions (NPCS Extension)

```miniscript
// Traditional assignment
myFunction = function(x, y)
    return x + y
end function

// Named function syntax (equivalent to above)
function myFunction(x, y)
    return x + y
end function

// Named functions with dots (for namespacing)
function utils.formatName(first, last)
    return first + " " + last
end function
```

### Function Calls

```miniscript
// Call function and use return value
result = add(5, 3)
print result  // 8

// Call function as statement (yields return value)
greet "Alice"  // Yields "Hello, Alice"

// Function calls with default parameters
greeting = greetWithDefault()        // "Hello, World"
greeting = greetWithDefault("Bob")   // "Hello, Bob"
```

## Control Flow

### If Statements

```miniscript
// Basic if
if age >= 18 then
    print "You are an adult"
end if

// If-else
if score > 100 then
    print "Excellent!"
else
    print "Good try"
end if

// If-elseif-else
if score >= 90 then
    grade = "A"
else if score >= 80 then
    grade = "B"
else if score >= 70 then
    grade = "C"
else
    grade = "F"
end if

// Shortcut syntax
if age >= 18 then print "Adult" else print "Minor"
```

### Do-While Loops

The `do while ... loop` syntax provides flexible looping constructs that can have multiple conditions and execute at least once.

#### Basic Syntax

```miniscript
// Basic do-while loop
count = 0
do while count < 5
    print "Count: " + count
    count = count + 1
loop
```

#### Do Loop Without Condition

```miniscript
// Do loop without condition (infinite until break)
do
    print "Looping..."
    if shouldStop then
        break
    end if
loop
```

#### Multiple While Clauses

The most powerful feature is the ability to have multiple `while` clauses, each with their own condition and body:

```miniscript
// Multiple while clauses
result = 0
do while result < 10
    result = result + 1
    print "First phase: " + result
while result < 20
    result = result + 2
    print "Second phase: " + result
loop
```

#### Loop Control

```miniscript
// Do-while loop with continue
count = 0
do while count < 10
    count = count + 1
    if count % 2 == 0 then
        continue
    end if
    print "Odd: " + count
loop
```

#### One-liner Syntax

```miniscript
// One-liner do-while
do while condition then action() loop

// One-liner do without condition
do then action() loop
```

#### Complex Example

```miniscript
// Complex do-while with multiple conditions
health = 100
energy = 50
do while health > 0
    print "Health: " + health
    if energy > 20 then
        print "Attacking!"
        energy = energy - 10
    else
        print "Resting..."
        energy = energy + 5
    end if
while energy > 0
    print "Low energy, must rest"
    energy = energy + 15
loop
```

#### Key Features

- **Guaranteed execution**: The main block always executes at least once
- **Multiple conditions**: Each `while` clause can have different conditions and bodies
- **Flexible structure**: Can have no conditions (infinite loop) or multiple conditions
- **Break and continue**: Standard loop control statements work as expected
- **One-liner support**: Can be written as single-line statements

### For Loops

```miniscript
// For-in loop with arrays
items = ["apple", "banana", "cherry"]
for item in items
    print "I have: " + item
end for

// For-in loop with objects
person = {name: "Alice", age: 30, city: "NYC"}
for key in person
    print key + ": " + person[key]
end for

// For-in loop with strings
text = "hello"
for char in text
    print char
end for
```

## Operators

### Arithmetic Operators

```miniscript
a = 10
b = 3

sum = a + b      // 13
diff = a - b     // 7
product = a * b  // 30
quotient = a / b // 3.333...
remainder = a % b // 1
```

### Comparison Operators

```miniscript
a = 10
b = 20

equal = a == b      // false
notEqual = a != b   // true
less = a < b        // true
greater = a > b     // false
lessEqual = a <= b  // true
greaterEqual = a >= b // false
```

### Logical Operators

```miniscript
a = true
b = false

andResult = a and b   // false
orResult = a or b     // true
notResult = not a     // false
```

### Unary Operators

```miniscript
x = 5
negative = -x     // -5
positive = +x     // 5
inverted = not x  // false
```

### Assignment Operators

```miniscript
x = 10
x += 5   // x = 15
x -= 3   // x = 12
x *= 2   // x = 24
x /= 4   // x = 6
```

## Special Features

### Yielding

Functions can yield control back to the host application:

```miniscript
function askQuestion(text)
    return text  // This will be yielded when called as statement
end function

// This yields "What should I do?"
askQuestion "What should I do?"
```

### Type Checking (ISA Operator)

```miniscript
value = 42

if value isa number then
    print "It's a number"
end if

if value isa string then
    print "It's a string"
end if

// Available types: number, string, boolean, list, map
```

### Slicing

```miniscript
text = "Hello, World!"
substring = text[0:5]    // "Hello"
fromStart = text[7:]     // "World!"
toEnd = text[:5]         // "Hello"

numbers = [1, 2, 3, 4, 5]
slice = numbers[1:4]     // [2, 3, 4]
```

### Comparison Groups

```miniscript
// Chain comparisons
if 5 < x < 10 then
    print "x is between 5 and 10"
end if

if a <= b <= c then
    print "b is between a and c"
end if
```

## Comments

```miniscript
// Single line comment
name = "Alice"  // Inline comment

/*
Multi-line comment
This can span multiple lines
*/

/* Single line block comment */
```

## Error Handling

MiniScript doesn't have try-catch, but errors are handled by the host application:

```miniscript
// This will throw an error if 'undefinedVar' doesn't exist
value = undefinedVar

// Safe access with existence check
if defined(undefinedVar) then
    value = undefinedVar
else
    value = "default"
end if
```

## Built-in Functions

The following functions are available in the default context:

```miniscript
// Output
print "Hello, world!"

// Type checking
if value isa number then
    // ...
end if

// Array/string length
count = items.length

// String conversion (if available in context)
text = toString(value)
```

## NPCS Extensions

NPCS extends MiniScript with several features:

1. **Value-less maps**: `{name}` is equivalent to `{name: name}`
2. **Multi-line comments**: `/* ... */`
3. **Named functions**: `function name() ... end function`
4. **Enhanced yielding**: Better integration with JavaScript context
5. **Do-while loops**: `do while ... loop` syntax with multiple conditions support

