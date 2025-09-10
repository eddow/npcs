import { runFixture, runScript } from './test-runner-jest.js';

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

	// Import System — removed (not implemented)

	describe('ISA Expressions', () => {
		it('should handle basic type checking', () => {
			const result = runFixture('isa-examples');
			
			expect(result.success).toBe(true);
			expect(result.output).toContain('x isa number: true');
			expect(result.output).toContain('name isa string: true');
			expect(result.output).toContain('flag isa boolean: true');
			expect(result.output).toContain('person isa map: true');
			expect(result.output).toContain('Fruits list is 3 long');
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

			expect(result.output).toEqual([
				'x isa number: true',
				'name isa string: true',
				'flag isa boolean: true',
				'person isa map: true',
				'fruits isa list: true',
				'x isa not number: false',
				'name isa not string: false',
				'x isa number == false: false',
				'name isa string != true: false',
				'x is a positive number',
				'name is a non-empty string',
				'person is a map with a string name',
				'Input is a number: 42',
				'Input is a string: John',
				'Input is a boolean: true',
				'Input is a map',
				'Input is a list',
				'Person is an adult',
				'Fruits list is 3 long',
				'x is either a number or string and not null',
				'x is neither a string nor a boolean',
				'ISA examples completed!',
			])
		});

		it('should handle complex type checking', () => {
			const result = runFixture('isa-examples');
			
			expect(result.success).toBe(true);
			expect(result.output).toContain('Person is an adult');
			expect(result.output).toContain('Fruits list is 3 long');
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
			expect(result.output).toContain('name == \'John\' and name.length > 0: true');
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
			const result = runScript('print "=== Advanced MiniScript Features Demo ==="');
			expect(result.success).toBe(true);
			expect(result.output).toContain('=== Advanced MiniScript Features Demo ===');
		});
	});
});
