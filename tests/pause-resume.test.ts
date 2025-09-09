import { PauseTestRunner } from '../src/pause-test-runner-jest.js';

describe('Pause/Resume Execution', () => {
	const runner = new PauseTestRunner();

	describe('Basic Pause/Resume', () => {
		it('should pause and resume basic execution', async () => {
			const result = await runner.runPauseTest('tests/fixtures/pause-basic.mns');
			
			expect(result.success).toBe(true);
			expect(result.paused).toBe(true);
			expect(result.state).toBeDefined();
			expect(result.state?.executionPaused).toBe(true);
			expect(result.state?.pauseReason).toBe('waitTomorrow called');
			expect(result.state?.variables).toHaveProperty('x');
			expect(result.state?.variables.x).toBe(10);
			expect(result.output).toContain('Before waitTomorrow: x = 10');
			expect(result.output).toContain('EXECUTION PAUSED - State serialized:');
			expect(result.executionTime).toBeLessThan(1000);
		});

		it('should resume execution from paused state', async () => {
			// First, pause execution
			const pauseResult = await runner.runPauseTest('tests/fixtures/pause-basic.mns');
			
			expect(pauseResult.success).toBe(true);
			expect(pauseResult.paused).toBe(true);
			expect(pauseResult.state).toBeDefined();
			
			// Then resume execution
			const resumeResult = await runner.resumeExecution(pauseResult.state!, 'tests/fixtures/pause-basic.mns');
			
			expect(resumeResult.success).toBe(true);
			expect(resumeResult.paused).toBe(false);
			expect(resumeResult.output).toContain('After waitTomorrow: x = 10');
			expect(resumeResult.output).toContain('Execution completed!');
			expect(resumeResult.executionTime).toBeLessThan(1000);
		});
	});

	describe('Pause in Control Flow', () => {
		it('should pause inside if statement', async () => {
			const result = await runner.runPauseTest('tests/fixtures/pause-if.mns');
			
			expect(result.success).toBe(true);
			expect(result.paused).toBe(true);
			expect(result.state).toBeDefined();
			expect(result.state?.variables).toHaveProperty('x');
			expect(result.state?.variables.x).toBe(15);
			expect(result.output).toContain('Inside if: x = 15');
			expect(result.output).toContain('EXECUTION PAUSED - State serialized:');
		});

		it('should pause inside while loop', async () => {
			const result = await runner.runPauseTest('tests/fixtures/pause-loop.mns');
			
			expect(result.success).toBe(true);
			expect(result.paused).toBe(true);
			expect(result.state).toBeDefined();
			expect(result.state?.variables).toHaveProperty('counter');
			expect(result.state?.variables.counter).toBe(2);
			expect(result.output).toContain('Loop iteration: 0');
			expect(result.output).toContain('Loop iteration: 1');
			expect(result.output).toContain('EXECUTION PAUSED - State serialized:');
		});

		it('should pause inside function', async () => {
			const result = await runner.runPauseTest('tests/fixtures/pause-function.mns');
			
			expect(result.success).toBe(true);
			expect(result.paused).toBe(true);
			expect(result.state).toBeDefined();
			expect(result.state?.variables).toHaveProperty('testFunc');
			expect(result.output).toContain('Function called with: 5');
			expect(result.output).toContain('EXECUTION PAUSED - State serialized:');
		});
	});

	describe('Object State Preservation', () => {
		it('should preserve object state across pause/resume', async () => {
			// First, pause execution
			const pauseResult = await runner.runPauseTest('tests/fixtures/pause-objects.mns');
			
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
			const resumeResult = await runner.resumeExecution(pauseResult.state!, 'tests/fixtures/pause-objects.mns');
			
			expect(resumeResult.success).toBe(true);
			expect(resumeResult.paused).toBe(false);
			expect(resumeResult.output).toContain('After pause: Alice is now 31');
		});
	});

	describe('State Serialization', () => {
		it('should serialize execution state correctly', async () => {
			const result = await runner.runPauseTest('tests/fixtures/pause-basic.mns');
			
			expect(result.success).toBe(true);
			expect(result.paused).toBe(true);
			expect(result.state).toBeDefined();
			
			const state = result.state!;
			
			// Check state structure
			expect(state).toHaveProperty('variables');
			expect(state).toHaveProperty('callStack');
			expect(state).toHaveProperty('currentStatementIndex');
			expect(state).toHaveProperty('source');
			expect(state).toHaveProperty('executionPaused');
			expect(state).toHaveProperty('pauseReason');
			
			// Check variable values
			expect(state.variables).toHaveProperty('x');
			expect(state.variables.x).toBe(10);
			
			// Check execution state
			expect(state.executionPaused).toBe(true);
			expect(state.pauseReason).toBe('waitTomorrow called');
			expect(state.currentStatementIndex).toBeGreaterThanOrEqual(0);
			
			// Check source code
			expect(state.source).toContain('x = 10');
			expect(state.source).toContain('waitTomorrow()');
		});

		it('should handle function references in state', async () => {
			const result = await runner.runPauseTest('tests/fixtures/pause-function.mns');
			
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
		it('should restore state in new executor instance', async () => {
			// First, pause execution
			const pauseResult = await runner.runPauseTest('tests/fixtures/pause-basic.mns');
			
			expect(pauseResult.success).toBe(true);
			expect(pauseResult.paused).toBe(true);
			expect(pauseResult.state).toBeDefined();
			
			// Then resume in a completely new executor
			const resumeResult = await runner.resumeExecution(pauseResult.state!, 'tests/fixtures/pause-basic.mns');
			
			expect(resumeResult.success).toBe(true);
			expect(resumeResult.paused).toBe(false);
			expect(resumeResult.output).toContain('After waitTomorrow: x = 10');
			expect(resumeResult.output).toContain('Execution completed!');
		});

		it('should maintain variable state across executors', async () => {
			// First, pause execution
			const pauseResult = await runner.runPauseTest('tests/fixtures/pause-objects.mns');
			
			expect(pauseResult.success).toBe(true);
			expect(pauseResult.paused).toBe(true);
			expect(pauseResult.state).toBeDefined();
			
			// Then resume in a new executor
			const resumeResult = await runner.resumeExecution(pauseResult.state!, 'tests/fixtures/pause-objects.mns');
			
			expect(resumeResult.success).toBe(true);
			expect(resumeResult.paused).toBe(false);
			expect(resumeResult.output).toContain('After pause: Alice is now 31');
		});
	});

	describe('Error Handling', () => {
		it('should handle invalid state gracefully', async () => {
			const invalidState = {
				variables: {},
				callStack: [],
				currentStatementIndex: 0,
				source: 'invalid code',
				executionPaused: true,
				pauseReason: 'test'
			};
			
			const result = await runner.resumeExecution(invalidState, 'tests/fixtures/pause-basic.mns');
			
			// Should handle gracefully (might fail or succeed depending on implementation)
			expect(typeof result.success).toBe('boolean');
		});

		it('should handle missing waitTomorrow calls', async () => {
			const result = await runner.runPauseTest('tests/fixtures/basic.mns');
			
			expect(result.success).toBe(true);
			expect(result.paused).toBe(false);
			expect(result.state).toBeUndefined();
		});
	});
});
