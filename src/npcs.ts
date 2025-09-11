import {
	type ASTBase,
	type ASTBaseBlock,
	type ASTFunctionStatement,
	Lexer,
	LexerException,
	Parser,
} from 'miniscript-core'
import { ASTProviderWithCallback } from './ast-provider-with-callback'
import { MiniScriptExecutor } from './executor'
import { IsaTypes, jsIsaTypes, jsOperators, type ExecutionContext, type Operators } from './helpers'
export type NpcReturn =
	| { type: 'return'; value?: any }
	| { type: 'yield'; value: any; state: string }

export function lexerExceptionLocation(error: LexerException, source: string): string {
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
export default class NpcS {
	public ast: any
	public functions: ASTFunctionStatement[] = []
	public indexes = new Map<ASTFunctionStatement, number>()

	public sourceLocation(expr: ASTBase): string {
		const source = this.source

		// Fallback: single point location using expr.start
		if (!expr.start) return ''
		if (!source) return `${expr.start.line}:${expr.start.character}`
		const lines = source.split('\n')
		const lineIdx = expr.start.line - 1
		const colIdx = Math.max(1, expr.start.character)
		const lineText = lines[lineIdx] ?? ''
		const caretIndent = ' '.repeat(colIdx - 1)
		const caretLine = `${caretIndent}^`
		return `${expr.start.line}:${expr.start.character}\n${lineText}\n${caretLine}`
	}
	constructor(
		public source: string,
		public context: ExecutionContext,
		public operators: Operators = jsOperators,
		public isaTypes: IsaTypes = jsIsaTypes,
	) {
		try {
			this.ast = new Parser(source, {
				lexer: new Lexer(source),
				astProvider: new ASTProviderWithCallback((func) => {
					this.indexes.set(func, this.functions.length)
					this.functions.push(func)
				}),
			}).parseChunk()
		} catch(error) {
			if(!(error instanceof LexerException))
				throw error
			throw new LexerException(error.message+'\n'+lexerExceptionLocation(error, source), error.range)
		}
	}
	function(index?: number): ASTBaseBlock {
		return index === undefined ? this.ast : this.functions[index]
	}
	execute(state?: string): NpcReturn {
		const executor = new MiniScriptExecutor(this, this.context, state)
		const {type, value} = executor.execute()
		switch (type) {
			case 'return':
				return { type: 'return', value: value }
			case 'yield':
				return { type: 'yield', value: value, state: executor.state }
			default:
				return { type: 'return' }
		}
	}
	*[Symbol.iterator]() {

		const executor = new MiniScriptExecutor(this, this.context)
		while(true) {
			const {type, value} = executor.execute()
			if(type === 'return') return value
			else if(type === 'yield') yield value
			else throw new Error('Unknown executor result type: ' + type)
		}
	}
}
