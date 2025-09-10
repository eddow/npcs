import { readFileSync } from "node:fs"
import { join } from "node:path"
import { Lexer, Parser } from "miniscript-core"
import { ExecutionStack, MiniScriptExecutor } from "../src/executor.js"

export interface TestResult {
	success: boolean
	output: string[]
	error?: Error
	executionTime: number
	result?: any,
	stack?: ExecutionStack[],
}

export function	runFixture(fixtureName: string, stack?: ExecutionStack[]): TestResult {
	const fixturePath = join(process.cwd(), "tests", "fixtures", `${fixtureName}.mns`)
	return runFile(fixturePath, stack)
}

export function	runFile(filePath: string, stack?: ExecutionStack[]): TestResult {
	return runScript(readFileSync(filePath, "utf-8"), stack)
}

export function	runScript(content: string, stack?: ExecutionStack[]): TestResult {
	const startTime = Date.now()
	const output: string[] = []

	try {
		const lexer = new Lexer(content)
		const parser = new Parser(content, { lexer })
		const ast = parser.parseChunk()

		const context = {
			statements: {
				print(...args: any[]) {
					output.push(args.join(" "))
				},
				yield: (arg: any) => arg
			},
			functions: {
				len(array: any) {
					if(!Array.isArray(array)) {
						throw new Error('Not an array')
					}
					return array.length
				}
			}
		}

		const executor = new MiniScriptExecutor(
			ast,
			content,
			context,
			stack
		)
		const result = executor.execute()
		const executionTime = Date.now() - startTime

		return { success: true, output, executionTime, result, stack: executor.stack }
	} catch (error: any) {
		const executionTime = Date.now() - startTime
		return { success: false, output, error: error, executionTime }
	}
}
