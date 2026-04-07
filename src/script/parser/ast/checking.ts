import { ASTBase, type ASTBaseOptions, ASTType } from './base'

export interface ASTPlanCheckingOptions extends ASTBaseOptions {
	description?: ASTBase
	condition: ASTBase
}

export class ASTPlanChecking extends ASTBase {
	description?: ASTBase
	condition: ASTBase

	constructor(options: ASTPlanCheckingOptions) {
		super(ASTType.PlanChecking, options)
		this.description = options.description
		this.condition = options.condition
	}

	toString(): string {
		const description = this.description ? `${this.description}: ` : ''
		return `${this.type}[${this.start}-${this.end}][${description}${this.condition}]`
	}

	clone(): ASTPlanChecking {
		return new ASTPlanChecking({
			description: this.description?.clone(),
			condition: this.condition.clone(),
			start: this.start,
			end: this.end,
			range: this.range,
			scope: this.scope,
		})
	}
}
