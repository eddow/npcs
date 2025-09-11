import {
	type ASTBase,
	type ASTBaseBlock,
	type ASTFunctionStatement,
	Lexer,
	Parser,
} from 'miniscript-core'
import { ASTProviderWithCallback } from './ast-provider-with-callback'
import { MiniScriptExecutor } from './executor'
import { IsaTypes, jsIsaTypes, jsOperators, type ExecutionContext, type Operators } from './helpers'
export type NpcReturn =
	| { type: 'return'; value?: any }
	| { type: 'yield'; value: any; state: string }
export default class NpcS {
	public ast: any
	public source: string
	public functions: ASTFunctionStatement[] = []
	public indexes = new Map<ASTFunctionStatement, number>()

	public sourceLocation(expr: ASTBase): string {
		const source = this.source
		if (!expr.start) return ''
		if (!source) return `${expr.start.line}:${expr.start.character}`
		const lines = source.split('\n')
		const lineIdx = expr.start.line - 1
		const colIdx = Math.max(1, expr.start.character)
		const lineText = lines[lineIdx] ?? ''
		// Build a caret line positioning a ^ under the designated character
		const caretIndent = ' '.repeat(colIdx - 1)
		const caretLine = `${caretIndent}^`
		return `${expr.start.line}:${expr.start.character}\n${lineText}\n${caretLine}`
	}
	constructor(
		public script: string,
		public context: ExecutionContext,
		public operators: Operators = jsOperators,
		public isaTypes: IsaTypes = jsIsaTypes,
	) {
		this.ast = new Parser(script, {
			lexer: new Lexer(script),
			astProvider: new ASTProviderWithCallback((func) => {
				this.indexes.set(func, this.functions.length)
				this.functions.push(func)
			}),
		}).parseChunk()
		this.source = script
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
}
