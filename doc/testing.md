# Testing

## Overview

NPCS includes comprehensive testing to ensure reliability and correctness. The testing strategy covers unit tests, integration tests, and end-to-end scenarios.

## Test Structure

### Test Directories

```
tests/
├── exec/                    # Execution tests
│   ├── fixtures/           # Test script files (.npcs)
│   ├── advanced-features.test.ts
│   ├── miniscript.test.ts
│   ├── npcs-usage.test.ts
│   ├── yield.test.ts
│   └── test-runner-jest.ts
└── script/                 # Script parsing tests
    ├── __snapshots__/      # Jest snapshots
    ├── lexer.test.ts
    ├── parser.test.ts
    └── scripts/            # Test script files (.ms)
```

## Running Tests

### All Tests

```bash
npm test
```

### Specific Test Suites

```bash
# Run execution tests only
npm test -- --testPathPattern=exec

# Run parsing tests only
npm test -- --testPathPattern=script

# Run specific test file
npm test -- --testPathPattern=yield.test.ts
```

### Watch Mode

```bash
npm run test:watch
```

### Coverage

```bash
npm run test:coverage
```

## Test Categories

### 1. Lexer Tests (`tests/script/lexer.test.ts`)

Tests the tokenization of MiniScript source code.

```javascript
import { Lexer } from '../src/script/lexer'

describe('Lexer', () => {
    it('should tokenize basic literals', () => {
        const lexer = new Lexer('123 "hello" true false null')
        const tokens = []
        
        let token
        while ((token = lexer.next()).type !== 'EndOfFile') {
            tokens.push(token)
        }
        
        expect(tokens).toHaveLength(5)
        expect(tokens[0].type).toBe('NumericLiteral')
        expect(tokens[1].type).toBe('StringLiteral')
        expect(tokens[2].type).toBe('BooleanLiteral')
        expect(tokens[3].type).toBe('BooleanLiteral')
        expect(tokens[4].type).toBe('NilLiteral')
    })
    
    it('should handle operators', () => {
        const lexer = new Lexer('+ - * / == != < >')
        const tokens = []
        
        let token
        while ((token = lexer.next()).type !== 'EndOfFile') {
            tokens.push(token)
        }
        
        expect(tokens.map(t => t.type)).toEqual([
            'Plus', 'Minus', 'Asterisk', 'Slash',
            'Equal', 'NotEqual', 'LessThan', 'GreaterThan'
        ])
    })
    
    it('should handle keywords', () => {
        const lexer = new Lexer('function if else while for return')
        const tokens = []
        
        let token
        while ((token = lexer.next()).type !== 'EndOfFile') {
            tokens.push(token)
        }
        
        expect(tokens.map(t => t.type)).toEqual([
            'Function', 'If', 'Else', 'While', 'For', 'Return'
        ])
    })
})
```

### 2. Parser Tests (`tests/script/parser.test.ts`)

Tests the parsing of tokens into AST.

```javascript
import { Parser } from '../src/script/parser'

describe('Parser', () => {
    it('should parse assignment statements', () => {
        const parser = new Parser('x = 42')
        const ast = parser.parseChunk()
        
        expect(ast.type).toBe('Chunk')
        expect(ast.body).toHaveLength(1)
        expect(ast.body[0].type).toBe('AssignmentStatement')
        expect(ast.body[0].variable.type).toBe('Identifier')
        expect(ast.body[0].variable.name).toBe('x')
        expect(ast.body[0].init.type).toBe('NumericLiteral')
        expect(ast.body[0].init.value).toBe(42)
    })
    
    it('should parse function definitions', () => {
        const parser = new Parser(`
            function add(a, b)
                return a + b
            end function
        `)
        const ast = parser.parseChunk()
        
        expect(ast.body[0].type).toBe('FunctionDeclaration')
        expect(ast.body[0].name.name).toBe('add')
        expect(ast.body[0].parameters).toHaveLength(2)
        expect(ast.body[0].parameters[0].name).toBe('a')
        expect(ast.body[0].parameters[1].name).toBe('b')
    })
    
    it('should parse control flow', () => {
        const parser = new Parser(`
            if x > 0 then
                print "positive"
            else
                print "negative"
            end if
        `)
        const ast = parser.parseChunk()
        
        expect(ast.body[0].type).toBe('IfStatement')
        expect(ast.body[0].clauses).toHaveLength(2)
        expect(ast.body[0].clauses[0].type).toBe('IfClause')
        expect(ast.body[0].clauses[1].type).toBe('ElseClause')
    })
})
```

