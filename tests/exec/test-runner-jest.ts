import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse, stringify } from 'flatted'
import { MiniScriptExecutor } from '../../src/executor.js'
import type { ExecutionContext, ExecutionStackEntry, ExecutionState } from '../../src/helpers.js'
import { reviveState, serializeState } from '../../src/helpers.js'

// Helper functions to handle circular references in ExecutionState
function stringifyStack(stack: ExecutionStackEntry[]): any {
	return JSON.parse(stringify(stack, serializeState))
}

function parseStack(serialized: any): ExecutionStackEntry[] {
	return parse(JSON.stringify(serialized), reviveState)
}

export interface TestResult {
	success: boolean
	output: string[]
	error?: Error
	executionTime: number
	result?: any
	state?: string
}

export function runFixture(fixtureName: string, state?: string): TestResult {
	const fixturePath = join(process.cwd(), 'tests/exec', 'fixtures', `${fixtureName}.npcs`)
	return runFile(fixturePath, state)
}

export function runFile(filePath: string, state?: string): TestResult {
	return runScript(readFileSync(filePath, 'utf-8'), state)
}

export function runScript(source: string, state?: string): TestResult {
	const startTime = Date.now()
	const output: string[] = []

	try {
		const context: ExecutionContext = {
			print(...args: any[]) {
				output.push(args.join(' '))
			},
			yield: (arg: any) => arg,
		}

		const parsedState: ExecutionState | undefined = state ? parseStack(parse(state)) : undefined
		const executor = new MiniScriptExecutor(source, context, parsedState)
		const result = executor.execute()
		const executionTime = Date.now() - startTime

		return {
			success: true,
			output,
			executionTime,
			result,
			state: stringify(stringifyStack(executor.state)),
		}
	} catch (error: any) {
		const executionTime = Date.now() - startTime
		console.log('Error in test runner:', error)
		return { success: false, output, error: error, executionTime }
	}
}
