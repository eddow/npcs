import {
	type ASTBase,
	ASTBaseBlockPlanScope,
	type ASTBaseBlockPlanScopeOptions,
	type ASTComment,
	ASTType,
} from './base'
import type { ASTLiteral } from './literal'

export interface ASTChunkOptions extends ASTBaseBlockPlanScopeOptions {
	literals?: ASTLiteral[]
	comments?: ASTComment[]
	scopes?: ASTBaseBlockPlanScope[]
	lines?: Record<number, ASTBase[]>
}

export class ASTChunk extends ASTBaseBlockPlanScope {
	literals: ASTLiteral[]
	comments: ASTComment[]
	scopes: ASTBaseBlockPlanScope[]
	lines: Record<number, ASTBase[]>

	constructor(options: ASTChunkOptions) {
		super(ASTType.Chunk, options)
		this.literals = options.literals || []
		this.comments = options.comments || []
		this.scopes = options.scopes || []
		this.lines = options.lines || {}
	}

	toString(): string {
		if (this.body.length === 0) {
			return `Chunk[${this.start}-${this.end}][]`
		}

		const body = this.body
			.map((item) => `${item}`)
			.join('\n')
			.split('\n')
			.map((item) => `\t${item}`)
			.join('\n')

		return `Chunk[${this.start}-${this.end}][\n${body}\n]`
	}

	clone(): ASTChunk {
		return new ASTChunk({
			literals: this.literals.map((it) => it.clone()),
			comments: this.comments.map((it) => it.clone()),
			scopes: this.scopes.map((it) => it.clone()),
			lines: this.lines,
			start: this.start,
			end: this.end,
			range: this.range,
			scope: this.scope,
		})
	}
}