### 3. Execution Tests

#### Basic Execution (`tests/exec/miniscript.test.ts`)

```javascript
import { ScriptExecutor } from '../src/executor'

describe('MiniScript Execution', () => {
    it('should execute basic expressions', () => {
        const executor = new ScriptExecutor('x = 5 + 3', {})
        const result = executor.execute()
        
        expect(result.type).toBe('return')
    })
    
    it('should handle function calls', () => {
        const context = {
            print: (msg) => console.log(msg)
        }
        
        const executor = new ScriptExecutor('print "Hello"', context)
        const result = executor.execute()
        
        expect(result.type).toBe('return')
    })
    
    it('should handle control flow', () => {
        const executor = new ScriptExecutor(`
            x = 10
            if x > 5 then
                result = "big"
            else
                result = "small"
            end if
        `, {})
        
        const result = executor.execute()
        expect(result.type).toBe('return')
    })
})
```

#### Yielding Tests (`tests/exec/yield.test.ts`)

```javascript
import { ScriptExecutor } from '../src/executor'

describe('Yielding', () => {
    it('should yield from function calls', () => {
        const executor = new ScriptExecutor(`
            function askQuestion(text)
                return text
            end function
            
            askQuestion "What's your name?"
        `, {})
        
        const result = executor.execute()
        
        expect(result.type).toBe('yield')
        expect(result.value).toBe("What's your name?")
    })
    
    it('should yield from context functions', () => {
        const context = {
            prompt: (question) => question
        }
        
        const executor = new ScriptExecutor('prompt "Enter your age:"', context)
        const result = executor.execute()
        
        expect(result.type).toBe('yield')
        expect(result.value).toBe("Enter your age:")
    })
    
    it('should preserve state between yields', () => {
        const executor = new ScriptExecutor(`
            step = 0
            step = step + 1
            yield "step_" + step
            step = step + 1
            yield "step_" + step
        `, {})
        
        const result1 = executor.execute()
        expect(result1.type).toBe('yield')
        expect(result1.value).toBe('step_1')
        
        const result2 = executor.execute()
        expect(result2.type).toBe('yield')
        expect(result2.value).toBe('step_2')
    })
})
```

#### Advanced Features Tests (`tests/exec/advanced-features.test.ts`)

```javascript
import { ScriptExecutor } from '../src/executor'

describe('Advanced Features', () => {
    it('should handle custom operators', () => {
        const customOperators = {
            '**': (left, right) => Math.pow(left, right),
            '//': (left, right) => Math.floor(left / right),
            '+': (left, right) => left + right
        }
        
        const executor = new ScriptExecutor(`
            power = 2 ** 3
            div = 10 // 3
        `, {}, undefined, customOperators)
        
        const result = executor.execute()
        expect(result.type).toBe('return')
    })
    
    it('should handle custom type checking', () => {
        const customIsaTypes = {
            vector: (value) => value && typeof value.x === 'number' && typeof value.y === 'number',
            number: (value) => typeof value === 'number'
        }
        
        const executor = new ScriptExecutor(`
            pos = {x: 10, y: 20}
            if pos isa vector then
                result = "is vector"
            end if
        `, {}, undefined, undefined, customIsaTypes)
        
        const result = executor.execute()
        expect(result.type).toBe('return')
    })
})
```

### 4. State Management Tests

