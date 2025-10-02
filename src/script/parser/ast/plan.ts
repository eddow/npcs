import { type ASTBase, ASTBaseBlock, type ASTBaseBlockOptions, ASTType } from './base'

export interface ASTPlanStatementOptions extends ASTBaseBlockOptions {
	expression: ASTBase
}

export class ASTPlanStatement extends ASTBaseBlock {
	expression: ASTBase

	constructor(options: ASTPlanStatementOptions) {
		super(ASTType.PlanStatement, options)
		this.expression = options.expression
	}

	toString(): string {
		if (this.body.length === 0) {
			return `${this.type}[${this.start}-${this.end}][plan ${this.expression}]`
		}

		const body = this.body
			.map((item) => `${item}`)
			.join('\n')
			.split('\n')
			.map((item) => `\t${item}`)
			.join('\n')

		return `${this.type}[${this.start}-${this.end}][plan ${this.expression}\n${body}\n]`
	}

	clone(): ASTPlanStatement {
		return new ASTPlanStatement({
			expression: this.expression.clone(),
			body: this.body.map((it) => it.clone()),
			start: this.start,
			end: this.end,
			range: this.range,
			scope: this.scope,
		})
	}
}
