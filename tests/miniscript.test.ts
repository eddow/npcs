import { runFixture, runScript } from "./test-runner-jest.js"

describe("MiniScript Executor", () => {
	describe("Basic Operations", () => {
		it("should handle basic arithmetic and variables", () => {
			const result = runFixture("basic")

			expect(result.success).toBe(true)
			expect(result.output).toEqual(["Sum: 15", "Product: 50"])
			expect(result.executionTime).toBeLessThan(1000)
		})

		it("should return stuff", () => {
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
			expect(result.result).toEqual({ type: "return", value: 4 })
		})
	})

	describe("Scope System", () => {
		it("should capture variables in closures by reference (counter)", () => {
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
			expect(result.output).toEqual(["1", "2"])
		})

		it("should prefer parameter over outer variable (parameter shadowing)", () => {
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
			expect(result.output).toEqual(["99", "10"])
		})

		it("should resolve through nested function scope chain", () => {
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
			expect(result.output).toEqual(["42"])
		})

		it("should treat if-block vars as function-scoped (like var in JS)", () => {
			const snippet = `
flag = true
if flag then
	tmp = 7
end if
print tmp
`
			const result = runScript(snippet)
			expect(result.success).toBe(true)
			expect(result.output).toEqual(["7"])
		})
	})
	it("should handle if/else variations (debug-if-else)", () => {
		const result = runFixture("debug-if-else")

		expect(result.success).toBe(true)
		expect(result.output).toEqual([
			"flag = true",
			"One-liner true",
			"Simple-liner true",
			"flag is true",
			"not flag is false",
		])
	})
	// Chained comparisons / comparison group
	describe("Comparison Group", () => {
		it("should evaluate chained comparisons correctly", () => {
			const result = runFixture("comparison-group")

			expect(result.success).toBe(true)
			// Expected outputs based on semantics similar to math chained comparisons
			expect(result.output).toEqual([
				"3 < 4 < 5",
				"3 == 3 == 3",
				"1 < 2 == 2",
				"2 == 2 < 3",
				"5 > 4 > 3",
				"1 != 2 != 3",
				"2 == 2 != 3",
			])
		})
	})

	describe("Functions", () => {
		it("should handle function definitions and calls", () => {
			const result = runFixture("functions")

			expect(result.success).toBe(true)
			expect(result.output).toEqual([
				"Hello, World!",
				"*Shake hands*",
				"Calculation result: 25",
				"Function returned: 25",
			])
		})
	})

	describe("Objects", () => {
		it("should handle object creation and property access", () => {
			const result = runFixture("objects")

			expect(result.success).toBe(true)
			expect(result.output).toEqual([
				"Person name: John",
				"Person age: 39",
				"Company: TechCorp",
				"CEO name: Jane",
				"Updated age: 40",
				"Updated age: 41",
			])
		})
	})

	describe("Arrays", () => {
		it("should handle array creation and access", () => {
			const result = runFixture("arrays")

			expect(result.success).toBe(true)
			expect(result.output).toEqual([
				"First fruit: apple",
				"Second fruit: banana",
				"Count: 10",
				"Active: true",
				"First item: apple",
			])
		})
	})
	describe("While Loops", () => {
		it("should handle if statements and loops", () => {
			const result = runFixture("while-loops")

			expect(result.success).toBe(true)
			expect(result.output).toEqual([
				"Simple Counter is: 0",
				"Simple Counter is: 1",
				"Simple Counter is: 2",
				"Break Counter is: 2",
				"Break Counter is: 3",
				"Loop finished!",
			])
		})
	})

	describe("For Loops", () => {
		it("should handle basic for loops", () => {
			const result = runFixture("for-loops")
			expect(result.success).toBe(true)
			expect(result.output).toEqual([
				"Iterating through fruits:",
				"  - apple",
				"  - banana",
				"  - orange",
				"  - grape",
				"Fruits (stopping at orange):",
				"  - apple",
				"  - banana",
				"  - orange",
				"Fruits (skipping banana):",
				"  - apple",
				"  - orange",
				"  - grape",
				"Sum of numbers: 15",
				"Matrix:",
				"  1 2 ",
				"  3 4 ",
				"  5 6 ",
				"For loop examples completed!",
			])
			expect(result.executionTime).toBeLessThan(1000)
		})
	})

	describe("Error Handling", () => {
		it("should handle undefined variables gracefully", () => {
			const result = runFixture("error-handling")

			expect(result.success).toBe(true)
			expect(result.output).toEqual([
				"This should show undefined: undefined",
				"Parameter x: undefined",
				"Function result: undefined",
			])
		})
	})

	describe("Performance", () => {
		it("should execute basic operations quickly", () => {
			const result = runFixture("basic")

			expect(result.success).toBe(true)
			expect(result.executionTime).toBeLessThan(100) // Should be very fast
		})
	})

	describe("Integration Tests", () => {
		it("should handle all features together", () => {
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
while counter < 2
print "Iteration: " + counter
counter = counter + 1
end while
`

			// Create a temporary test file using CommonJS

			const result = runScript(comprehensiveTest)

			expect(result.success).toBe(true)
			expect(result.output).toEqual([
				"Hello, Alice!",
				"You are 30 years old",
				"Your first skill is: JavaScript",
				"Greeting completed for: Alice",
				"Iteration: 0",
				"Iteration: 1",
			])
		})
	})
})
