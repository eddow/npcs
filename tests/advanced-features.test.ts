import { runFixture, runScript } from '../src/test-runner-jest.js';

describe('Advanced MiniScript Features', () => {


	describe('Continue Statements', () => {
		it('should handle continue in while loops', () => {
			const result = runFixture('continue-statements');
			
			expect(result.success).toBe(true);
			expect(result.output).toContain('Numbers 1-10, skipping even numbers:');
			expect(result.output).toContain('  1');
			expect(result.output).toContain('  3');
			expect(result.output).toContain('  5');
			expect(result.output).toContain('  7');
			expect(result.output).toContain('  9');
			// Should not contain even numbers
			expect(result.output).not.toContain('2');
			expect(result.output).not.toContain('4');
			expect(result.output).not.toContain('6');
			expect(result.output).not.toContain('8');
			expect(result.output).not.toContain('10');
		});

		it('should handle continue in for loops', () => {
			const result = runFixture('continue-statements');
			
			expect(result.success).toBe(true);
			expect(result.output).toContain('\\nNumbers 1-10, skipping multiples of 3:');
			expect(result.output).toContain('  1');
			expect(result.output).toContain('  2');
			expect(result.output).toContain('  4');
			expect(result.output).toContain('  5');
			expect(result.output).toContain('  7');
			expect(result.output).toContain('  8');
			expect(result.output).toContain('  10');
			// Should not contain multiples of 3
			expect(result.output).not.toContain('3');
			expect(result.output).not.toContain('6');
			expect(result.output).not.toContain('9');
		});

		it('should handle continue with conditional logic', () => {
			const result = runFixture('continue-statements');
			
			expect(result.success).toBe(true);
			expect(result.output).toContain('\\nProcessing items, skipping invalid ones:');
			expect(result.output).toContain('  Processing: valid1');
			expect(result.output).toContain('  Processing: valid2');
			expect(result.output).toContain('  Processing: valid3');
			expect(result.output).toContain('  Skipping: invalid');
			expect(result.output).toContain('  Skipping: error');
		});

		it('should handle continue in nested loops', () => {
			const result = runFixture('continue-statements');
			
			expect(result.success).toBe(true);
			expect(result.output).toContain('\\nContinue in nested loops:');
			expect(result.output).toContain('  Outer loop: 1');
			expect(result.output).toContain('  Outer loop: 2');
			expect(result.output).toContain('  Outer loop: 3');
			expect(result.output).toContain('    Inner loop: 1');
			expect(result.output).toContain('    Inner loop: 3');
			// Should not contain Inner loop: 2 due to continue
			expect(result.output).not.toContain('Inner loop: 2');
		});
	});

	describe('Import System', () => {
		it('should handle import statements', () => {
			const result = runFixture('import-system');
			
			expect(result.success).toBe(true);
			expect(result.output).toContain('Testing import statements:');
			expect(result.output).toContain('Import statement: math (not implemented)');
			expect(result.output).toContain('Import statement: string (not implemented)');
			expect(result.output).toContain('Import statement: json (not implemented)');
			expect(result.output).toContain('Imported math module');
			expect(result.output).toContain('Imported string and json modules');
		});

		it('should handle imports in functions', () => {
			const result = runFixture('import-system');
			
			expect(result.success).toBe(true);
			expect(result.output).toContain('Import statement: network (not implemented)');
			expect(result.output).toContain('Import statement: database (not implemented)');
			expect(result.output).toContain('Imported network and database modules');
		});

		it('should handle conditional imports', () => {
			const result = runFixture('import-system');
			
			expect(result.success).toBe(true);
			expect(result.output).toContain('Import statement: conditional (not implemented)');
			expect(result.output).toContain('Imported conditional module');
		});
	});

	describe('ISA Expressions', () => {
		it('should handle basic type checking', () => {
			const result = runFixture('isa-examples');
			
			expect(result.success).toBe(true);
			expect(result.output).toContain('x isa number: true');
			expect(result.output).toContain('name isa string: true');
			expect(result.output).toContain('flag isa boolean: true');
			expect(result.output).toContain('person isa map: true');
			expect(result.output).toContain('fruits isa list: true');
		});

		it('should handle negation with not()', () => {
			const result = runFixture('isa-examples');
			
			expect(result.success).toBe(true);
			expect(result.output).toContain('x isa not number: false');
			expect(result.output).toContain('name isa not string: false');
		});

		it('should handle negation with comparison', () => {
			const result = runFixture('isa-examples');
			
			expect(result.success).toBe(true);
			expect(result.output).toContain('x isa number == false: false');
			expect(result.output).toContain('name isa string != true: false');
		});

		it('should handle isa in if statements', () => {
			const result = runFixture('isa-examples');
			
			expect(result.success).toBe(true);
			expect(result.output).toContain('x is a positive number');
			expect(result.output).toContain('person is a map with a string name');
		});

		it('should handle type validation in functions', () => {
			const result = runFixture('isa-examples');
			
			expect(result.success).toBe(true);
			expect(result.output).toContain('Input is a number: 42');
			expect(result.output).toContain('Input is a string: John');
			expect(result.output).toContain('Input is a boolean: true');
			expect(result.output).toContain('Input is a map with keys: name,age');
			expect(result.output).toContain('Input is a list with 3 items');
		});

		it('should handle complex type checking', () => {
			const result = runFixture('isa-examples');
			
			expect(result.success).toBe(true);
			expect(result.output).toContain('Person is an adult');
			expect(result.output).toContain('Fruits list is not empty');
			expect(result.output).toContain('x is either a number or string and not null');
			expect(result.output).toContain('x is neither a string nor a boolean');
		});
	});

	describe('Logical Expressions', () => {
		it('should handle basic logical operations', () => {
			const result = runFixture('logical-expressions');
			
			expect(result.success).toBe(true);
			expect(result.output).toContain('x > 5 and y > 15: true');
			expect(result.output).toContain('x > 15 or y > 15: true');
			expect(result.output).toContain('not (x > 15): true');
		});

		it('should handle string logical operations', () => {
			const result = runFixture('logical-expressions');
			
			expect(result.success).toBe(true);
			expect(result.output).toContain('name == \'John\' and name.length > 0: false');
			expect(result.output).toContain('name == \'Jane\' or name == \'John\': true');
		});

		it('should handle boolean logical operations', () => {
			const result = runFixture('logical-expressions');
			
			expect(result.success).toBe(true);
			expect(result.output).toContain('flag and true: true');
			expect(result.output).toContain('flag or false: true');
			expect(result.output).toContain('not flag: false');
		});

		it('should handle complex logical expressions', () => {
			const result = runFixture('logical-expressions');
			
			expect(result.success).toBe(true);
			expect(result.output).toContain('(x > 5 and y > 10) or (x < 5 and y < 10): true');
			expect(result.output).toContain('not (x > 15 and y > 25): true');
		});

		it('should handle logical expressions in if statements', () => {
			const result = runFixture('logical-expressions');
			
			expect(result.success).toBe(true);
			expect(result.output).toContain('Both x and y are in valid ranges');
			expect(result.output).toContain('Name is either John or Jane');
			expect(result.output).toContain('x is not greater than 20');
		});

		it('should handle logical expressions with isa', () => {
			const result = runFixture('logical-expressions');
			
			expect(result.success).toBe(true);
			expect(result.output).toContain('Person is a map with string name');
			expect(result.output).toContain('x is either number or string and not null');
		});
	});

	describe('Unary Expressions', () => {
		it('should handle boolean negation', () => {
			const result = runFixture('unary-expressions');
			
			expect(result.success).toBe(true);
			expect(result.output).toContain('not (x > 50): true');
			expect(result.output).toContain('not (x < 50): false');
			expect(result.output).toContain('not flag: false');
			expect(result.output).toContain('not (not flag): true');
		});

		it('should handle arithmetic negation', () => {
			const result = runFixture('unary-expressions');
			
			expect(result.success).toBe(true);
			expect(result.output).toContain('-y: -10');
			expect(result.output).toContain('-(-y): 10');
		});

		it('should handle unary with expressions', () => {
			const result = runFixture('unary-expressions');
			
			expect(result.success).toBe(true);
			expect(result.output).toContain('-(x + 10): -52');
			expect(result.output).toContain('not (x > 30 and y < 0): true');
		});

		it('should handle unary in if statements', () => {
			const result = runFixture('unary-expressions');
			
			expect(result.success).toBe(true);
			expect(result.output).toContain('x is not negative');
		});

		it('should handle complex unary expressions', () => {
			const result = runFixture('unary-expressions');
			
			expect(result.success).toBe(true);
			expect(result.output).toContain('\\nnot (x > 50 or y < -20): false');
			expect(result.output).toContain('-(x + y): -52');
		});

		it('should handle unary with isa', () => {
			const result = runFixture('unary-expressions');
			
			expect(result.success).toBe(true);
			expect(result.output).toContain('x is not a string');
			expect(result.output).toContain('flag is a boolean');
		});
	});

	describe('Comprehensive Integration', () => {
		it('should handle all advanced features together', () => {
			const result = runFixture('advanced-features');
			
			expect(result.success).toBe(true);
			expect(result.output).toContain('=== Advanced MiniScript Features Demo ===');
			expect(result.output).toContain('Import statement: advanced (not implemented)');
			expect(result.output).toContain('\\n=== Type Checking ===');
			expect(result.output).toContain('Number: 42');
			expect(result.output).toContain('String: hello');
			expect(result.output).toContain('Boolean: true');
			expect(result.output).toContain('Map: Alice (age: 30)');
			expect(result.output).toContain('List with 3 items');
			expect(result.output).toContain('\\n=== Logical Expressions ===');
			expect(result.output).toContain('Person is an adult: Bob');
			expect(result.output).toContain('Person is active');
			expect(result.output).toContain('\\n=== For Loops with Control Flow ===');
			expect(result.output).toContain('Sum of even numbers (2,4,6,8): 20');
			expect(result.output).toContain('\\n=== Nested Loops with Type Checking ===');
			expect(result.output).toContain('Row: 1 two 3 (sum: 4)');
			expect(result.output).toContain('Row: four 5 six (sum: 5)');
			expect(result.output).toContain('Row: 7 8 9 (sum: 24)');
			expect(result.output).toContain('\\n=== Complex Logical Expressions ===');
			expect(result.output).toContain('Complex condition: true');
			expect(result.output).toContain('\\n=== Unary Expressions ===');
			expect(result.output).toContain('Positive values count: 5');
			expect(result.output).toContain('\\n=== Final Demo ===');
			expect(result.output).toContain('Sum of 15 and 25 is 40');
			expect(result.output).toContain('\\n=== Advanced Features Demo Completed! ===');
			expect(result.executionTime).toBeLessThan(1000);
		});
	});
});
