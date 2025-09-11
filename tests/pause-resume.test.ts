import { runFixture, runScript } from './test-runner-jest.js'

describe('Pause/Resume Execution', () => {
	describe('Basic Pause/Resume', () => {
		it('should pause and resume basic execution', () => {
			const first = runFixture('pause-basic')

			expect(first.success).toBe(true)
			expect(first.output).toEqual(['Before yield: x = 10'])
			expect(first.result).toEqual({ type: 'yield', value: 42 })
			expect(first.executionTime).toBeLessThan(1000)

			const second = runFixture('pause-basic', first.state)
			expect(second.success).toBe(true)
			expect(second.output).toEqual(['After yield: x = 10', 'Execution completed!'])
			expect(second.result).toEqual({ type: 'return' })
			expect(second.executionTime).toBeLessThan(1000)
		})
	})

	it('should yield on a returning statement', () => {
			const first = runFixture('yielding')

			expect(first.success).toBe(true)
			expect(first.output).toEqual([
				'Hello, World!',
			])
			expect(first.result).toEqual({ type: 'yield', value: 'Greeting sent to World' })
			const second = runFixture('yielding', first.state)

			expect(second.success).toBe(true)
			expect(second.output).toEqual([
				'*Shake hands*',
				'Calculation result: 25',
				'Function returned: 25',
			])
	})

	describe('Additional Yield Variants', () => {
		it('should yield inside a function called as a statement', () => {
			const code = `
doSth = function(a)
	print "start " + a
	yield 7
	print "end " + a
end function
doSth 5
print "after"`
			const first = runScript(code)
			expect(first.success).toBe(true)
			expect(first.output).toEqual(['start 5'])
			expect(first.result).toEqual({ type: 'yield', value: 7 })

			const second = runScript(code, first.state)
			expect(second.success).toBe(true)
			expect(second.output).toEqual(['end 5', 'after'])
			expect(second.result).toEqual({ type: 'return' })
		})

		it('should yield inside a for..in loop', () => {
			const code = `
fruits = ["apple","banana","orange"]
for f in fruits
	print "item: " + f
	if f == "banana" then
		yield 0
	end if
end for
print "done"`
			const first = runScript(code)
			expect(first.success).toBe(true)
			expect(first.output).toEqual(['item: apple', 'item: banana'])
			expect(first.result).toEqual({ type: 'yield', value: 0 })

			const second = runScript(code, first.state)
			expect(second.success).toBe(true)
			expect(second.output).toEqual(['item: orange', 'done'])
			expect(second.result).toEqual({ type: 'return' })
		})

		it('should yield with function call argument that returns a value', () => {
			const code = `
double = function(x)
 	return x * 2
end function
yield double(21)`
			const first = runScript(code)
			expect(first.success).toBe(true)
			expect(first.output).toEqual([])
			expect(first.result).toEqual({ type: 'yield', value: 42 })

			const second = runScript(code, first.state)
			expect(second.success).toBe(true)
			expect(second.output).toEqual([])
			expect(second.result).toEqual({ type: 'return' })
		})
		
		it('should yield the return value when calling a yielding function as a statement', () => {
			const code = `
work = function(n)
	print "work start: " + n
	yield "tick-" + n
	return n * 3
end function

print "work:", work(3) + work(7)
print "after work"`
			const first = runScript(code)
			// Even though the function yields internally, calling it as a statement should
			// ultimately yield the function's return value when the call completes.
			expect(first.success).toBe(true)
			expect(first.output).toEqual(['work start: 3'])
			expect(first.result).toEqual({ type: 'yield', value: 'tick-3' })

			const second = runScript(code, first.state)
			expect(second.success).toBe(true)
			expect(second.output).toEqual(['work start: 7'])
			expect(second.result).toEqual({ type: 'yield', value: 'tick-7' })

			// After yielding the return value of the call-statement, the program should be done.
			const third = runScript(code, second.state)
			expect(third.success).toBe(true)
			expect(third.output).toEqual(['work: 30', 'after work'])
			expect(third.result).toEqual({ type: 'return' })
		})
	})
	
	describe('Pause in Control Flow', () => {
		it('should pause and resume inside if statement', () => {
			const first = runFixture('pause-if')
			expect(first.success).toBe(true)
			expect(first.output).toEqual(['Inside if: x = 15'])
			expect(first.result).toEqual({ type: 'yield', value: 0 })
			const second = runFixture('pause-if', first.state)
			expect(second.success).toBe(true)
			expect(second.output).toEqual(['After pause in if: x = 15', 'After if block'])
			expect(second.result).toEqual({ type: 'return' })
		})

		it('should pause and resume inside while loop', () => {
			const first = runFixture('pause-loop')
			expect(first.success).toBe(true)
			expect(first.output).toEqual([
				'Loop iteration: 0',
				'After loop iteration: 1',
				'Loop iteration: 1',
				'After loop iteration: 2',
				'Before',
			])
			expect(first.result).toEqual({ type: 'yield', value: 0 })
			const second = runFixture('pause-loop', first.state)
			expect(second.success).toBe(true)
			expect(second.output).toEqual([
				'After',
				'Loop iteration: 2',
				'After loop iteration: 3',
				'Loop completed!',
			])
			expect(second.result).toEqual({ type: 'return' })
		})

		it.skip('should pause and resume inside function (yield-in-call not supported yet)', () => {
			// Currently the executor cannot yield from a function call used within an expression
			// (e.g., result = testFunc(5)). Enable this when supported.
		})
	})

	describe('Object State Preservation', () => {
		it('should preserve object state across pause/resume', () => {
			const first = runFixture('pause-objects')
			expect(first.success).toBe(true)
			expect(first.output).toEqual(['Before pause: Alice is 30'])
			expect(first.result).toEqual({ type: 'yield', value: 0 })
			const second = runFixture('pause-objects', first.state)
			expect(second.success).toBe(true)
			expect(second.output).toEqual(['After pause: Alice is now 31'])
			expect(second.result).toEqual({ type: 'return' })
		})
	})
})