```javascript
import { ScriptExecutor, serializeState, reviveState } from '../src/executor'

describe('State Management', () => {
    it('should serialize and deserialize state', () => {
        const executor = new ScriptExecutor(`
            x = 42
            y = "hello"
            yield "test"
        `, {})
        
        const result = executor.execute()
        expect(result.type).toBe('yield')
        
        // Serialize state
        const stateJson = JSON.stringify(result.state, serializeState)
        expect(typeof stateJson).toBe('string')
        
        // Deserialize state
        const restoredState = JSON.parse(stateJson, reviveState)
        expect(Array.isArray(restoredState)).toBe(true)
        
        // Resume execution
        const executor2 = new ScriptExecutor(`
            x = 42
            y = "hello"
            yield "test"
        `, {}, restoredState)
        
        const result2 = executor2.execute()
        expect(result2.type).toBe('return')
    })
    
    it('should handle function definitions in state', () => {
        const executor = new ScriptExecutor(`
            function test()
                return "hello"
            end function
            
            yield "test"
        `, {})
        
        const result = executor.execute()
        expect(result.type).toBe('yield')
        
        // Serialize state (should include function definition)
        const stateJson = JSON.stringify(result.state, serializeState)
        const restoredState = JSON.parse(stateJson, reviveState)
        
        // Resume execution
        const executor2 = new ScriptExecutor(`
            function test()
                return "hello"
            end function
            
            yield "test"
        `, {}, restoredState)
        
        const result2 = executor2.execute()
        expect(result2.type).toBe('return')
    })
})
```

## Test Fixtures

### Script Fixtures (`tests/exec/fixtures/`)

The test fixtures contain MiniScript files (.npcs) that are loaded and executed during tests.

#### Example Fixture (`basic.npcs`)

```miniscript
// Basic functionality test
x = 42
y = "hello"
z = true

print x
print y
print z

result = x + 10
print result
```

#### Example Fixture (`functions.npcs`)

```miniscript
// Function definition and calling
function add(a, b)
    return a + b
end function

function greet(name)
    return "Hello, " + name
end function

result1 = add(5, 3)
result2 = greet("World")

print result1
print result2
```

### Script Test Files (`tests/script/scripts/`)

These contain MiniScript files (.ms) used for parsing tests.

## Test Utilities

### Test Runner (`tests/exec/test-runner-jest.ts`)

```javascript
import { readFileSync } from 'fs'
import { join } from 'path'
import { ScriptExecutor } from '../src/executor'

export function runScriptTest(filename: string) {
    const scriptPath = join(__dirname, 'fixtures', filename)
    const source = readFileSync(scriptPath, 'utf-8')
    
    const context = {
        print: (msg) => console.log(msg)
    }
    
    const executor = new ScriptExecutor(source, context)
    const result = executor.execute()
    
    return result
}

export function runScriptWithYielding(filename: string) {
    const scriptPath = join(__dirname, 'fixtures', filename)
    const source = readFileSync(scriptPath, 'utf-8')
    
    const context = {
        print: (msg) => console.log(msg),
        prompt: (question) => question
    }
    
    const executor = new ScriptExecutor(source, context)
    const results = []
    
    let result
    while ((result = executor.execute()).type === 'yield') {
        results.push(result.value)
    }
    
    return results
}
```

## Performance Testing

### Execution Performance

```javascript
import { performance } from 'perf_hooks'
import { ScriptExecutor } from '../src/executor'

describe('Performance', () => {
    it('should execute large scripts efficiently', () => {
        const largeScript = `
            // Generate large script
            ${Array.from({ length: 1000 }, (_, i) => `x${i} = ${i}`).join('\n')}
        `
        
        const start = performance.now()
        const executor = new ScriptExecutor(largeScript, {})
        const result = executor.execute()
        const end = performance.now()
        
        expect(result.type).toBe('return')
        expect(end - start).toBeLessThan(1000) // Should complete in under 1 second
    })
    
    it('should handle deep recursion', () => {
        const recursiveScript = `
            function factorial(n)
                if n <= 1 then
                    return 1
                else
                    return n * factorial(n - 1)
                end if
            end function
            
            result = factorial(10)
        `
        
        const start = performance.now()
        const executor = new ScriptExecutor(recursiveScript, {})
        const result = executor.execute()
        const end = performance.now()
        
        expect(result.type).toBe('return')
        expect(end - start).toBeLessThan(100) // Should complete quickly
    })
})
```

### State Serialization Performance

```javascript
describe('State Performance', () => {
    it('should serialize large states efficiently', () => {
        const largeStateScript = `
            // Create large state
            data = []
            for i in 1..1000
                data[i] = {id: i, value: "item_" + i}
            end for
            
            yield "large_state"
        `
        
        const executor = new ScriptExecutor(largeStateScript, {})
        const result = executor.execute()
        
        expect(result.type).toBe('yield')
        
        const start = performance.now()
        const stateJson = JSON.stringify(result.state, serializeState)
        const end = performance.now()
        
        expect(end - start).toBeLessThan(100) // Should serialize quickly
        expect(stateJson.length).toBeGreaterThan(0)
    })
})
```

