import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MiniScriptExecutor } from '../src/executor.js'

export interface TestResult {
	success: boolean
	output: string[]
	error?: Error
	executionTime: number
	result?: any
	state?: string
}

export function runFixture(fixtureName: string, state?: string): TestResult {
	const fixturePath = join(process.cwd(), 'tests', 'fixtures', `${fixtureName}.mns`)
	return runFile(fixturePath, state)
}

export function runFile(filePath: string, state?: string): TestResult {
	return runScript(readFileSync(filePath, 'utf-8'), state)
}

export function runScript(source: string, state?: string): TestResult {
	const startTime = Date.now()
	const output: string[] = []

	try {
		const context = {
			print(...args: any[]) {
				output.push(args.join(' '))
			},
			yield: (arg: any) => arg,
			len(array: any) {
				if (!Array.isArray(array)) {
					throw new Error('Not an array')
				}
				return array.length
			},
		}

		const executor = new MiniScriptExecutor(source, context, state)
		const result = executor.execute()
		const executionTime = Date.now() - startTime

		return { success: true, output, executionTime, result, state: executor.state }
	} catch (error: any) {
		const executionTime = Date.now() - startTime
		return { success: false, output, error: error, executionTime }
	}
}
