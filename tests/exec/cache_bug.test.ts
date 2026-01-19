import { runScript } from './test-runner-jest.js'

describe('Executor Cache Bug', () => {
    it('should not reuse expression cache across statements when stack shifts', () => {
        // This script targets a specific bug where calling a function (which shifts the stack)
        // prevents the *caller's* expression cache from being cleared for that statement.
        // The subsequent statement then incorrectly reuses the cached value (the function itself)
        // instead of evaluating its own expression.
        const script = `
f = function()
    return 1
end function

print "Calling f..."
f()
print "Called f."

x = 2 

print "x value: " + x
`
        const result = runScript(script)
        
        expect(result.success).toBe(true)
        // If bug exists, x is function (reused from cache). If fixed, x is number (2).
        expect(result.output).toContain('x value: 2')
    })
})