## Error Testing

### Syntax Error Testing

```javascript
describe('Error Handling', () => {
    it('should report syntax errors', () => {
        expect(() => {
            new ScriptExecutor('x = ', {})
        }).toThrow()
    })
    
    it('should report runtime errors', () => {
        const executor = new ScriptExecutor('x = undefinedVariable', {})
        
        expect(() => {
            executor.execute()
        }).toThrow('Variable undefinedVariable not found')
    })
    
    it('should provide error locations', () => {
        try {
            const executor = new ScriptExecutor(`
                x = 42
                y = undefinedVariable
            `, {})
            executor.execute()
        } catch (error) {
            expect(error.statement).toBeDefined()
            expect(error.executor.script.sourceLocation).toBeDefined()
        }
    })
})
```

### State Error Testing

```javascript
describe('State Error Handling', () => {
    it('should handle corrupted state', () => {
        const corruptedState = [{ invalid: 'state' }]
        
        expect(() => {
            new ScriptExecutor('x = 1', {}, corruptedState)
        }).toThrow()
    })
    
    it('should handle invalid serialization', () => {
        const invalidJson = '{ invalid json }'
        
        expect(() => {
            JSON.parse(invalidJson, reviveState)
        }).toThrow()
    })
})
```

## Integration Testing

### End-to-End Tests

```javascript
describe('Integration Tests', () => {
    it('should handle complete workflow', async () => {
        const workflowScript = `
            step = 0
            
            function nextStep()
                step = step + 1
                return "step_" + step
            end function
            
            while step < 3
                yield nextStep()
            end while
            
            return "completed"
        `
        
        const context = {}
        let state = null
        const results = []
        
        // Execute workflow
        while (true) {
            const executor = new ScriptExecutor(workflowScript, context, state)
            const result = executor.execute()
            
            if (result.type === 'yield') {
                results.push(result.value)
                state = result.state
            } else {
                results.push(result.value)
                break
            }
        }
        
        expect(results).toEqual(['step_1', 'step_2', 'step_3', 'completed'])
    })
})
```

## Mock Testing

### Context Mocking

```javascript
describe('Context Mocking', () => {
    it('should mock context functions', () => {
        const mockPrint = jest.fn()
        const mockPrompt = jest.fn().mockReturnValue('test input')
        
        const context = {
            print: mockPrint,
            prompt: mockPrompt
        }
        
        const executor = new ScriptExecutor(`
            print "Hello"
            input = prompt("Enter something:")
            print input
        `, context)
        
        executor.execute()
        
        expect(mockPrint).toHaveBeenCalledWith('Hello')
        expect(mockPrompt).toHaveBeenCalledWith('Enter something:')
        expect(mockPrint).toHaveBeenCalledWith('test input')
    })
})
```

## Continuous Integration

### GitHub Actions

```yaml
name: Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [16.x, 18.x, 20.x]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm test
    
    - name: Run coverage
      run: npm run test:coverage
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
```

## Best Practices

### Test Organization

1. **Group related tests**: Use `describe` blocks to group related functionality
2. **Clear test names**: Use descriptive test names that explain what is being tested
3. **Single responsibility**: Each test should test one specific behavior
4. **Arrange-Act-Assert**: Structure tests with clear setup, execution, and verification

### Test Data

1. **Use fixtures**: Store test scripts in fixture files
2. **Minimal test data**: Use the smallest amount of data necessary
3. **Realistic scenarios**: Test with realistic data and scenarios
4. **Edge cases**: Include tests for edge cases and error conditions

### Performance Testing

1. **Benchmark critical paths**: Test performance of frequently used code
2. **Memory usage**: Monitor memory usage during tests
3. **State size**: Test with large states to ensure scalability
4. **Regression testing**: Ensure performance doesn't degrade over time

### Error Testing

1. **Test all error paths**: Ensure all error conditions are tested
2. **Error messages**: Verify error messages are helpful and accurate
3. **Error recovery**: Test error recovery mechanisms
4. **State validation**: Test state validation and corruption handling

This comprehensive testing strategy ensures the reliability and correctness of the NPCS library across all its features and use cases.

