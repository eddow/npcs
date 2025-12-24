import { MiniScriptExecutor } from './executor'
import {
	type ExecutionContext,
	type ExecutionState,
	type FunctionDefinition,
	type IsaTypes,
	jsIsaTypes,
	jsOperators,
	type Operators,
} from './helpers'
import {
	type ASTBase,
	type ASTBaseBlock,
	type ASTFunctionStatement,
	ASTProviderWithCallback,
	type LexerException,
	Parser,
	type ParserException,
} from './script'
export type NpcReturn =
	| { type: 'return'; value?: any }
	| { type: 'yield'; value: any; state: ExecutionState }

export function lexerExceptionLocation(
	error: LexerException | ParserException,
	source: string,
): string {
	const lines = source.split('\n')
	const startLineIdx = Math.max(0, error.range.start.line - 1)
	const endLineIdx = Math.max(0, error.range.end.line - 1)
	const startCol = Math.max(1, error.range.start.character)
	const endCol = Math.max(1, error.range.end.character)

	const beginCaret = `${' '.repeat(startCol - 1)}^`
	const endCaret = `${' '.repeat(endCol - 1)}^`

	const selected = lines.slice(startLineIdx, endLineIdx + 1).join('\n')
	return `${beginCaret}\n${selected}\n${endCaret}`
}
export default class NpcScript {
	public ast: any
	public functions: ASTFunctionStatement[] = []
	public functionIndexes = new Map<ASTFunctionStatement, number>()
	public fileName: string = ''

	public sourceLocation(expr: ASTBase): string {
		const source = this.source

		// Fallback: single point location using expr.start
		if (!expr.start) return ''
		const coords = `${this.fileName}:${expr.start.line}:${expr.start.character}`
		if (!source) return coords
		const lines = source.split('\n')
		const lineIdx = expr.start.line - 1
		const colIdx = Math.max(1, expr.start.character)
		const lineText = lines[lineIdx] ?? ''

		const caretIndent = lineText.substring(0, colIdx - 1).replace(/[^\t]/g, ' ')
		const caretLine = `${caretIndent}^`
		return `${coords}\n${lineText}\n${caretLine}`
	}
	constructor(
		public source: string,
		public operators: Operators = jsOperators,
		public isaTypes: IsaTypes = jsIsaTypes,
	) {
		try {
			this.ast = new Parser(source, {
				astProvider: new ASTProviderWithCallback((func) => {
					this.functionIndexes.set(func, this.functions.length)
					this.functions.push(func)
				}),
			}).parseChunk()
		} catch (error) {
			/*if (error instanceof LexerException || error instanceof ParserException)
				console.error(lexerExceptionLocation(error, source))*/
			throw error
		}
	}
	function(index?: number): ASTBaseBlock {
		return index === undefined ? this.ast : this.functions[index]
	}

	executor(context: ExecutionContext, state?: ExecutionState) {
		return new MiniScriptExecutor(this, context, state)
	}
	execute(context: ExecutionContext, state?: ExecutionState): NpcReturn {
		const executor = this.executor(context, state)
		const { type, value } = executor.execute()
		switch (type) {
			case 'return':
				return { type: 'return', value: value }
			case 'yield':
				return { type: 'yield', value: value, state: executor.state }
			default:
				return { type: 'return' }
		}
	}

	cancel(context: ExecutionContext, state: ExecutionState, plan?: any): ExecutionState | undefined {
		return this.executor(context, state).cancel(plan)
	}

	evaluator<Args extends any[], Return>(
		fct: FunctionDefinition,
		context: ExecutionContext,
	): (...args: Args) => Return {
		const that = this
		return function (this: { push(arg: any): void } | undefined, ...args: Args) {
			const executor = that.executor(context, fct.call(args))
			while (true) {
				const { type, value } = executor.execute()
				if (type === 'return') return value as Return
				else if (type === 'yield') {
					if (!this) throw new Error('Cannot yield in a non-generator context')
					this.push(value)
				} else throw new Error(`Unknown executor result type: ${type}`)
			}
		}
	}
	/**
	 * To be overridden by the user to check if a value is a native function
	 * @param value
	 * @returns
	 */
	isNative(value: any): boolean {
		return typeof value === 'function'
	}
	/**
	 * To be overridden by the user to call a native function
	 * @param func
	 * @param args
	 * @param context
	 * @returns
	 */
	callNative(func: any, args: any[], context: ExecutionContext): any {
		return func.apply(context, args)
	}
}
