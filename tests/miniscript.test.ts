import { MiniScriptTestRunner } from '../src/test-runner-jest.js';

describe('MiniScript Executor', () => {
	const runner = new MiniScriptTestRunner();

	describe('Basic Operations', () => {
		it('should handle basic arithmetic and variables', async () => {
			const result = await runner.runFixture('basic');
			
			expect(result.success).toBe(true);
			expect(result.output).toEqual([
				'Sum: 15',
				'Product: 50'
			]);
			expect(result.executionTime).toBeLessThan(1000);
		});
	});

	describe('Functions', () => {
		it('should handle function definitions and calls', async () => {
			const result = await runner.runFixture('functions');
			
			expect(result.success).toBe(true);
			expect(result.output).toEqual([
				'Hello, World!',
				'Calculation result: 25',
				'Function returned: 25'
			]);
		});
	});

	describe('Objects', () => {
		it('should handle object creation and property access', async () => {
			const result = await runner.runFixture('objects');
			
			expect(result.success).toBe(true);
			expect(result.output).toEqual([
				'Person name: John',
				'Person age: 39',
				'Company: TechCorp',
				'CEO name: Jane',
				'Updated age: 40'
			]);
		});
	});

	describe('Arrays', () => {
		it('should handle array creation and access', async () => {
			const result = await runner.runFixture('arrays');
			
			expect(result.success).toBe(true);
			expect(result.output).toEqual([
				'First fruit: apple',
				'Second fruit: banana',
				'Count: 10',
				'Active: true',
				'First item: apple'
			]);
		});
	});

	describe('Control Flow', () => {
		it('should handle if statements and loops', async () => {
			const result = await runner.runFixture('control-flow');
			
			expect(result.success).toBe(true);
			expect(result.output).toEqual([
				'x is greater than 5',
				'Let\'s do some calculations',
				'y = 20',
				'Counter is: 0',
				'Counter is: 1',
				'Counter is: 2',
				'Loop finished!'
			]);
		});
	});

	describe('Error Handling', () => {
		it('should handle undefined variables gracefully', async () => {
			const result = await runner.runFixture('error-handling');
			
			expect(result.success).toBe(true);
			expect(result.output).toEqual([
				'This should show undefined: undefined',
				'Parameter x: undefined',
				'Function result: undefined'
			]);
		});
	});

	describe('Performance', () => {
		it('should execute basic operations quickly', async () => {
			const result = await runner.runFixture('basic');
			
			expect(result.success).toBe(true);
			expect(result.executionTime).toBeLessThan(100); // Should be very fast
		});

		it('should execute complex operations in reasonable time', async () => {
			const result = await runner.runFixture('control-flow');
			
			expect(result.success).toBe(true);
			expect(result.executionTime).toBeLessThan(500); // Should still be fast
		});
	});

	describe('Integration Tests', () => {
		it('should handle all features together', async () => {
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
`;

			// Create a temporary test file using CommonJS
			const fs = require('fs');
			const path = require('path');
			const tempFile = path.join(__dirname, 'fixtures', 'comprehensive.mns');
			fs.writeFileSync(tempFile, comprehensiveTest);

			try {
				const result = await runner.runFile(tempFile);
				
				expect(result.success).toBe(true);
				expect(result.output).toEqual([
					'Hello, Alice!',
					'You are 30 years old',
					'Your first skill is: JavaScript',
					'Greeting completed for: Alice',
					'Iteration: 0',
					'Iteration: 1'
				]);
			} finally {
				// Clean up temporary file
				fs.unlinkSync(tempFile);
			}
		});
	});
});
