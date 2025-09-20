import { TokenType } from '../lexer/token'
import {
	ASTBreakStatement,
	type ASTBreakStatementOptions,
	ASTContinueStatement,
	type ASTContinueStatementOptions,
} from './ast'
import { ASTAssignmentStatement, type ASTAssignmentStatementOptions } from './ast/assignment'
import {
	ASTBase,
	type ASTBaseBlockOptions,
	type ASTBaseOptions,
	ASTComment,
	type ASTCommentOptions,
	ASTType,
} from './ast/base'
import { ASTBinaryExpression, type ASTBinaryExpressionOptions } from './ast/binary'
import {
	ASTCallExpression,
	type ASTCallExpressionOptions,
	ASTCallStatement,
	type ASTCallStatementOptions,
} from './ast/call'
import { ASTChunk, type ASTChunkOptions } from './ast/chunk'
import {
	ASTComparisonGroupExpression,
	type ASTComparisonGroupExpressionOptions,
} from './ast/comparison-group'
import { ASTForGenericStatement, type ASTForGenericStatementOptions } from './ast/for'
import { ASTFunctionStatement, type ASTFunctionStatementOptions } from './ast/function'
import {
	ASTIdentifier,
	type ASTIdentifierOptions,
	ASTIndexExpression,
	type ASTIndexExpressionOptions,
	ASTMemberExpression,
	type ASTMemberExpressionOptions,
} from './ast/identifier'
import {
	ASTElseClause,
	ASTIfClause,
	type ASTIfClauseOptions,
	ASTIfStatement,
	type ASTIfStatementOptions,
} from './ast/if'
import { ASTIsaExpression, type ASTIsaExpressionOptions } from './ast/isa'
import {
	ASTListConstructorExpression,
	type ASTListConstructorExpressionOptions,
	ASTListValue,
	type ASTListValueOptions,
} from './ast/list'
import {
	ASTBooleanLiteral,
	type ASTLiteralOptions,
	ASTNilLiteral,
	ASTNumericLiteral,
	ASTStringLiteral,
} from './ast/literal'
import { ASTLogicalExpression, type ASTLogicalExpressionOptions } from './ast/logical'
import {
	ASTMapConstructorExpression,
	type ASTMapConstructorExpressionOptions,
	ASTMapKeyString,
	type ASTMapKeyStringOptions,
} from './ast/map'
import { ASTParenthesisExpression, type ASTParenthesisExpressionOptions } from './ast/parenthesis'
import { ASTReturnStatement, type ASTReturnStatementOptions } from './ast/return'
import { ASTSliceExpression, type ASTSliceExpressionOptions } from './ast/slice'
import { ASTTernaryExpression, type ASTTernaryExpressionOptions } from './ast/ternary'
import { ASTUnaryExpression, type ASTUnaryExpressionOptions } from './ast/unary'
import { ASTDoWhileLoop, type ASTDoWhileLoopOptions, ASTWhileClause, type ASTWhileClauseOptions } from './ast/while'

export class ASTProvider {
	returnStatement(options: ASTReturnStatementOptions): ASTReturnStatement {
		return new ASTReturnStatement(options)
	}

	ifShortcutStatement(options: ASTIfStatementOptions): ASTIfStatement {
		return new ASTIfStatement(ASTType.IfShortcutStatement, options)
	}

	ifShortcutClause(options: ASTIfClauseOptions): ASTIfClause {
		return new ASTIfClause(ASTType.IfShortcutClause, options)
	}

	elseifShortcutClause(options: ASTIfClauseOptions): ASTIfClause {
		return new ASTIfClause(ASTType.ElseifShortcutClause, options)
	}

	elseShortcutClause(options: ASTBaseBlockOptions): ASTElseClause {
		return new ASTElseClause(ASTType.ElseShortcutClause, options)
	}

	ifStatement(options: ASTIfStatementOptions): ASTIfStatement {
		return new ASTIfStatement(ASTType.IfStatement, options)
	}

	ifClause(options: ASTIfClauseOptions): ASTIfClause {
		return new ASTIfClause(ASTType.IfClause, options)
	}

