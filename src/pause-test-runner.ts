import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const MiniScript = require('miniscript-core');
import { MiniScriptExecutor, ExecutionState } from "./executor";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

	constructor() {
		this.executor = new MiniScriptExecutor();
	}

	async runPauseTest(filePath: string): Promise<PauseTestResult> {
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
			this.executor.execute(ast, content);

			const executionTime = Date.now() - startTime;
			const paused = this.executor['executionPaused'];
			const state = paused ? this.executor.serializeState() : undefined;
			
			return {
				success: true,
				output,
				executionTime,
				state,
				paused
			};
		} catch (error) {
			const executionTime = Date.now() - startTime;
			
			return {
				success: false,
				output,
				error: error instanceof Error ? error.message : String(error),
				executionTime,
				paused: false
			};
		} finally {
			// Restore original console.log
			console.log = originalLog;
		}
	}

	async runPauseFixture(fixtureName: string): Promise<PauseTestResult> {
		const filePath = join(__dirname, '..', 'tests', 'fixtures', `${fixtureName}.mns`);
		return this.runPauseTest(filePath);
	}

	// Resume execution from a paused state
	async resumeExecution(state: ExecutionState, filePath: string): Promise<PauseTestResult> {
		const startTime = Date.now();
		const output: string[] = [];
		
		// Capture console.log output
		const originalLog = console.log;
		console.log = (...args: any[]) => {
			output.push(args.join(" "));
		};

		try {
			// Create a new executor and restore state
			const newExecutor = new MiniScriptExecutor();
			newExecutor.restoreState(state, MiniScript);
			
			// Resume execution
			newExecutor.resume();

			const executionTime = Date.now() - startTime;
			const paused = newExecutor['executionPaused'];
			const newState = paused ? newExecutor.serializeState() : undefined;
			
			return {
				success: true,
				output,
				executionTime,
				state: newState,
				paused
			};
		} catch (error) {
			const executionTime = Date.now() - startTime;
			
			return {
				success: false,
				output,
				error: error instanceof Error ? error.message : String(error),
				executionTime,
				paused: false
			};
		} finally {
			// Restore original console.log
			console.log = originalLog;
		}
	}

	// Run a complete pause/resume cycle
	async runPauseResumeCycle(fixtureName: string): Promise<{
		pauseResult: PauseTestResult;
		resumeResult: PauseTestResult;
		complete: boolean;
	}> {
		// First, run until pause
		const pauseResult = await this.runPauseFixture(fixtureName);
		
		if (!pauseResult.success || !pauseResult.paused || !pauseResult.state) {
			return {
				pauseResult,
				resumeResult: { success: false, output: [], executionTime: 0, paused: false },
				complete: false
			};
		}

		// Then resume execution
		const filePath = join(__dirname, '..', 'tests', 'fixtures', `${fixtureName}.mns`);
		const resumeResult = await this.resumeExecution(pauseResult.state, filePath);
		
		return {
			pauseResult,
			resumeResult,
			complete: !resumeResult.paused
		};
	}
}
