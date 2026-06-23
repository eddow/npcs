/**
 * Cross-engine test harness.
 *
 * Drives a .test.npcs file: parses pragmas, executes steps,
 * asserts output/result against expectations, serializes state between yields.
 *
 * Engine-agnostic design: the execution primitives (createContext, executeStep)
 * can be swapped for any npcs engine implementation.
 */

import { readFileSync } from 'node:fs'
import { parse, stringify } from 'flatted'
import { ScriptExecutor } from '../src/executor.js'
import type { ExecutionContext, ExecutionState, FunctionResult } from '../src/helpers.js'
import { ExecutionError, reviveState, serializeState } from '../src/helpers.js'
import type { ParsedStep, ParsedTest } from './pragma-parser.js'
import { extractScriptBody, parseTestFile } from './pragma-parser.js'

// ── State serialization (reuses existing flatted pipeline) ──────────

function stringifyState(state: ExecutionState): string {
	return stringify(JSON.parse(stringify(state, serializeState)))
}

function parseState(serialized: string): ExecutionState {
	return parse(JSON.stringify(parse(serialized)), reviveState)
}

// ── Context factory ─────────────────────────────────────────────────

/**
 * Create an execution context with test globals injected.
 * The returned `output` array collects all print() calls.
 */
function createTestContext(globals: Record<string, any>): {
	context: ExecutionContext
	output: string[]
} {
	const output: string[] = []
	const context: ExecutionContext = {
		...globals,

		print(...args: any[]) {
			output.push(args.join(' '))
		},

		yield: (arg: any) => arg,

		assert(condition: any, message?: string) {
			if (!condition) {
				throw new ExecutionError(
					null as any, // executor not available at context-creation time
					null as any,
					message || 'assertion failed',
				)
			}
		},

		fail(message?: string) {
			throw new ExecutionError(null as any, null as any, message || 'fail() called')
		},

		plan: {
			conclude: (plan: string) => {
				output.push(`${plan} concluded`)
			},
			cancel: (plan: string) => {
				output.push(`${plan} cancelled`)
			},
			finally: (plan: string) => {
				output.push(`${plan} finalized`)
			},
		},
	}
	return { context, output }
}

// ── Deep equality ───────────────────────────────────────────────────

/**
 * Deep structural equality for value assertions.
 * Handles null, primitives, arrays, and plain objects.
 */
function deepEqual(a: any, b: any): boolean {
	if (a === b) return true
	if (a === null || b === null) return false
	if (typeof a !== typeof b) return false

	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return false
		for (let i = 0; i < a.length; i++) {
			if (!deepEqual(a[i], b[i])) return false
		}
		return true
	}

	if (typeof a === 'object' && typeof b === 'object') {
		const aKeys = Object.keys(a)
		const bKeys = Object.keys(b)
		if (aKeys.length !== bKeys.length) return false
		for (const key of aKeys) {
			if (!(key in b)) return false
			if (!deepEqual(a[key], b[key])) return false
		}
		return true
	}

	return false
}

// ── Step execution ──────────────────────────────────────────────────

interface StepResult {
	success: boolean
	output: string[]
	error?: { message: string; stack?: string }
	executionTimeMs: number
	result?: FunctionResult
	state?: string
}

/**
 * Execute one step of a test: run the script from current state to the next yield/return/error.
 */
function executeStep(source: string, context: ExecutionContext, stateStr?: string): StepResult {
	const startTime = performance.now()
	const output = (context.print as any)?.outputArray
	// Reset output capture — we use the context's print which pushes to our output array
	// but we need to intercept. Instead, we create a fresh output array each step.

	try {
		const parsedState: ExecutionState | undefined = stateStr ? parseState(stateStr) : undefined
		const executor = new ScriptExecutor(source, context, parsedState)
		const result = executor.execute()
		const executionTimeMs = Math.round((performance.now() - startTime) * 100) / 100

		// Extract output from context's print function
		// Since createTestContext injects print that pushes to the output array,
		// we need to collect it. We'll handle this at the harness level.

		return {
			success: true,
			output: [], // filled by harness
			executionTimeMs,
			result,
			state: result.type === 'yield' ? stringifyState(executor.state) : undefined,
		}
	} catch (error: any) {
		const executionTimeMs = Math.round((performance.now() - startTime) * 100) / 100
		return {
			success: false,
			output: [], // filled by harness
			error: {
				message: error.message || String(error),
				stack: error.stack,
			},
			executionTimeMs,
		}
	}
}

// ── Step assertion ──────────────────────────────────────────────────

interface AssertionResult {
	passed: boolean
	failures: string[]
}

function formatValue(v: any): string {
	if (v === undefined) return 'undefined'
	if (v === null) return 'null'
	return JSON.stringify(v)
}

/**
 * Assert that the actual step execution matches the expected directives.
 */