	elseifClause(options: ASTIfClauseOptions): ASTIfClause {
		return new ASTIfClause(ASTType.ElseifClause, options)
	}

	elseClause(options: ASTBaseBlockOptions): ASTElseClause {
		return new ASTElseClause(ASTType.ElseClause, options)
	}


	doWhileLoop(options: ASTDoWhileLoopOptions): ASTDoWhileLoop {
		return new ASTDoWhileLoop(options)
	}

	whileClause(options: ASTWhileClauseOptions): ASTWhileClause {
		return new ASTWhileClause(options)
	}

	assignmentStatement(options: ASTAssignmentStatementOptions): ASTAssignmentStatement {
		return new ASTAssignmentStatement(options)
	}

	callStatement(options: ASTCallStatementOptions): ASTCallStatement {
		return new ASTCallStatement(options)
	}

	functionStatement(options: ASTFunctionStatementOptions): ASTFunctionStatement {
		return new ASTFunctionStatement(options)
	}

	forGenericStatement(options: ASTForGenericStatementOptions): ASTForGenericStatement {
		return new ASTForGenericStatement(options)
	}

	chunk(options: ASTChunkOptions): ASTChunk {
		return new ASTChunk(options)
	}

	identifier(options: ASTIdentifierOptions): ASTIdentifier {
		return new ASTIdentifier(options)
	}

	literal(
		type:
			| TokenType.StringLiteral
			| TokenType.NumericLiteral
			| TokenType.BooleanLiteral
			| TokenType.NilLiteral,
		options: ASTLiteralOptions<any>,
	): ASTStringLiteral | ASTNilLiteral | ASTNumericLiteral | ASTBooleanLiteral {
		switch (type) {
			case TokenType.StringLiteral:
				return new ASTStringLiteral(options)
			case TokenType.NumericLiteral:
				return new ASTNumericLiteral(options)
			case TokenType.BooleanLiteral:
				return new ASTBooleanLiteral(options)
			case TokenType.NilLiteral:
				return new ASTNilLiteral(options)
		}
	}

	memberExpression(options: ASTMemberExpressionOptions): ASTMemberExpression {
		return new ASTMemberExpression(options)
	}

	callExpression(options: ASTCallExpressionOptions): ASTCallExpression {
		return new ASTCallExpression(options)
	}

	comment(options: ASTCommentOptions): ASTComment {
		return new ASTComment(options)
	}

	unaryExpression(options: ASTUnaryExpressionOptions): ASTUnaryExpression {
		return new ASTUnaryExpression(options)
	}

	mapKeyString(options: ASTMapKeyStringOptions): ASTMapKeyString {
		return new ASTMapKeyString(options)
	}

	mapConstructorExpression(
		options: ASTMapConstructorExpressionOptions,
	): ASTMapConstructorExpression {
		return new ASTMapConstructorExpression(options)
	}

	listValue(options: ASTListValueOptions): ASTListValue {
		return new ASTListValue(options)
	}

	listConstructorExpression(
		options: ASTListConstructorExpressionOptions,
	): ASTListConstructorExpression {
		return new ASTListConstructorExpression(options)
	}

	unknown(options: ASTBaseOptions): ASTBase {
		return new ASTBase(ASTType.Unknown, options)
	}

	emptyExpression(options: ASTBaseOptions): ASTBase {
		return new ASTBase(ASTType.EmptyExpression, options)
	}

	invalidCodeExpression(options: ASTBaseOptions): ASTBase {
		return new ASTBase(ASTType.InvalidCodeExpression, options)
	}

	indexExpression(options: ASTIndexExpressionOptions): ASTIndexExpression {
		return new ASTIndexExpression(options)
	}

	logicalExpression(options: ASTLogicalExpressionOptions): ASTLogicalExpression {
		return new ASTLogicalExpression(options)
	}

	isaExpression(options: ASTIsaExpressionOptions): ASTLogicalExpression {
		return new ASTIsaExpression(options)
	}

	binaryExpression(options: ASTBinaryExpressionOptions): ASTBinaryExpression {
		return new ASTBinaryExpression(options)
	}

