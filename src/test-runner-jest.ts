import { readFileSync } from "node:fs"
import { join } from "node:path"
import { Lexer, Parser } from "miniscript-core"
import { ExecutionScope, MiniScriptExecutor } from "./executor.js"

export interface TestResult {
	success: boolean
	output: string[]
	error?: string
	executionTime: number
	result?: any,
	scopes?: ExecutionScope[],
}

export function	runFixture(fixtureName: string, scopes?: ExecutionScope[]): TestResult {
	const fixturePath = join(process.cwd(), "tests", "fixtures", `${fixtureName}.mns`)
	return runFile(fixturePath, scopes)
}

export function	runFile(filePath: string, scopes?: ExecutionScope[]): TestResult {
	return runScript(readFileSync(filePath, "utf-8"), scopes)
}

export function	runScript(content: string, scopes: ExecutionScope[] = [MiniScriptExecutor.emptyScope()]): TestResult {
	const startTime = Date.now()
	const output: string[] = []

	try {
		const lexer = new Lexer(content)
		const parser = new Parser(content, { lexer })
		const ast = parser.parseChunk()


		const executor = new MiniScriptExecutor(
			ast,
			[...scopes, MiniScriptExecutor.rootScope({}, {
				print: (...args: any[]) => {
					output.push(args.join(" "))
				},
				yield: (arg: any) => arg
			})],
			content)
		const result = executor.execute()
		const executionTime = Date.now() - startTime

		return { success: true, output, executionTime, result, scopes: executor.scopes.slice(0, -1) }
	} catch (error: any) {
		const executionTime = Date.now() - startTime
		return { success: false, output, error: error.message, executionTime }
	}
}
