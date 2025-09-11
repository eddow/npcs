import {
	type ASTFunctionStatement,
	type ASTFunctionStatementOptions,
	ASTProvider,
	Lexer,
	Parser,
} from 'miniscript-core'

/**
 * Custom ASTProvider that calls a callback whenever an ASTFunctionStatement is created
 */
export class ASTProviderWithCallback extends ASTProvider {
	private onFunctionStatement?: (func: ASTFunctionStatement) => void

	constructor(onFunctionStatement?: (func: ASTFunctionStatement) => void) {
		super()
		this.onFunctionStatement = onFunctionStatement
	}

	/**
	 * Override the functionStatement method to call our callback
	 */
	functionStatement(options: ASTFunctionStatementOptions): ASTFunctionStatement {
		const func = super.functionStatement(options)

		// Call the callback if provided
		if (this.onFunctionStatement) {
			this.onFunctionStatement(func)
		}

		return func
	}
}

/**
 * Helper function to create a parser with function statement callback
 */
export function createParserWithCallback(
	content: string,
	onFunctionStatement?: (func: ASTFunctionStatement) => void,
	options?: any,
) {
	const customProvider = new ASTProviderWithCallback(onFunctionStatement)

	return new Parser(content, {
		...options,
		astProvider: customProvider,
		lexer: options?.lexer || new Lexer(content),
	})
}