	sliceExpression(options: ASTSliceExpressionOptions): ASTSliceExpression {
		return new ASTSliceExpression(options)
	}

	ternaryExpression(options: ASTTernaryExpressionOptions): ASTTernaryExpression {
		return new ASTTernaryExpression(options)
	}

	parenthesisExpression(options: ASTParenthesisExpressionOptions): ASTParenthesisExpression {
		return new ASTParenthesisExpression(options)
	}

	comparisonGroupExpression(options: ASTComparisonGroupExpressionOptions) {
		return new ASTComparisonGroupExpression(options)
	}

	breakStatement(options: ASTBreakStatementOptions) {
		return new ASTBreakStatement(options)
	}

	continueStatement(options: ASTContinueStatementOptions) {
		return new ASTContinueStatement(options)
	}
}

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

export {
	ASTAssignmentStatement,
	type ASTAssignmentStatementOptions,
} from './ast/assignment'
export {
	ASTBase,
	ASTBaseBlock,
	type ASTBaseBlockOptions,
	ASTBaseBlockWithScope,
	type ASTBaseBlockWithScopeOptions,
	type ASTBaseOptions,
	ASTComment,
	type ASTCommentOptions,
	type ASTScopeDefinition,
	type ASTScopeNamespace,
	ASTType,
} from './ast/base'
export { ASTBinaryExpression, type ASTBinaryExpressionOptions } from './ast/binary'
export { ASTBreakStatement, type ASTBreakStatementOptions } from './ast/break'
export {
	ASTCallExpression,
	type ASTCallExpressionOptions,
	ASTCallStatement,
	type ASTCallStatementOptions,
} from './ast/call'
export { ASTChunk, type ASTChunkOptions } from './ast/chunk'
export {
	ASTComparisonGroupExpression,
	type ASTComparisonGroupExpressionOptions,
} from './ast/comparison-group'
export {
	ASTContinueStatement,
	type ASTContinueStatementOptions,
} from './ast/continue'
export {
	ASTForGenericStatement,
	type ASTForGenericStatementOptions,
} from './ast/for'
export {
	ASTFunctionStatement,
	type ASTFunctionStatementOptions,
} from './ast/function'
export {
	ASTIdentifier,
	ASTIdentifierKind,
	type ASTIdentifierOptions,
	ASTIndexExpression,
	type ASTIndexExpressionOptions,
	ASTMemberExpression,
	type ASTMemberExpressionOptions,
} from './ast/identifier'
export {
	ASTClause,
	ASTElseClause,
	ASTIfClause,
	type ASTIfClauseOptions,
	ASTIfStatement,
	type ASTIfStatementOptions,
} from './ast/if'
export { ASTIsaExpression, type ASTIsaExpressionOptions } from './ast/isa'
export {
	ASTListConstructorExpression,
	type ASTListConstructorExpressionOptions,
	ASTListValue,
	type ASTListValueOptions,
} from './ast/list'
export {
	ASTBooleanLiteral,
	ASTLiteral,
	type ASTLiteralOptions,
	ASTNilLiteral,
	ASTNumericLiteral,
	ASTStringLiteral,
} from './ast/literal'
export {
	ASTLogicalExpression,
	type ASTLogicalExpressionOptions,
} from './ast/logical'
export {
	ASTMapConstructorExpression,
	type ASTMapConstructorExpressionOptions,
	ASTMapKeyString,
	type ASTMapKeyStringOptions,
} from './ast/map'
export {
	ASTParenthesisExpression,
	type ASTParenthesisExpressionOptions,
} from './ast/parenthesis'
export { ASTReturnStatement, type ASTReturnStatementOptions } from './ast/return'
export { ASTSliceExpression, type ASTSliceExpressionOptions } from './ast/slice'
export { ASTTernaryExpression, type ASTTernaryExpressionOptions } from './ast/ternary'
export { ASTUnaryExpression, type ASTUnaryExpressionOptions } from './ast/unary'
export { ASTDoWhileLoop, type ASTDoWhileLoopOptions, ASTWhileClause, type ASTWhileClauseOptions } from './ast/while'
