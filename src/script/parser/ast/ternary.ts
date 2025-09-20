import { ASTBase, type ASTBaseOptions, ASTType } from './base'

export interface ASTTernaryExpressionOptions extends ASTBaseOptions {
	condition: ASTBase
	trueValue: ASTBase
	falseValue: ASTBase
}

export class ASTTernaryExpression extends ASTBase {
	condition: ASTBase
	trueValue: ASTBase
	falseValue: ASTBase

	constructor(options: ASTTernaryExpressionOptions) {
		super(ASTType.TernaryExpression, options)
		this.condition = options.condition
		this.trueValue = options.trueValue
		this.falseValue = options.falseValue
	}

	toString(): string {
		return `${this.type}[${this.start}-${this.end}][${this.trueValue} if ${this.condition} else ${this.falseValue}]`
	}

	clone(): ASTTernaryExpression {
		return new ASTTernaryExpression({
			condition: this.condition.clone(),
			trueValue: this.trueValue.clone(),
			falseValue: this.falseValue.clone(),
			start: this.start,
			end: this.end,
			range: this.range,
			scope: this.scope,
		})
	}
}
