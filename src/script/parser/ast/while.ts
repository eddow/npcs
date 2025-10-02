import { type ASTBase, ASTBaseBlock, type ASTBaseBlockOptions, ASTType } from './base'

// WHILE clause with condition and block - now extends ASTBaseBlock
export interface ASTWhileClauseOptions extends ASTBaseBlockOptions {
	condition: ASTBase
}

export class ASTWhileClause extends ASTBaseBlock {
	condition: ASTBase

	constructor(options: ASTWhileClauseOptions) {
		super(ASTType.WhileClause, options)
		this.condition = options.condition
	}

	toString(): string {
		const conditionStr = this.condition.toString()

		if (this.body.length === 0) {
			return `WhileClause[${this.start}-${this.end}][${conditionStr}]`
		}

		const body = this.body
			.map((item) => `${item}`)
			.join('\n')
			.split('\n')
			.map((item) => `\t${item}`)
			.join('\n')

		return `WhileClause[${this.start}-${this.end}][${conditionStr}\n${body}\n]`
	}

	clone(): ASTWhileClause {
		return new ASTWhileClause({
			condition: this.condition.clone(),
			start: this.start,
			end: this.end,
			range: this.range,
			scope: this.scope,
		})
	}
}

// New DO-WHILE-LOOP structure - does NOT extend ASTBaseBlock
export interface ASTDoWhileLoopOptions {
	mainBlock: ASTBaseBlock
	whileClauses: ASTWhileClause[]
	start: any
	end?: any
	range: [number, number]
	scope?: any
}

export class ASTDoWhileLoop {
	mainBlock: ASTBaseBlock
	whileClauses: ASTWhileClause[]
	start: any
	end?: any
	range: [number, number]
	scope?: any
	type: string = 'DoWhileLoop'

	constructor(options: ASTDoWhileLoopOptions) {
		this.mainBlock = options.mainBlock
		this.whileClauses = options.whileClauses || []
		this.start = options.start
		this.end = options.end
		this.range = options.range
		this.scope = options.scope
	}

	toString(): string {
		let result = `DoWhileLoop[${this.start}-${this.end}]`

		// Add main block
		result += `[\n${this.mainBlock.toString()}\n`

		// Add while clauses
		if (this.whileClauses.length > 0) {
			for (const clause of this.whileClauses) {
				result += `\n${clause.toString()}`
			}
		}

		result += ']'
		return result
	}

	clone(): ASTDoWhileLoop {
		return new ASTDoWhileLoop({
			mainBlock: this.mainBlock.clone(),
			whileClauses: this.whileClauses.map((clause) => clause.clone()),
			start: this.start,
			end: this.end,
			range: this.range,
			scope: this.scope,
		})
	}
}
