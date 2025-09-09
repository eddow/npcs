import { MiniScriptExecutor } from "./executor.js";
import { TestIO } from "./io-interface.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface TestResult {
	success: boolean;
	output: string[];
	error?: string;
	executionTime: number;
}

export class MiniScriptTestRunner {
	private executor: MiniScriptExecutor;
	private io: TestIO;
	private MiniScript: any;

	constructor() {
		this.io = new TestIO();
		this.executor = new MiniScriptExecutor(this.io);
		// Dynamically import miniscript-core for Jest compatibility
		this.initializeMiniScript();
	}

	private async initializeMiniScript() {
		if (!this.MiniScript) {
			this.MiniScript = await import('miniscript-core');
		}
	}

	async runFixture(fixtureName: string): Promise<TestResult> {
		await this.initializeMiniScript();
		
		const startTime = Date.now();
		
		// Clear previous output
		this.io.clear();

		try {
			const fixturePath = join(process.cwd(), 'tests', 'fixtures', `${fixtureName}.mns`);
			const content = readFileSync(fixturePath, 'utf-8');
			
			const lexer = new this.MiniScript.Lexer(content);
			const parser = new this.MiniScript.Parser(content, { lexer });
			const ast = parser.parseChunk();
			
			this.executor.execute(ast);
			const executionTime = Date.now() - startTime;
			
			return { success: true, output: this.io.getOutput(), executionTime };
		} catch (error: any) {
			const executionTime = Date.now() - startTime;
			return { success: false, output: this.io.getOutput(), error: error.message, executionTime };
		}
	}

	async runFile(filePath: string): Promise<TestResult> {
		await this.initializeMiniScript();
		
		const startTime = Date.now();
		
		// Clear previous output
		this.io.clear();

		try {
			const content = readFileSync(filePath, 'utf-8');
			
			const lexer = new this.MiniScript.Lexer(content);
			const parser = new this.MiniScript.Parser(content, { lexer });
			const ast = parser.parseChunk();
			
			this.executor.execute(ast);
			const executionTime = Date.now() - startTime;
			
			return { success: true, output: this.io.getOutput(), executionTime };
		} catch (error: any) {
			const executionTime = Date.now() - startTime;
			return { success: false, output: this.io.getOutput(), error: error.message, executionTime };
		}
	}
}