function assertStep(actual: StepResult, expected: ParsedStep, stepIndex: number): AssertionResult {
	const failures: string[] = []
	const prefix = `Step ${stepIndex + 1}`

	// Check output lines
	for (let i = 0; i < expected.outputs.length; i++) {
		const expectedOutput = expected.outputs[i]
		const actualOutput = i < actual.output.length ? actual.output[i] : undefined
		if (actualOutput === undefined) {
			failures.push(
				`${prefix}: missing @output[${i}]: expected "${expectedOutput}", got nothing (output ended at ${actual.output.length} lines)`,
			)
		} else if (actualOutput !== expectedOutput) {
			failures.push(
				`${prefix}: @output[${i}] mismatch:\n  expected: "${expectedOutput}"\n  actual:   "${actualOutput}"`,
			)
		}
	}

	// Check for unexpected extra output
	if (actual.output.length > expected.outputs.length) {
		const extra = actual.output.slice(expected.outputs.length)
		failures.push(
			`${prefix}: unexpected extra output (${extra.length} lines):\n  ${extra.map((s) => `"${s}"`).join('\n  ')}`,
		)
	}

	// Check result type
	if (expected.resultType === 'error') {
		// Expected error
		if (actual.success) {
			failures.push(
				`${prefix}: expected error but execution succeeded (${actual.result?.type || 'return'})`,
			)
		} else if (expected.errorSubstring && actual.error) {
			const msg = actual.error.message.toLowerCase()
			const expectedSub = expected.errorSubstring.toLowerCase()
			if (!msg.includes(expectedSub)) {
				failures.push(
					`${prefix}: @error substring mismatch:\n  expected to contain: "${expected.errorSubstring}"\n  actual message:     "${actual.error.message}"`,
				)
			}
		}
	} else if (!actual.success) {
		// Unexpected error
		failures.push(`${prefix}: unexpected error: ${actual.error?.message || 'unknown error'}`)
	} else if (actual.result) {
		// Check result type
		if (actual.result.type !== expected.resultType) {
			failures.push(
				`${prefix}: expected result type "${expected.resultType}", got "${actual.result.type}"`,
			)
		}

		// Check result value if specified
		if (expected.resultValueSpecified) {
			if (!deepEqual(actual.result.value, expected.resultValue)) {
				failures.push(
					`${prefix}: @${expected.resultType} value mismatch:\n  expected: ${formatValue(expected.resultValue)}\n  actual:   ${formatValue(actual.result.value)}`,
				)
			}
		}
	} else if (expected.resultType !== 'return') {
		// No result but expected yield or error
		failures.push(`${prefix}: expected result type "${expected.resultType}" but got no result`)
	}
	// return with no value is fine — that's the implicit case

	return { passed: failures.length === 0, failures }
}

// ── Full test runner ────────────────────────────────────────────────

export interface TestFileResult {
	fileName: string
	passed: boolean
	steps: Array<{
		stepIndex: number
		passed: boolean
		failures: string[]
		output: string[]
		executionTimeMs: number
	}>
	totalTimeMs: number
}

/**
 * Run a full .test.npcs file through all its steps.
 */
export function runTestFile(filePath: string): TestFileResult {
	const startTime = performance.now()
	const source = readFileSync(filePath, 'utf-8')
	const fileName = filePath.split('/').pop() || filePath

	const parsed = parseTestFile(source)
	if (!parsed) {
		return {
			fileName,
			passed: false,
			steps: [
				{
					stepIndex: 0,
					passed: false,
					failures: ['No @npcs-test pragma block found'],
					output: [],
					executionTimeMs: 0,
				},
			],
			totalTimeMs: 0,
		}
	}

	const scriptBody = extractScriptBody(source)
	const steps: TestFileResult['steps'] = []
	let passed = true
	let stateStr: string | undefined

	for (let i = 0; i < parsed.steps.length; i++) {
		const expected = parsed.steps[i]

		// Create fresh context with step globals
		const { context, output } = createTestContext(expected.globals)

		// Execute
		const actual = executeStep(scriptBody, context, stateStr)
		actual.output = output // attach captured output

		// Assert
		const assertion = assertStep(actual, expected, i)

		steps.push({
			stepIndex: i,
			passed: assertion.passed,
			failures: assertion.failures,
			output: actual.output,
			executionTimeMs: actual.executionTimeMs,
		})

		if (!assertion.passed) {
			passed = false
			break // Don't continue after a failed step
		}

		// If this step yielded, capture state for next step
		if (expected.resultType === 'yield') {
			stateStr = actual.state
		} else {
			// return or error — should be the last step
			if (i !== parsed.steps.length - 1) {
				steps[steps.length - 1].failures.push(
					`Step ${i + 1}: result type is "${expected.resultType}" but more steps follow`,
				)
				passed = false
			}
			break
		}
	}

	const totalTimeMs = Math.round((performance.now() - startTime) * 100) / 100

	return { fileName, passed, steps, totalTimeMs }
}
