/**
 * Cross-engine test suite.
 *
 * Auto-discovers all *.test.npcs files in tests/ and runs them
 * through the cross-engine harness. Each file becomes a describe block
 * with one it() that runs all steps sequentially and reports failures.
 */

import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { runTestFile } from './cross-engine-harness.js'

const FIXTURES_DIR = join(process.cwd(), '..', 'tests')

// Discover all .test.npcs files
const fixtureFiles = readdirSync(FIXTURES_DIR)
	.filter((f) => f.endsWith('.test.npcs'))
	.sort()

if (fixtureFiles.length === 0) {
	describe('Cross-engine tests', () => {
		it('no .test.npcs fixtures found in tests/', () => {
			expect(true).toBe(true)
		})
	})
} else {
	for (const file of fixtureFiles) {
		const filePath = join(FIXTURES_DIR, file)

		describe(file, () => {
			it('executes all steps correctly', () => {
				const result = runTestFile(filePath)

				if (!result.passed) {
					const allFailures = result.steps.filter((s) => !s.passed).flatMap((s) => s.failures)
					throw new Error(
						`${result.fileName} FAILED (${result.totalTimeMs}ms):\n${allFailures.join('\n')}`,
					)
				}

				// All steps passed — verify timing
				for (const step of result.steps) {
					expect(step.executionTimeMs).toBeLessThan(5000)
				}
				expect(result.passed).toBe(true)
			})
		})
	}
}
