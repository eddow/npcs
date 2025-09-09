import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const MiniScript = require('miniscript-core');
import { MiniScriptExecutor } from "./executor";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface TestResult {
	success: boolean;
	output: string[];
	error?: string;
	executionTime: number;
}

export class MiniScriptTestRunner {
	private executor: MiniScriptExecutor;

	constructor() {
		this.executor = new MiniScriptExecutor();
	}

	async runFile(filePath: string): Promise<TestResult> {
		const startTime = Date.now();
		const output: string[] = [];
		
		// Capture console.log output
		const originalLog = console.log;
		console.log = (...args: any[]) => {
			output.push(args.join(" "));
		};

		try {
			// Read and parse the MiniScript file
			const content = readFileSync(filePath, 'utf-8');
			const lexer = new MiniScript.Lexer(content);
			const parser = new MiniScript.Parser(content, { lexer });
			const ast = parser.parseChunk();

			// Execute the AST
			this.executor.execute(ast);

			const executionTime = Date.now() - startTime;
			
			return {
				success: true,
				output,
				executionTime
			};
		} catch (error) {
			const executionTime = Date.now() - startTime;
			
			return {
				success: false,
				output,
				error: error instanceof Error ? error.message : String(error),
				executionTime
			};
		} finally {
			// Restore original console.log
			console.log = originalLog;
		}
	}

	async runFixture(fixtureName: string): Promise<TestResult> {
		const filePath = join(__dirname, '..', 'tests', 'fixtures', `${fixtureName}.mns`);
		return this.runFile(filePath);
	}

	// Helper method to get expected output for a fixture
	getExpectedOutput(fixtureName: string): string[] {
		const expectations: Record<string, string[]> = {
			'basic': [
				'Sum: 15',
				'Product: 50'
			],
			'functions': [
				'Hello, World!',
				'Calculation result: 25',
				'Function returned: 25'
			],
			'objects': [
				'Person name: John',
				'Person age: 39',
				'Company: TechCorp',
				'CEO name: Jane',
				'Updated age: 40'
			],
			'arrays': [
				'First fruit: apple',
				'Second fruit: banana',
				'Count: 10',
				'Active: true',
				'First item: apple'
			],
			'control-flow': [
				'x is greater than 5',
				'Let\'s do some calculations',
				'y = 20',
				'Counter is: 0',
				'Counter is: 1',
				'Counter is: 2',
				'Loop finished!'
			],
			'error-handling': [
				'This should show undefined: undefined',
				'Parameter x: undefined',
				'Function result: undefined'
			]
		};

		return expectations[fixtureName] || [];
	}
}
