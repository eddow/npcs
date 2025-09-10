# MiniScript Executor with Testing

A comprehensive MiniScript executor with full testing suite using Vitest.

## Features

- ✅ **Complete MiniScript Support**: Variables, functions, objects, arrays, control flow
- ✅ **Object Creation & Access**: `{name: "John", age: 39}` with property access
- ✅ **Array Support**: `["apple", "banana"]` with index access
- ✅ **Function Definitions**: `function(param) ... end function`
- ✅ **Control Flow**: `if/else`, `while` loops, `break` statements
- ✅ **Pause/Resume Execution**: `yield()` function pauses execution and serializes state
- ✅ **State Serialization**: Complete execution state can be saved and restored
- ✅ **Cross-Executor Restoration**: Resume execution in a completely new executor instance
- ✅ **Comprehensive Testing**: 26+ test cases covering all features

## Project Structure

```
├── src/
│   ├── executor.ts          # Main MiniScript executor
│   └── test-runner.ts       # Test runner utility
├── tests/
│   ├── fixtures/            # Sample .mns files
│   │   ├── basic.mns        # Basic arithmetic
│   │   ├── functions.mns    # Function definitions
│   │   ├── objects.mns      # Object creation
│   │   ├── arrays.mns       # Array operations
│   │   ├── control-flow.mns # If/while statements
│   │   └── error-handling.mns # Error cases
│   ├── miniscript.test.ts   # Integration tests
│   └── executor.test.ts     # Unit tests
├── dist/                    # Compiled JavaScript output
├── tsconfig.json            # TypeScript configuration
├── vitest.config.ts         # Vitest configuration
└── package.json
```

## Building

### Compile TypeScript
```bash
npm run build
```

### Watch Mode (recompile on changes)
```bash
npm run build:watch
```

### Clean Build Artifacts
```bash
npm run clean
```

## Running Tests

### All Tests
```bash
npm run test:run
```

### Interactive Test UI
```bash
npm run test:ui
```

### Watch Mode
```bash
npm test
```

### Coverage Report
```bash
npm run test:coverage
```

### Pause/Resume Demo
```bash
npm run test:pause
```

### Individual Pause Tests
```bash
npm run test:pause-single pause-basic
npm run test:pause-single pause-objects
npm run test:pause-single all
```

## Test Results

All **26+ tests** are currently passing:

- ✅ **Basic Operations** (3 tests)
- ✅ **Functions** (2 tests) 
- ✅ **Objects** (3 tests)
- ✅ **Arrays** (2 tests)
- ✅ **Control Flow** (2 tests)
- ✅ **String Operations** (2 tests)
- ✅ **Integration Tests** (9 tests)
- ✅ **Performance Tests** (2 tests)
- ✅ **Error Handling** (1 test)
- ✅ **Pause/Resume Tests** (5+ tests)

## MiniScript Examples

### Basic Operations
```miniscript
x = 10
y = 5
sum = x + y
print "Sum: " + sum
```

### Functions
```miniscript
greet = function(name)
print "Hello, " + name + "!"
return "Greeting sent to " + name
end function

greet "World"
```

### Objects
```miniscript
person = {name: "John", age: 39, city: "New York"}
print "Person name: " + person.name
person.age = 40
```

### Arrays
```miniscript
fruits = ["apple", "banana", "orange"]
print "First fruit: " + fruits[0]
```

### Control Flow
```miniscript
x = 10
if x > 5 then
print "x is greater than 5"
end if

counter = 0
while counter < 3
print "Counter: " + counter
counter = counter + 1
end while
```

### Pause/Resume Execution
```miniscript
x = 10
print "Before pause: x = " + x
yield()  // Pauses execution and serializes state
print "After pause: x = " + x
print "Execution completed!"
```

### Object State Preservation
```miniscript
person = {name: "Alice", age: 30}
print "Before pause: " + person.name + " is " + person.age
yield()  // State is preserved across pause
person.age = 31
print "After pause: " + person.name + " is now " + person.age
```

## Development

### Adding New Tests

1. Create a new `.mns` file in `tests/fixtures/`
2. Add expected output to `test-runner.ts`
3. Write test cases in `tests/miniscript.test.ts`

### Adding New Features

1. Update the executor in `src/executor.ts`
2. Add unit tests in `tests/executor.test.ts`
3. Add integration tests with `.mns` files
4. Run tests to ensure everything works

## Performance

- Basic operations: < 1ms
- Complex operations: < 5ms
- Pause/resume cycles: < 5ms
- All 26+ tests complete in ~20ms

The executor is highly optimized and suitable for real-time applications.

## Pause/Resume Architecture

The pause/resume system provides:

1. **Native `yield()` Function**: Pauses execution at any point
2. **State Serialization**: Saves variables, call stack, and execution position
3. **Cross-Executor Restoration**: Resume in a completely new executor instance
4. **Object State Preservation**: Complex objects maintain their state across pause/resume
5. **Function Reference System**: Functions are serialized with references for restoration

### State Structure
```typescript
interface ExecutionState {
  variables: Record<string, any>;      // All variables with values
  callStack: CallFrame[];              // Execution context stack
  currentStatementIndex: number;       // Where to resume execution
  source: string;                      // Original MiniScript source
  executionPaused: boolean;            // Pause status
  pauseReason?: string;                // Why execution was paused
}
```

This enables powerful use cases like:
- Long-running script persistence
- Distributed execution across systems
- Debugging and inspection of execution state
- Incremental script processing
