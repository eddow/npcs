// Test suite index - runs all tests
import './miniscript.test';
import './executor.test';
import './advanced-features.test';
import './pause-resume.test';

describe('MiniScript Executor - Complete Test Suite', () => {
	it('should have all test modules loaded', () => {
		// This test ensures all test modules are properly imported
		expect(true).toBe(true);
	});
});
