import { runFixture, runScript } from './test-runner-jest.js';

describe('Pause/Resume Execution', () => {

	describe('Basic Pause/Resume', () => {
		it('should pause and resume basic execution', () => {
			const first = runFixture('pause-basic');
			
			expect(first.success).toBe(true);
			expect(first.output).toEqual(['Before yield: x = 10'])
			expect(first.result).toEqual({type: 'yield', value: 42});
			expect(first.executionTime).toBeLessThan(1000);

			const second = runFixture('pause-basic', first.stack);
			expect(second.success).toBe(true);
			expect(second.output).toEqual(['After yield: x = 10', 'Execution completed!'])
			expect(second.result).toEqual({type: 'eob'});
			expect(second.executionTime).toBeLessThan(1000);
		});
	});

	describe('Additional Yield Variants', () => {
		it('should yield inside a function called as a statement', () => {
			const code = `
doSth = function(a)
print "start " + a
yield 7
print "end " + a
end function
doSth 5
print "after"`;
			const first = runScript(code);
			expect(first.success).toBe(true);
			expect(first.output).toEqual(['start 5']);
			expect(first.result).toEqual({ type: 'yield', value: 7 });

			const second = runScript(code, first.stack);
			expect(second.success).toBe(true);
			expect(second.output).toEqual(['end 5', 'after']);
			expect(second.result).toEqual({ type: 'eob' });
		});

		it('should yield inside a for..in loop', () => {
			const code = `
fruits = ["apple","banana","orange"]
for f in fruits
print "item: " + f
if f == "banana" then
yield 0
end if
end for
print "done"`;
			const first = runScript(code);
			expect(first.success).toBe(true);
			expect(first.output).toEqual(['item: apple', 'item: banana']);
			expect(first.result).toEqual({ type: 'yield', value: 0 });

			const second = runScript(code, first.stack);
			expect(second.success).toBe(true);
			expect(second.output).toEqual(['item: orange', 'done']);
			expect(second.result).toEqual({ type: 'eob' });
		});

		it('should fail using parentheses syntax yield(arg1, ...)', () => {
			const code = `
print "before"
yield(123)
print "after"`;
			const first = runScript(code);
			expect(first.success).toBe(false);
			expect(first.error!.message).toEqual('Native function definition has no evaluation function');
		});

		it('should yield with function call argument that returns a value', () => {
			const code = `
double = function(x)
 	return x * 2
end function
yield double(21)`;
			const first = runScript(code);
			expect(first.success).toBe(true);
			expect(first.output).toEqual([]);
			expect(first.result).toEqual({ type: 'yield', value: 42 });

			const second = runScript(code, first.stack);
			expect(second.success).toBe(true);
			expect(second.output).toEqual([]);
			expect(second.result).toEqual({ type: 'eob' });
		});

		it('should fail to yield with function call argument that returns a value', () => {
			const code = `
double = function(x)
	yield x
	return x * 2
end function
print double(21)`;
			const first = runScript(code);
			expect(first.success).toBe(false);
			expect(first.error!.message).toEqual('Function call cannot yield');
		});
	});

	describe('Pause in Control Flow', () => {
		it('should pause and resume inside if statement', () => {
			const first = runFixture('pause-if');
			expect(first.success).toBe(true);
			expect(first.output).toEqual(['Inside if: x = 15']);
			expect(first.result).toEqual({ type: 'yield', value: 0 });
			const second = runFixture('pause-if', first.stack);
			expect(second.success).toBe(true);
			expect(second.output).toEqual(['After pause in if: x = 15', 'After if block']);
			expect(second.result).toEqual({ type: 'eob' });
		});

		it('should pause and resume inside while loop', () => {
			const first = runFixture('pause-loop');
			expect(first.success).toBe(true);
			expect(first.output).toEqual([
				'Loop iteration: 0',
				'After loop iteration: 1',
				'Loop iteration: 1',
				'After loop iteration: 2',
				'Before'
			]);
			expect(first.result).toEqual({ type: 'yield', value: 0 });
			const second = runFixture('pause-loop', first.stack);
			expect(second.success).toBe(true);
			expect(second.output).toEqual([
				'After',
				'Loop iteration: 2',
				'After loop iteration: 3',
				'Loop completed!'
			]);
			expect(second.result).toEqual({ type: 'eob' });
		});

		it.skip('should pause and resume inside function (yield-in-call not supported yet)', () => {
			// Currently the executor cannot yield from a function call used within an expression
			// (e.g., result = testFunc(5)). Enable this when supported.
		});
	});

	describe('Object State Preservation', () => {
		it('should preserve object state across pause/resume', () => {
			const first = runFixture('pause-objects');
			expect(first.success).toBe(true);
			expect(first.output).toEqual(['Before pause: Alice is 30']);
			expect(first.result).toEqual({ type: 'yield', value: 0 });
			const second = runFixture('pause-objects', first.stack);
			expect(second.success).toBe(true);
			expect(second.output).toEqual(['After pause: Alice is now 31']);
			expect(second.result).toEqual({ type: 'eob' });
		});
	});
});
