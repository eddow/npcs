import { readFileSync } from "node:fs"
import { join } from "node:path"
import { Lexer, Parser } from "miniscript-core"
import { ExecutionScope, MiniScriptExecutor, emptyScope, rootScope } from "../src/executor.js"

export interface TestResult {
	success: boolean
	output: string[]
	error?: string
	executionTime: number
	result?: any,
	state?: ExecutionScope[],
}

export function	runFixture(fixtureName: string, state?: ExecutionScope[]): TestResult {
	const fixturePath = join(process.cwd(), "tests", "fixtures", `${fixtureName}.mns`)
	return runFile(fixturePath, state)
}

export function	runFile(filePath: string, state?: ExecutionScope[]): TestResult {
	return runScript(readFileSync(filePath, "utf-8"), state)
}

export function	runScript(content: string, state: ExecutionScope[] = [emptyScope()]): TestResult {
	const startTime = Date.now()
	const output: string[] = []

	try {
		const lexer = new Lexer(content)
		const parser = new Parser(content, { lexer })
		const ast = parser.parseChunk()


		const executor = new MiniScriptExecutor(
			ast,
			content,
			rootScope({}, {
				print: (...args: any[]) => {
					output.push(args.join(" "))
				},
				yield: (arg: any) => arg
			}, {
				len(array: any) {
					if(!Array.isArray(array)) {
						throw new Error('Not an array')
					}
					return array.length
				}
			}),
			state)
		const result = executor.execute()
		const executionTime = Date.now() - startTime

		return { success: true, output, executionTime, result, state: executor.state }
	} catch (error: any) {
		const executionTime = Date.now() - startTime
		return { success: false, output, error: error.message, executionTime }
	}
}
