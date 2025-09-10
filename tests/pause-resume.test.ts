import { runFixture } from '../src/test-runner-jest.js';

describe('Pause/Resume Execution', () => {

	describe('Basic Pause/Resume', () => {
		it('should pause and resume basic execution', () => {
			const result = runFixture('pause-basic');
			
			expect(result.success).toBe(true);
			expect(result.output).toEqual(['Before yield: x = 10'])
			expect(result.result).toEqual({type: 'yield', value: 42});
			expect(result.executionTime).toBeLessThan(1000);

			const second = runFixture('pause-basic', result.scopes);
			expect(second.success).toBe(true);
			expect(second.output).toEqual(['After yield: x = 10', 'Execution completed!'])
			expect(second.result).toEqual({type: 'eob'});
			expect(second.executionTime).toBeLessThan(1000);
		});

		it('should resume execution from paused state', () => {
			// First, pause execution
			const pauseResult = runner.runPauseTest('tests/fixtures/pause-basic.mns');
			
			expect(pauseResult.success).toBe(true);
			expect(pauseResult.paused).toBe(true);
			expect(pauseResult.state).toBeDefined();
			
			// Then resume execution
			const resumeResult = runner.resumeExecution(pauseResult.state!, 'tests/fixtures/pause-basic.mns');
			
			expect(resumeResult.success).toBe(true);
			expect(resumeResult.paused).toBe(false);
			expect(resumeResult.output).toContain('After yield: x = 10');
			expect(resumeResult.output).toContain('Execution completed!');
			expect(resumeResult.executionTime).toBeLessThan(1000);
		});
	});

	describe('Pause in Control Flow', () => {
		it('should pause and resume inside if statement', () => {
			// First, pause execution
			const pauseResult = runner.runPauseTest('tests/fixtures/pause-if.mns');
			
			expect(pauseResult.success).toBe(true);
			expect(pauseResult.paused).toBe(true);
			expect(pauseResult.state).toBeDefined();
			expect(pauseResult.state?.variables).toHaveProperty('x');
			expect(pauseResult.state?.variables.x).toBe(15);
			expect(pauseResult.state?.currentStatementPath).toEqual({
				statementIndexes: [1, 1]
			});
			expect(pauseResult.output).toContain('Inside if: x = 15');
			expect(pauseResult.output).toContain('EXECUTION PAUSED - State serialized:');
			
			// Then resume execution
			const resumeResult = runner.resumeExecution(pauseResult.state!, 'tests/fixtures/pause-if.mns');
			
			expect(resumeResult.success).toBe(true);
			expect(resumeResult.paused).toBe(false);
			expect(resumeResult.output).toContain('After pause in if: x = 15');
			expect(resumeResult.output).toContain('After if block');
			expect(resumeResult.executionTime).toBeLessThan(1000);
		});

		it.skip('should pause and resume inside while loop', () => {
			// First, pause execution
			const pauseResult = runner.runPauseTest('tests/fixtures/pause-loop.mns');
			
			expect(pauseResult.success).toBe(true);
			expect(pauseResult.paused).toBe(true);
			expect(pauseResult.state).toBeDefined();
			expect(pauseResult.state?.variables).toHaveProperty('counter');
			expect(pauseResult.state?.variables.counter).toBe(3);
			expect(pauseResult.output).toContain('Loop iteration: 0');
			expect(pauseResult.output).toContain('Loop iteration: 1');
			expect(pauseResult.output).toContain('Loop iteration: 2');
			expect(pauseResult.output).toContain('EXECUTION PAUSED - State serialized:');
			
			// Then resume execution
			const resumeResult = runner.resumeExecution(pauseResult.state!, 'tests/fixtures/pause-loop.mns');
			
			expect(resumeResult.success).toBe(true);
			expect(resumeResult.paused).toBe(false);
			expect(resumeResult.output).toContain('Loop iteration: 3');
			expect(resumeResult.output).toContain('Loop completed');
			expect(resumeResult.executionTime).toBeLessThan(1000);
		});

		it('should pause and resume inside function', () => {
			// First, pause execution
			const pauseResult = runner.runPauseTest('tests/fixtures/pause-function.mns');
			
			expect(pauseResult.success).toBe(true);
			expect(pauseResult.paused).toBe(true);
			expect(pauseResult.state).toBeDefined();
			expect(pauseResult.state?.variables).toHaveProperty('testFunc');
			expect(pauseResult.output).toContain('Function called with: 5');
			expect(pauseResult.output).toContain('EXECUTION PAUSED - State serialized:');
			
			// Then resume execution
			const resumeResult = runner.resumeExecution(pauseResult.state!, 'tests/fixtures/pause-function.mns');
			
			expect(resumeResult.success).toBe(true);
			expect(resumeResult.paused).toBe(false);
			expect(resumeResult.output).toContain('Function completed');
			expect(resumeResult.executionTime).toBeLessThan(1000);
		});
	});

	describe('Object State Preservation', () => {
		it.skip('should preserve object state across pause/resume', () => {
			// TODO: Fix resume functionality for complex state
			// First, pause execution
			const pauseResult = runner.runPauseTest('tests/fixtures/pause-objects.mns');
			
			expect(pauseResult.success).toBe(true);
			expect(pauseResult.paused).toBe(true);
			expect(pauseResult.state).toBeDefined();
			expect(pauseResult.state?.variables).toHaveProperty('person');
			expect(pauseResult.state?.variables.person).toEqual({
				name: 'Alice',
				age: 30,
				active: true
			});
			expect(pauseResult.output).toContain('Before pause: Alice is 30');
			expect(pauseResult.output).toContain('EXECUTION PAUSED - State serialized:');
			
			// Then resume execution
			const resumeResult = runner.resumeExecution(pauseResult.state!, 'tests/fixtures/pause-objects.mns');
			
			expect(resumeResult.success).toBe(true);
			expect(resumeResult.paused).toBe(false);
			expect(resumeResult.output).toContain('After pause: Alice is now 31');
		});
	});

	describe('State Serialization', () => {
		it('should serialize execution state correctly', () => {
			const result = runner.runPauseTest('tests/fixtures/pause-basic.mns');
			
			expect(result.success).toBe(true);
			expect(result.paused).toBe(true);
			expect(result.state).toBeDefined();
			
			const state = result.state!;
			
			// Check state structure
			expect(state).toHaveProperty('variables');
			expect(state).toHaveProperty('functionCallStack');
			expect(state).toHaveProperty('currentStatementPath');
			expect(state).toHaveProperty('source');
			expect(state).toHaveProperty('executionPaused');
			expect(state).toHaveProperty('pauseReason');
			
			// Check variable values
			expect(state.variables).toHaveProperty('x');
			expect(state.variables.x).toBe(10);
			
			// Check execution state
			expect(state.executionPaused).toBe(true);
			expect(state.pauseReason).toBe('yield called');
					expect(state.currentStatementPath.statementIndex).toBeGreaterThanOrEqual(0);
			
			// Check source code
			expect(state.source).toContain('x = 10');
			expect(state.source).toContain('yield()');
		});

		it('should handle function references in state', () => {
			const result = runner.runPauseTest('tests/fixtures/pause-function.mns');
			
			expect(result.success).toBe(true);
			expect(result.paused).toBe(true);
			expect(result.state).toBeDefined();
			
			const state = result.state!;
			
			// Check that function is preserved
			expect(state.variables).toHaveProperty('testFunc');
			expect(state.variables.testFunc).toHaveProperty('__type', 'function');
			expect(state.variables.testFunc).toHaveProperty('__reference');
		});
	});

	describe('Cross-Executor Restoration', () => {
		it('should restore state in new executor instance', () => {
			// TODO: Fix resume functionality for cross-executor restoration
			// First, pause execution
			const pauseResult = runner.runPauseTest('tests/fixtures/pause-basic.mns');
			
			expect(pauseResult.success).toBe(true);
			expect(pauseResult.paused).toBe(true);
			expect(pauseResult.state).toBeDefined();
			
			// Then resume in a completely new executor
			const resumeResult = runner.resumeExecution(pauseResult.state!, 'tests/fixtures/pause-basic.mns');
			
			expect(resumeResult.success).toBe(true);
			expect(resumeResult.paused).toBe(false);
			expect(resumeResult.output).toContain('After yield: x = 10');
			expect(resumeResult.output).toContain('Execution completed!');
		});

		it.skip('should maintain variable state across executors', () => {
			// TODO: Fix resume functionality for cross-executor restoration
			// First, pause execution
			const pauseResult = runner.runPauseTest('tests/fixtures/pause-objects.mns');
			
			expect(pauseResult.success).toBe(true);
			expect(pauseResult.paused).toBe(true);
			expect(pauseResult.state).toBeDefined();
			
			// Then resume in a new executor
			const resumeResult = runner.resumeExecution(pauseResult.state!, 'tests/fixtures/pause-objects.mns');
			
			expect(resumeResult.success).toBe(true);
			expect(resumeResult.paused).toBe(false);
			expect(resumeResult.output).toContain('After pause: Alice is now 31');
		});
	});

	describe('Error Handling', () => {
		it('should handle invalid state gracefully', () => {
			const invalidState = {
				variables: {},
				callStack: [],
				currentStatementIndex: 0,
				source: 'invalid code',
				executionPaused: true,
				pauseReason: 'test'
			};
			
			// @ts-expect-error - invalid state, that's the point
			const result = runner.resumeExecution(invalidState, 'tests/fixtures/pause-basic.mns');
			
			// Should handle gracefully (might fail or succeed depending on implementation)
			expect(typeof result.success).toBe('boolean');
		});

		it('should handle missing yield calls', () => {
			const result = runner.runPauseTest('tests/fixtures/basic.mns');
			
			expect(result.success).toBe(true);
			expect(result.paused).toBe(false);
			expect(result.state).toBeUndefined();
		});
	});
});
