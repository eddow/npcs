import { runFixture, runScript } from './test-runner-jest.js'

describe('MiniScript Executor', () => {
	describe('Basic Operations', () => {
		it('should handle basic arithmetic and variables', () => {
			const result = runFixture('basic')

			expect(result.success).toBe(true)
			expect(result.output).toEqual(['Sum: 15', 'Product: 50'])
			expect(result.executionTime).toBeLessThan(1000)
		})

		it('should return stuff', () => {
			const snippet = `
test = function()
	return function(x)
		return x*2
	end function
end function

tf = test()
return tf(2)
`
			const result = runScript(snippet)
			expect(result.success).toBe(true)
			expect(result.result).toEqual({ type: 'return', value: 4 })
		})
	})

	describe('New operator', () => {
		it('should create an object with the given prototype', () => {
			const snippet = `
proto = {name: "base", x: 1}
obj = new proto
print obj.name
print obj.x
obj.x = 2
print obj.x
print proto.x
`
			const result = runScript(snippet)
			expect(result.success).toBe(true)
			expect(result.output).toEqual(['base', '1', '2', '1'])
		})

		it('should throw when operand is not an object or function', () => {
			const snippet = `
x = 5
y = new x
`
			const result = runScript(snippet)
			expect(result.success).toBe(false)
			expect(result.error?.message).toContain(
				"'new' operator expects an object prototype, got number",
			)
		})
	})

	describe('Scope System', () => {
		it('should capture variables in closures by reference (counter)', () => {
			const snippet = `
makeCounter = function()
	count = 0
	return function()
		count = count + 1
		return count
	end function
end function

inc = makeCounter()
print inc()
print inc()
`
			const result = runScript(snippet)
			expect(result.success).toBe(true)
			expect(result.output).toEqual(['1', '2'])
		})

		it('should prefer parameter over outer variable (parameter shadowing)', () => {
			const snippet = `
a = 10
f = function(a)
	print a
end function

f(99)
print a
`
			const result = runScript(snippet)
			expect(result.success).toBe(true)
			expect(result.output).toEqual(['99', '10'])
		})

		it('should resolve through nested function scope chain', () => {
			const snippet = `
outer = function()
	y = 42
	inner = function()
		return y
	end function
	return inner()
end function

print outer()
`
			const result = runScript(snippet)
			expect(result.success).toBe(true)
			expect(result.output).toEqual(['42'])
		})

		it('should treat if-block vars as function-scoped (like var in JS)', () => {
			const snippet = `
flag = true
if flag then
	tmp = 7
end if
print tmp
`
			const result = runScript(snippet)
			expect(result.success).toBe(true)
			expect(result.output).toEqual(['7'])
		})
	})
	it('should handle if/else variations (debug-if-else)', () => {
		const result = runFixture('debug-if-else')

		expect(result.success).toBe(true)
		expect(result.output).toEqual([
			'flag = true',
			'One-liner true',
			'Simple-liner true',
			'flag is true',
			'not flag is false',
		])
	})
	// Chained comparisons / comparison group
	describe('Comparison Group', () => {
		it('should evaluate chained comparisons correctly', () => {
			const result = runFixture('comparison-group')

			expect(result.success).toBe(true)
			// Expected outputs based on semantics similar to math chained comparisons
			expect(result.output).toEqual([
				'3 < 4 < 5',
				'3 == 3 == 3',
				'1 < 2 == 2',
				'2 == 2 < 3',
				'5 > 4 > 3',
				'1 != 2 != 3',
				'2 == 2 != 3',
			])
		})
	})

	describe('Functions', () => {
		it('should handle function definitions and calls', () => {
			const result = runFixture('functions')

			expect(result.success).toBe(true)
			expect(result.output).toEqual([
				'Hello, World!',
				'*Shake hands*',
				'Calculation result: 25',
				'Function returned: 25',
			])
		})
	})

	describe('Objects', () => {
		it('should handle object creation and property access', () => {
			const result = runFixture('objects')

			expect(result.success).toBe(true)
			expect(result.output).toEqual([
				'Person name: John',
				'Person age: 39',
				'Company: TechCorp',
				'CEO name: Jane',
				'Updated age: 40',
				'Updated age: 41',
			])
		})
	})

	describe('Arrays', () => {
		it('should handle array creation and access', () => {
			const result = runFixture('arrays')

			expect(result.success).toBe(true)
			expect(result.output).toEqual([
				'First fruit: apple',
				'Second fruit: banana',
				'Count: 10',
				'Active: true',
				'First item: apple',
			])
		})
	})
	describe('While Loops', () => {
		it('should handle if statements and loops', () => {
			const result = runFixture('while-loops')

			expect(result.success).toBe(true)
			expect(result.output).toEqual([
				'Simple Counter is: 0',
				'Simple Counter is: 1',
				'Simple Counter is: 2',
				'Break Counter is: 2',
				'Break Counter is: 3',
				'Loop finished!',
			])
		})
	})

	describe('For Loops', () => {
		it('should handle basic for loops', () => {
			const result = runFixture('for-loops')
			expect(result.success).toBe(true)
			expect(result.output).toEqual([
				'Iterating through fruits:',
				'  - apple',
				'  - banana',
				'  - orange',
				'  - grape',
				'Fruits (stopping at orange):',
				'  - apple',
				'  - banana',
				'  - orange',
				'Fruits (skipping banana):',
				'  - apple',
				'  - orange',
				'  - grape',
				'Sum of numbers: 15',
				'Matrix:',
				'  1 2 ',
				'  3 4 ',
				'  5 6 ',
				'For loop examples completed!',
			])
			expect(result.executionTime).toBeLessThan(1000)
		})
	})

	describe('Error Handling', () => {
		it('should handle undefined variables with an error', () => {
			const result = runFixture('error-handling')

			expect(result.success).toBe(false)
		})
	})

	describe('Performance', () => {
		it('should execute basic operations quickly', () => {
			const result = runFixture('basic')

			expect(result.success).toBe(true)
			expect(result.executionTime).toBeLessThan(100) // Should be very fast
		})
	})

	describe('Integration Tests', () => {
		it('should handle all features together', () => {
			// Create a comprehensive test file
			const comprehensiveTest = `
// Comprehensive test combining all features
person = {name: "Alice", age: 30, skills: ["JavaScript", "TypeScript"]}

greet = function(p)
print "Hello, " + p.name + "!"
print "You are " + p.age + " years old"
print "Your first skill is: " + p.skills[0]
return p
end function

if person.age > 25 then
result = greet(person)
print "Greeting completed for: " + result.name
end if

counter = 0
do
print "Iteration: " + counter
while counter < 2
counter = counter + 1
loop
`

			// Create a temporary test file using CommonJS

			const result = runScript(comprehensiveTest)

			expect(result.success).toBe(true)
			expect(result.output).toEqual([
				'Hello, Alice!',
				'You are 30 years old',
				'Your first skill is: JavaScript',
				'Greeting completed for: Alice',
				'Iteration: 0',
				'Iteration: 1',
				'Iteration: 2',
			])
		})
	})

	describe('Slice Operations', () => {
		it('should handle basic string and list slicing', () => {
			const result = runFixture('slice-operations')

			expect(result.success).toBe(true)
			expect(result.output).toEqual([
				'String slice [7:12]: World',
				'String slice [0:5]: Hello',
				'String slice [7:]: World!',
				'List slice [1:4]: 20,30,40',
				'List slice [0:3]: 10,20,30',
				'List slice [2:]: 30,40,50',
				'Empty slice: ',
				'Negative start slice: World',
				'Negative end list slice: 30,40',
				'Single char: H',
				'Single element: 20',
			])
		})

		it('should handle edge cases and boundary conditions', () => {
			const result = runFixture('slice-edge-cases')

			expect(result.success).toBe(true)
			expect(result.output).toEqual([
				'Start at end: ',
				'End before start: ',
				'Full slice: Hello',
				'Negative start: lo',
				'Negative end: Hell',
				'Both negative: el',
				'Large start: ',
				'Large end: 2,3,4,5',
				'Empty string slice: ',
				'Empty list slice: ',
			])
		})

		it('should handle inline slice expressions', () => {
			const snippet = `
text = "Hello, World!"
numbers = [1, 2, 3, 4, 5]

// Inline slicing
print "Inline slice: " + text[7:12]
print "Inline list slice: " + numbers[1:4]
print "Single element: " + numbers[2:3]
`
			const result = runScript(snippet)
			expect(result.success).toBe(true)
			expect(result.output).toEqual([
				'Inline slice: World',
				'Inline list slice: 2,3,4',
				'Single element: 3',
			])
		})

		it('should handle slice with variables', () => {
			const snippet = `
text = "Programming"
start = 2
endIndex = 7
result = text[start:endIndex]
print "Variable slice: " + result
`
			const result = runScript(snippet)
			expect(result.success).toBe(true)
			expect(result.output).toEqual(['Variable slice: ogram'])
		})

		it('should throw error for invalid slice targets', () => {
			const snippet = `
number = 42
result = number[0:2]
`
			const result = runScript(snippet)
			expect(result.success).toBe(false)
			expect(result.error?.message).toContain(
				'Slice operation can only be applied to strings or lists',
			)
		})

		it('should throw error for non-numeric start index', () => {
			const snippet = `
text = "Hello"
result = text["a":2]
`
			const result = runScript(snippet)
			expect(result.success).toBe(false)
			expect(result.error?.message).toContain('Slice start index must be a number')
		})

		it('should throw error for non-numeric end index', () => {
			const snippet = `
text = "Hello"
result = text[0:"b"]
`
			const result = runScript(snippet)
			expect(result.success).toBe(false)
			expect(result.error?.message).toContain('Slice end index must be a number')
		})
	})
})
