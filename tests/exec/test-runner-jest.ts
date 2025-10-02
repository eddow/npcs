import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse, stringify } from 'flatted'
import { MiniScriptExecutor } from '../../src/executor.js'
import type {
	ExecutionContext,
	ExecutionStackEntry,
	ExecutionState,
	FunctionResult,
} from '../../src/helpers.js'
import { reviveState, serializeState } from '../../src/helpers.js'

// Helper functions to handle circular references in ExecutionState
function stringifyStack(stack: ExecutionState): any {
	return JSON.parse(stringify(stack, serializeState))
}

function parseStack(serialized: any): ExecutionState {
	return parse(JSON.stringify(serialized), reviveState)
}

function createContext(output: string[]): ExecutionContext {
	return {
		print(...args: any[]) {
			output.push(args.join(' '))
		},
		yield: (arg: any) => arg,
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
}

export interface TestResult {
	success: boolean
	output: string[]
	error?: Error
	executionTime: number
	result?: FunctionResult
	state?: string
}

export interface CancelResult {
	success: boolean
	output: string[]
	error?: Error
	executionTime: number
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
		const context = createContext(output)

		//TODO: re-serialize (plans -> serialize native functions)
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

export function cancelFixture(fixtureName: string, state?: string, plan?: any): CancelResult {
	const fixturePath = join(process.cwd(), 'tests/exec', 'fixtures', `${fixtureName}.npcs`)
	return cancelFile(fixturePath, state, plan)
}

export function cancelFile(filePath: string, state?: string, plan?: any): CancelResult {
	return cancelScript(readFileSync(filePath, 'utf-8'), state, plan)
}

export function cancelScript(source: string, state?: string, plan?: any): CancelResult {
	const startTime = Date.now()
	const output: string[] = []

	try {
		const context = createContext(output)
		const parsedState: ExecutionState | undefined = state ? parseStack(parse(state)) : undefined
		const executor = new MiniScriptExecutor(source, context, parsedState)
		const newState = executor.cancel(plan)
		const executionTime = Date.now() - startTime

		return {
			success: true,
			output,
			executionTime,
			state: newState && stringify(stringifyStack(newState)),
		}
	} catch (error: any) {
		const executionTime = Date.now() - startTime
		console.log('Error in cancel runner:', error)
		return { success: false, output, error: error, executionTime }
	}
}
