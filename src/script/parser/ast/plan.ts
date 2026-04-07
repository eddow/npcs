import { type ASTBase, ASTBaseBlock, type ASTBaseBlockOptions, ASTType } from './base'
import type { ASTPlanChecking } from './checking'

export interface ASTPlanStatementOptions extends ASTBaseBlockOptions {
	expression: ASTBase
	checkings?: ASTPlanChecking[]
}

export class ASTPlanStatement extends ASTBaseBlock {
	expression: ASTBase
	checkings: ASTPlanChecking[]

	constructor(options: ASTPlanStatementOptions) {
		super(ASTType.PlanStatement, options)
		this.expression = options.expression
		this.checkings = options.checkings || []
	}

	toString(): string {
		const checkings = this.checkings
			.map((item) => `${item}`)
			.join('\n')
			.split('\n')
			.map((item) => `\t${item}`)
			.join('\n')
		if (this.body.length === 0) {
			const checks = checkings.length > 0 ? `\n${checkings}` : ''
			return `${this.type}[${this.start}-${this.end}][plan ${this.expression}${checks}]`
		}

		const body = this.body
			.map((item) => `${item}`)
			.join('\n')
			.split('\n')
			.map((item) => `\t${item}`)
			.join('\n')

		const sections = [`plan ${this.expression}`]
		if (checkings.length > 0) sections.push(checkings)
		sections.push(body)
		return `${this.type}[${this.start}-${this.end}][${sections.join('\n')}\n]`
	}

	clone(): ASTPlanStatement {
		return new ASTPlanStatement({
			expression: this.expression.clone(),
			checkings: this.checkings.map((it) => it.clone()),
			body: this.body.map((it) => it.clone()),
			start: this.start,
			end: this.end,
			range: this.range,
			scope: this.scope,
		})
	}
}
