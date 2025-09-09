import { MiniScriptExecutor, ExecutionState } from "./executor.js";
import { TestIO } from "./io-interface.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface PauseTestResult {
	success: boolean;
	output: string[];
	error?: string;
	executionTime: number;
	state?: ExecutionState;
	paused: boolean;
}

export class PauseTestRunner {
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

	async runPauseTest(filePath: string): Promise<PauseTestResult> {
		await this.initializeMiniScript();
		
		const startTime = Date.now();
		
		// Clear previous output
		this.io.clear();

		try {
			const content = readFileSync(filePath, 'utf-8');
			const lexer = new this.MiniScript.Lexer(content);
			const parser = new this.MiniScript.Parser(content, { lexer });
			const ast = parser.parseChunk();
			this.executor.execute(ast, content);
			const executionTime = Date.now() - startTime;
			const paused = this.executor['executionPaused'];
			const state = paused ? this.executor.serializeState() : undefined;
			return { success: true, output: this.io.getOutput(), executionTime, state, paused };
		} catch (error: any) {
			const executionTime = Date.now() - startTime;
			return { success: false, output: this.io.getOutput(), error: error.message, executionTime, paused: false };
		}
	}

	async resumeExecution(state: ExecutionState, filePath: string): Promise<PauseTestResult> {
		await this.initializeMiniScript();
		
		const startTime = Date.now();
		
		// Create a new IO interface for the resumed execution
		const resumeIO = new TestIO();

		try {
			const newExecutor = new MiniScriptExecutor(resumeIO);
			newExecutor.restoreState(state, this.MiniScript);
			newExecutor.resume();
			const executionTime = Date.now() - startTime;
			const paused = newExecutor['executionPaused'];
			const newState = paused ? newExecutor.serializeState() : undefined;
			return { success: true, output: resumeIO.getOutput(), executionTime, state: newState, paused };
		} catch (error: any) {
			const executionTime = Date.now() - startTime;
			return { success: false, output: resumeIO.getOutput(), error: error.message, executionTime, paused: false };
		}
	}
}
