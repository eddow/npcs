import Lexer from './lexer'
import { type Token, TokenType } from './lexer/token'
import {
	type ASTAssignmentStatement,
	type ASTBase,
	type ASTBaseBlockWithScope,
	ASTBooleanLiteral,
	type ASTChunk,
	type ASTClause,
	type ASTComment,
	type ASTForGenericStatement,
	type ASTFunctionStatement,
	type ASTIdentifier,
	ASTIdentifierKind,
	type ASTListValue,
	ASTLiteral,
	type ASTMapKeyString,
	ASTNumericLiteral,
	ASTProvider,
	type ASTReturnStatement,
	ASTType,
	type ASTWhileStatement,
} from './parser/ast'
import { LineRegistry } from './parser/line-registry'
import {
	isPendingChunk,
	isPendingFor,
	isPendingFunction,
	isPendingIf,
	isPendingWhile,
	type PendingBlock,
	PendingChunk,
	type PendingClauseType,
	PendingFor,
	PendingFunction,
	PendingIf,
	PendingWhile,
} from './parser/pending-block'
import Validator from './parser/validator'
import { ParserException } from './types/errors'
import { Keyword } from './types/keywords'
import { Operator } from './types/operators'
import type { Position as ASTPosition } from './types/position'
import { Range } from './types/range'
import {
	getSelectorsFromGroup,
	getSelectorValue,
	type Selector,
	type SelectorGroup,
	SelectorGroups,
	Selectors,
} from './types/selector'
import { Stack } from './utils/stack'


export default class Parser {
	// runtime
	token: Token | null
	previousToken: Token | null
	currentScope: ASTBaseBlockWithScope | null
	outerScopes: ASTBaseBlockWithScope[]
	currentAssignment: ASTAssignmentStatement | null
	iteratorStack: (ASTForGenericStatement | ASTWhileStatement)[]

	// helpers
	literals: ASTLiteral[]
	comments: ASTComment[]
	scopes: ASTBaseBlockWithScope[]
	backPatches: Stack<PendingBlock>
	statementErrors: Error[]
	lineRegistry: LineRegistry

	// settings
	content: string
	lexer: Lexer
	validator: Validator
	astProvider: ASTProvider
	unsafe: boolean
	errors: Error[]

	constructor(content: string, { validator = new Validator(), astProvider = new ASTProvider(), lexer, unsafe = false, tabWidth = 1 } = {}) {
		this.content = content
		this.backPatches = new Stack()
		this.statementErrors = []
		this.lexer = lexer || new Lexer(content, { unsafe, tabWidth })
		this.token = null
		this.previousToken = null
		this.lineRegistry = new LineRegistry()
		this.scopes = []
		this.currentScope = null
		this.currentAssignment = null
		this.outerScopes = []
		this.iteratorStack = []
		this.literals = []
		this.comments = []
		this.validator = validator
		this.astProvider = astProvider
		this.unsafe = unsafe
		this.errors = []
	}

	next() {
		this.previousToken = this.token
		this.token = this.lexer.next()
	}

	isType(type: TokenType): boolean {
		return this.token !== null && type === this.token.type
	}

	consume(selector: Selector): boolean {
		if (this.token && selector(this.token)) {
			this.next()
			return true
		}

		return false
	}

	consumeMany(selectorGroup: SelectorGroup): boolean {
		if (this.token && selectorGroup(this.token)) {
			this.next()
			return true
		}

		return false
	}

	requireType(type: TokenType, from?: ASTPosition): Token | null {
		const token = this.token

		if (!token || token.type !== type) {
			this.raise(
				`got ${token || 'undefined'} where ${type} is required`,
				new Range(from || token?.start, token?.end),
			)
			return null
		}

		this.next()
		return token
	}

	requireToken(selector: Selector, from?: ASTPosition): Token | null {
		const token = this.token

		if (!token || !selector(token)) {
			this.raise(
				`got ${token || 'undefined'} where "${getSelectorValue(selector)}" is required`,
				new Range(from || token?.start, token?.end),
			)
			return null
		}

		this.next()
		return token
	}

	requireTokenOfAny(selectorGroup: SelectorGroup, from?: ASTPosition): Token | null {
		const token = this.token

		if (token && selectorGroup(token)) {
			this.next()
			return token
		}

		this.raise(
			`got ${token || 'undefined'} where any of ${getSelectorsFromGroup(selectorGroup)
				.map((selector: Selector) => `"${getSelectorValue(selector)}"`)
				.join(', ')} is required`,
			new Range(from || token?.start, token?.end),
		)

		return undefined
	}

	skipNewlines(): number {
		let lines = 0
		while (true) {
			if (this.token && Selectors.Comment(this.token)) {
				const isStatement = this.previousToken?.line !== this.token.line
				const comment = this.astProvider.comment({
					value: this.token.value,
					start: this.token.start,
					end: this.token.end,
					range: this.token.range,
					scope: this.currentScope,
					isStatement,
				})

				this.comments.push(comment)
				this.lineRegistry.addItemToLines(comment)
			} else if (this.token && Selectors.EndOfLine(this.token)) {
				lines++
			} else {
				break
			}

			this.next()
		}

		return lines
	}

	pushScope(scope: ASTBaseBlockWithScope) {
		if (this.currentScope !== null) {
			this.scopes.push(scope)
			this.outerScopes.push(this.currentScope)
		}

		this.currentScope = scope
	}

	popScope() {
		this.currentScope = this.outerScopes.pop()
	}

	tryToRecover() {
		const firstPointOfFailure = this.statementErrors[0]

		this.errors.push(firstPointOfFailure)

		if (!this.unsafe) {
			throw firstPointOfFailure
		}

		this.lexer.recoverFromSnapshot()

		this.next()

		for (
			;
			this.token && this.token.type !== TokenType.EOL && this.token.type !== TokenType.EOF;
			this.next()
		);
	}

	finishRemainingScopes() {
		let last = this.backPatches.pop()

		while (!isPendingChunk(last)) {
			const exception = this.raise(
				`found open block ${last.block.type}`,
				new Range(last.block.start!, last.block.start!),
			)

			last.complete(this.previousToken!)

			this.errors.push(exception)

			if (!this.unsafe) {
				throw exception
			}

			last = this.backPatches.pop()
		}
	}

	parseChunk(): ASTChunk | ASTBase {
		this.next()

		const start = this.token!.start
		const chunk = this.astProvider.chunk({
			start,
			end: undefined,
			range: [this.token!.range[0], undefined],
		})
		const pending = new PendingChunk(chunk, this.lineRegistry)

		this.backPatches.setDefault(pending)
		this.pushScope(chunk)

		while (this.token && !Selectors.EndOfFile(this.token)) {
			this.skipNewlines()

			if (!this.token || Selectors.EndOfFile(this.token)) break

			this.lexer.recordSnapshot()
			this.statementErrors = []

			this.parseStatement()

			if (this.statementErrors.length > 0) {
				this.tryToRecover()
			}
		}

		this.finishRemainingScopes()
		this.popScope()
		pending.complete(this.token!)

		chunk.literals = this.literals
		chunk.comments = this.comments
		chunk.scopes = this.scopes
		chunk.lines = this.lineRegistry.lines

		return chunk
	}

	parseStatement(): void {
		if (this.token && TokenType.Keyword === this.token.type && Keyword.Not !== this.token.value) {
			this.parseKeyword()
			return
		}

		const pendingBlock = this.backPatches.peek()
		const item = this.parseAssignment()

		if (item.end !== null) this.lineRegistry.addItemToLines(item)
		pendingBlock.body.push(item)
	}

	parseContinueStatement() {
		const pendingBlock = this.backPatches.peek()

		if (this.iteratorStack.length === 0) {
			this.raise(
				`'continue' without open loop block`,
				new Range(this.previousToken.start, this.previousToken.end),
			)
		}

		const item = this.astProvider.continueStatement({
			iterator: this.iteratorStack[this.iteratorStack.length - 1],
			start: this.previousToken.start,
			end: this.previousToken.end,
			range: this.previousToken.range,
			scope: this.currentScope,
		})

		this.lineRegistry.addItemToLines(item)
		pendingBlock.body.push(item)
	}

	parseBreakStatement() {
		const pendingBlock = this.backPatches.peek()

		if (this.iteratorStack.length === 0) {
			this.raise(
				`'break' without open loop block`,
				new Range(this.previousToken.start, this.previousToken.end),
			)
		}

		const item = this.astProvider.breakStatement({
			iterator: this.iteratorStack[this.iteratorStack.length - 1],
			start: this.previousToken.start,
			end: this.previousToken.end,
			range: this.previousToken.range,
			scope: this.currentScope,
		})

		this.lineRegistry.addItemToLines(item)
		pendingBlock.body.push(item)
	}

	parseKeyword() {
		const value = this.token!.value

		switch (value) {
			case Keyword.Return: {
				const pendingBlock = this.backPatches.peek()
				this.next()
				const item = this.parseReturnStatement()
				if (item.end !== null) {
					this.lineRegistry.addItemToLines(item)
				}
				pendingBlock.body.push(item)
				return
			}
			case Keyword.If: {
				this.next()
				this.parseIfStatement()
				return
			}
			case Keyword.ElseIf: {
				this.next()
				this.nextIfClause(ASTType.ElseifClause)
				return
			}
			case Keyword.Else: {
				this.next()
				this.nextIfClause(ASTType.ElseClause)
				return
			}
			case Keyword.While: {
				this.next()
				this.parseWhileStatement()
				return
			}
			case Keyword.For: {
				this.next()
				this.parseForStatement()
				return
			}
			case Keyword.EndFunction: {
				this.next()
				this.finalizeFunction()
				return
			}
			case Keyword.EndFor: {
				this.next()
				this.finalizeForStatement()
				return
			}
			case Keyword.EndWhile: {
				this.next()
				this.finalizeWhileStatement()
				return
			}
			case Keyword.EndIf: {
				this.next()
				this.nextIfClause(null)
				return
			}
			case Keyword.Continue: {
				this.next()
				this.parseContinueStatement()
				return
			}
			case Keyword.Break: {
				this.next()
				this.parseBreakStatement()
				return
			}
		}

		this.raise(
			`unexpected keyword ${this.token} at start of line`,
			new Range(this.token.start, this.token.end),
		)
	}

	parseShortcutContinueStatement() {
		if (this.iteratorStack.length === 0) {
			this.raise(
				`'continue' without open loop block`,
				new Range(this.previousToken.start, this.previousToken.end),
			)
		}

		return this.astProvider.continueStatement({
			iterator: this.iteratorStack[this.iteratorStack.length - 1],
			start: this.previousToken.start,
			end: this.previousToken.end,
			range: this.previousToken.range,
			scope: this.currentScope,
		})
	}

	parseShortcutBreakStatement() {
		if (this.iteratorStack.length === 0) {
			this.raise(
				`'break' without open loop block`,
				new Range(this.previousToken.start, this.previousToken.end),
			)
		}

		return this.astProvider.breakStatement({
			iterator: this.iteratorStack[this.iteratorStack.length - 1],
			start: this.previousToken.start,
			end: this.previousToken.end,
			range: this.previousToken.range,
			scope: this.currentScope,
		})
	}

	parseShortcutStatement(): ASTBase {
		if (this.token && TokenType.Keyword === this.token.type && Keyword.Not !== this.token.value) {
			const value = this.token.value

			switch (value) {
				case Keyword.Return: {
					this.next()
					return this.parseReturnStatement()
				}
				case Keyword.Continue: {
					this.next()
					return this.parseShortcutContinueStatement()
				}
				case Keyword.Break: {
					this.next()
					return this.parseShortcutBreakStatement()
				}
				default: {
					this.raise(
						`unexpected keyword ${this.token} in shorthand statement`,
						new Range(this.token!.start, this.token!.end),
					)

					return this.parseInvalidCode()
				}
			}
		}

		return this.parseAssignment()
	}

	parseAssignment(): ASTBase {
		const scope = this.currentScope
		const startToken = this.token!
		const expr = this.parseExpr(null, true, true)

		if (this.token && SelectorGroups.AssignmentEndOfExpr(this.token)) {
			return expr
		}

		if (this.token && Selectors.Assign(this.token)) {
			this.next()

			const assignmentStatement = this.astProvider.assignmentStatement({
				variable: expr,
				init: null,
				start: startToken.start,
				range: [startToken.range[0], null],
				end: null,
				scope,
			})
			const previousAssignment = this.currentAssignment

			this.currentAssignment = assignmentStatement

			assignmentStatement.init = this.parseExpr(assignmentStatement)
			assignmentStatement.end = this.previousToken.end
			assignmentStatement.range[1] = this.previousToken.range[1]

			this.currentAssignment = previousAssignment

			scope.definitions.push(assignmentStatement)

			return assignmentStatement
		} else if (this.token && SelectorGroups.AssignmentShorthand(this.token)) {
			const op = this.token

			this.next()

			const assignmentStatement = this.astProvider.assignmentStatement({
				variable: expr,
				init: null,
				start: startToken.start,
				range: [startToken.range[0], null],
				end: null,
				scope,
			})
			const previousAssignment = this.currentAssignment

			this.currentAssignment = assignmentStatement

			const binaryExpressionTokenStart = this.token
			const operator = <Operator>op.value.charAt(0)
			const rightExpr = this.parseExpr(assignmentStatement)
			const right = this.astProvider.parenthesisExpression({
				start: rightExpr.start,
				end: rightExpr.end,
				range: rightExpr.range,
				expression: rightExpr,
			})

			assignmentStatement.init = this.astProvider.binaryExpression({
				operator,
				left: expr.clone(),
				right,
				start: binaryExpressionTokenStart.start,
				end: this.previousToken.end,
				range: [binaryExpressionTokenStart.range[0], this.previousToken.range[1]],
				scope,
			})
			assignmentStatement.end = this.previousToken.end
			assignmentStatement.range[1] = this.previousToken.range[1]

			this.currentAssignment = previousAssignment

			scope.definitions.push(assignmentStatement)

			return assignmentStatement
		}

		const expressions = []

		while (this.token && !Selectors.EndOfFile(this.token)) {
			const arg = this.parseExpr(null)
			expressions.push(arg)

			if (this.token && SelectorGroups.BlockEndOfLine(this.token)) break
			if (this.token && Selectors.Else(this.token)) break
			if (this.token && Selectors.ArgumentSeparator(this.token)) {
				this.next()
				this.skipNewlines()
				continue
			}

			const requiredToken = this.requireTokenOfAny(
				SelectorGroups.AssignmentCommandArgs,
				startToken.start,
			)

			if (Selectors.EndOfLine(requiredToken) || Selectors.EndOfFile(requiredToken)) break
		}

		if (expressions.length === 0) {
			return this.astProvider.callStatement({
				expression: expr,
				start: startToken.start,
				end: this.previousToken.end,
				range: [startToken.range[0], this.previousToken.range[1]],
				scope,
			})
		}

		return this.astProvider.callStatement({
			expression: this.astProvider.callExpression({
				base: expr,
				arguments: expressions,
				start: startToken.start,
				end: this.previousToken.end,
				range: [startToken.range[0], this.previousToken.range[1]],
				scope,
			}),
			start: startToken.start,
			end: this.previousToken.end,
			range: [startToken.range[0], this.previousToken.range[1]],
			scope,
		})
	}

	parseReturnStatement(): ASTReturnStatement {
		const scope = this.currentScope
		const startToken = this.previousToken
		let expression = null

		const returnStatement = this.astProvider.returnStatement({
			argument: null,
			start: startToken.start,
			end: null,
			range: [startToken.range[0], null],
			scope,
		})

		if (SelectorGroups.ReturnStatementEnd(this.token)) {
			returnStatement.end = this.previousToken.end
			returnStatement.range[1] = this.previousToken.range[1]
		} else {
			expression = this.parseExpr(returnStatement)

			returnStatement.end = this.previousToken.end
			returnStatement.range[1] = this.previousToken.range[1]
			returnStatement.argument = expression
		}

		scope.returns.push(returnStatement)

		return returnStatement
	}

	parseIfStatement(): void {
		const startToken = this.previousToken
		const ifCondition = this.parseExpr(null)

		this.lineRegistry.addItemToLines(ifCondition)
		this.requireToken(Selectors.Then, startToken.start)

		if (!SelectorGroups.BlockEndOfLine(this.token)) {
			this.parseIfShortcutStatement(ifCondition, startToken)
			return
		}

		const ifStatement = this.astProvider.ifStatement({
			clauses: [],
			start: startToken.start,
			end: null,
			range: [startToken.range[0], null],
			scope: this.currentScope,
		})

		const clause = this.astProvider.ifClause({
			condition: ifCondition,
			start: startToken.start,
			end: this.token.end,
			range: [startToken.range[0], this.token.range[1]],
			scope: this.currentScope,
		})

		const pendingBlock = new PendingIf(ifStatement, clause, this.lineRegistry)
		this.backPatches.push(pendingBlock)
	}

	nextIfClause(type: PendingClauseType | null) {
		const pendingBlock = this.backPatches.peek()

		if (!isPendingIf(pendingBlock)) {
			this.raise('no matching open if block', new Range(this.token.start, this.token.end))

			return
		}

		pendingBlock.next(this.previousToken)

		switch (type) {
			case ASTType.ElseifClause: {
				const ifStatementStartToken = this.token
				const ifCondition = this.parseExpr(null)

				this.requireToken(Selectors.Then, ifStatementStartToken.start)

				pendingBlock.currentClause = this.astProvider.elseifClause({
					condition: ifCondition,
					start: ifStatementStartToken.start,
					end: null,
					range: [ifStatementStartToken.range[0], null],
					scope: this.currentScope,
				})
				break
			}
			case ASTType.ElseClause: {
				const elseStatementStartToken = this.token

				pendingBlock.currentClause = this.astProvider.elseClause({
					start: elseStatementStartToken.start,
					end: null,
					range: [elseStatementStartToken.range[0], null],
					scope: this.currentScope,
				})
				break
			}
		}

		if (type === null) {
			pendingBlock.complete(this.previousToken)
			this.backPatches.pop()

			this.backPatches.peek().body.push(pendingBlock.block)
		}
	}

	parseIfShortcutStatement(condition: ASTBase, startToken: Token): void {
		const clauses: ASTClause[] = []
		const block = this.backPatches.peek()
		const ifStatement = this.astProvider.ifShortcutStatement({
			clauses,
			start: startToken.start,
			end: null,
			range: [startToken.range[0], null],
			scope: this.currentScope,
		})
		const item = this.parseShortcutStatement()

		clauses.push(
			this.astProvider.ifShortcutClause({
				condition,
				body: [item],
				start: startToken.start,
				end: this.token.end,
				range: [startToken.range[0], this.token.range[1]],
				scope: this.currentScope,
			}),
		)

		if (Selectors.Else(this.token)) {
			this.next()

			const elseItemStartToken = this.token
			const elseItem = this.parseShortcutStatement()

			clauses.push(
				this.astProvider.elseShortcutClause({
					body: [elseItem],
					start: elseItemStartToken.start,
					end: this.token.end,
					range: [elseItemStartToken.range[0], this.token.range[1]],
					scope: this.currentScope,
				}),
			)
		}

		ifStatement.end = this.token.end
		ifStatement.range[1] = this.token.range[1]

		this.lineRegistry.addItemToLines(ifStatement)
		block.body.push(ifStatement)
	}

	parseWhileStatement(): void {
		const startToken = this.previousToken
		const condition = this.parseExpr(null)

		if (!condition) {
			this.raise(`while requires a condition`, new Range(startToken.start, this.token.end))

			return
		}

		if (!SelectorGroups.BlockEndOfLine(this.token)) {
			return this.parseWhileShortcutStatement(condition, startToken)
		}

		const whileStatement = this.astProvider.whileStatement({
			condition,
			start: startToken.start,
			end: null,
			range: [startToken.range[0], null],
			scope: this.currentScope,
		})

		const pendingBlock = new PendingWhile(whileStatement, this.lineRegistry)
		this.backPatches.push(pendingBlock)
		this.iteratorStack.push(whileStatement)
	}

	finalizeWhileStatement() {
		const pendingBlock = this.backPatches.peek()

		if (!isPendingWhile(pendingBlock)) {
			this.raise('no matching open while block', new Range(this.token.start, this.token.end))

			return
		}

		pendingBlock.complete(this.previousToken)
		this.iteratorStack.pop()
		this.backPatches.pop()
		this.backPatches.peek().body.push(pendingBlock.block)
	}

	parseWhileShortcutStatement(condition: ASTBase, startToken: Token): void {
		const block = this.backPatches.peek()
		const item = this.parseShortcutStatement()

		const whileStatement = this.astProvider.whileStatement({
			condition,
			body: [item],
			start: startToken.start,
			end: this.previousToken.end,
			range: [startToken.range[0], this.previousToken.range[1]],
			scope: this.currentScope,
		})

		this.lineRegistry.addItemToLines(whileStatement)
		block.body.push(whileStatement)
	}

	parseForStatement(): void {
		const scope = this.currentScope
		const startToken = this.previousToken
		const variable = this.parseIdentifier(ASTIdentifierKind.ForInVariable) as ASTIdentifier

		this.requireToken(Selectors.In, startToken.start)

		const iterator = this.parseExpr(null)

		if (!iterator) {
			this.raise(
				`sequence expression expected for 'for' loop`,
				new Range(startToken.start, this.token.end),
			)

			return
		}

		if (!SelectorGroups.BlockEndOfLine(this.token)) {
			return this.parseForShortcutStatement(variable, iterator, startToken)
		}

		const forStatement = this.astProvider.forGenericStatement({
			variable,
			iterator,
			start: startToken.start,
			end: this.previousToken.end,
			range: [startToken.range[0], this.previousToken.range[1]],
			scope,
		})

		scope.definitions.push(forStatement)

		const pendingBlock = new PendingFor(forStatement, this.lineRegistry)
		this.backPatches.push(pendingBlock)
		this.iteratorStack.push(forStatement)
	}

	finalizeForStatement() {
		const pendingBlock = this.backPatches.peek()

		if (!isPendingFor(pendingBlock)) {
			this.raise('no matching open for block', new Range(this.token.start, this.token.end))

			return
		}

		pendingBlock.complete(this.previousToken)
		this.iteratorStack.pop()
		this.backPatches.pop()
		this.backPatches.peek().body.push(pendingBlock.block)
	}

	parseForShortcutStatement(variable: ASTIdentifier, iterator: ASTBase, startToken: Token): void {
		const scope = this.currentScope
		const block = this.backPatches.peek()
		const item = this.parseShortcutStatement()

		const forStatement = this.astProvider.forGenericStatement({
			variable,
			iterator,
			body: [item],
			start: startToken.start,
			end: this.previousToken.end,
			range: [startToken.range[0], this.previousToken.range[1]],
			scope: this.currentScope,
		})

		scope.definitions.push(forStatement)
		this.lineRegistry.addItemToLines(forStatement)
		block.body.push(forStatement)
	}

	parseExpr(base: ASTBase, asLval: boolean = false, statementStart: boolean = false): ASTBase {
		return this.parseFunctionDeclaration(base, asLval, statementStart)
	}

	parseFunctionDeclaration(
		base: ASTBase,
		asLval: boolean = false,
		statementStart: boolean = false,
	): ASTFunctionStatement | ASTBase {
		if (!Selectors.Function(this.token)) return this.parseOr(asLval, statementStart)

		this.next()

		const functionStartToken = this.previousToken
		const functionStatement = this.astProvider.functionStatement({
			start: functionStartToken.start,
			end: null,
			range: [functionStartToken.range[0], null],
			scope: this.currentScope,
			parent: this.outerScopes[this.outerScopes.length - 1],
			assignment: this.currentAssignment,
		})
		const parameters = []

		this.pushScope(functionStatement)

		if (!SelectorGroups.BlockEndOfLine(this.token)) {
			this.requireToken(Selectors.LParenthesis, functionStartToken.start)

			while (!SelectorGroups.FunctionDeclarationArgEnd(this.token)) {
				const parameter = this.parseIdentifier(ASTIdentifierKind.Argument)
				const parameterStartToken = parameter

				if (this.consume(Selectors.Assign)) {
					const defaultValue = this.parseExpr(null)

					if (defaultValue instanceof ASTLiteral) {
						const assign = this.astProvider.assignmentStatement({
							variable: parameter,
							init: defaultValue,
							start: parameterStartToken.start,
							end: this.previousToken.end,
							range: [parameterStartToken.range[0], this.previousToken.range[1]],
							scope: this.currentScope,
						})

						this.currentScope.definitions.push(assign)
						parameters.push(assign)
					} else {
						this.raise(
							`parameter default value must be a literal value`,
							new Range(parameterStartToken.start, this.token.end),
						)

						parameters.push(
							this.astProvider.invalidCodeExpression({
								start: parameterStartToken.start,
								end: this.previousToken.end,
								range: [parameterStartToken.range[0], this.previousToken.range[1]],
							}),
						)
					}
				} else {
					const assign = this.astProvider.assignmentStatement({
						variable: parameter,
						init: this.astProvider.unknown({
							start: parameterStartToken.start,
							end: this.previousToken.end,
							range: [parameterStartToken.range[0], this.previousToken.range[1]],
							scope: this.currentScope,
						}),
						start: parameterStartToken.start,
						end: this.previousToken.end,
						range: [parameterStartToken.range[0], this.previousToken.range[1]],
						scope: this.currentScope,
					})

					this.currentScope.definitions.push(assign)
					parameters.push(parameter)
				}

				if (Selectors.RParenthesis(this.token)) break
				this.requireToken(Selectors.ArgumentSeparator, functionStartToken.start)
				if (Selectors.RParenthesis(this.token)) {
					this.raise(
						'expected argument instead received right parenthesis',
						new Range(this.previousToken.end, this.previousToken.end),
					)
					break
				}
			}

			this.requireToken(Selectors.RParenthesis, functionStartToken.start)
		}

		functionStatement.parameters = parameters

		const pendingBlock = new PendingFunction(functionStatement, base, this.lineRegistry)
		this.backPatches.push(pendingBlock)

		return functionStatement
	}

	finalizeFunction() {
		const pendingBlock = this.backPatches.peek()

		if (!isPendingFunction(pendingBlock)) {
			this.raise('no matching open function block', new Range(this.token.start, this.token.end))

			return
		}

		this.popScope()

		pendingBlock.complete(this.previousToken)
		this.backPatches.pop()
	}

	parseOr(asLval: boolean = false, statementStart: boolean = false): ASTBase {
		const startToken = this.token
		const val = this.parseAnd(asLval, statementStart)
		let base = val

		while (Selectors.Or(this.token)) {
			this.next()
			this.skipNewlines()

			const opB = this.parseAnd()

			base = this.astProvider.logicalExpression({
				operator: Operator.Or,
				left: base,
				right: opB,
				start: startToken.start,
				end: this.previousToken.end,
				range: [startToken.range[0], this.previousToken.range[1]],
				scope: this.currentScope,
			})
		}

		return base
	}

	parseAnd(asLval: boolean = false, statementStart: boolean = false): ASTBase {
		const startToken = this.token
		const val = this.parseNot(asLval, statementStart)
		let base = val

		while (Selectors.And(this.token)) {
			this.next()
			this.skipNewlines()

			const opB = this.parseNot()

			base = this.astProvider.logicalExpression({
				operator: Operator.And,
				left: base,
				right: opB,
				start: startToken.start,
				end: this.previousToken.end,
				range: [startToken.range[0], this.previousToken.range[1]],
				scope: this.currentScope,
			})
		}

		return base
	}

	parseNot(asLval: boolean = false, statementStart: boolean = false): ASTBase {
		const startToken = this.token

		if (Selectors.Not(this.token)) {
			this.next()

			this.skipNewlines()

			const val = this.parseIsa()

			return this.astProvider.unaryExpression({
				operator: Operator.Not,
				argument: val,
				start: startToken.start,
				end: this.previousToken.end,
				range: [startToken.range[0], this.previousToken.range[1]],
				scope: this.currentScope,
			})
		}

		return this.parseIsa(asLval, statementStart)
	}

	parseIsa(asLval: boolean = false, statementStart: boolean = false): ASTBase {
		const startToken = this.token
		const val = this.parseComparisons(asLval, statementStart)

		if (Selectors.Isa(this.token)) {
			this.next()

			this.skipNewlines()

			const opB = this.parseComparisons()

			return this.astProvider.isaExpression({
				operator: Operator.Isa,
				left: val,
				right: opB,
				start: startToken.start,
				end: this.previousToken.end,
				range: [startToken.range[0], this.previousToken.range[1]],
				scope: this.currentScope,
			})
		}

		return val
	}

	parseComparisons(asLval: boolean = false, statementStart: boolean = false): ASTBase {
		const startToken = this.token
		const val = this.parseAddSub(asLval, statementStart)

		if (!SelectorGroups.ComparisonOperators(this.token)) return val

		const expressions: ASTBase[] = [val]
		const operators: string[] = []

		do {
			const token = this.token

			this.next()
			this.skipNewlines()

			const right = this.parseAddSub()

			operators.push(token.value)
			expressions.push(right)
		} while (SelectorGroups.ComparisonOperators(this.token))

		if (operators.length === 1) {
			return this.astProvider.binaryExpression({
				operator: operators[0],
				left: expressions[0],
				right: expressions[1],
				start: startToken.start,
				end: this.previousToken.end,
				range: [startToken.range[0], this.previousToken.range[1]],
				scope: this.currentScope,
			})
		}

		return this.astProvider.comparisonGroupExpression({
			operators,
			expressions,
			start: startToken.start,
			end: this.previousToken.end,
			range: [startToken.range[0], this.previousToken.range[1]],
			scope: this.currentScope,
		})
	}

	parseAddSub(asLval: boolean = false, statementStart: boolean = false): ASTBase {
		const startToken = this.token
		const val = this.parseMultDiv(asLval, statementStart)
		let base = val

		while (
			Selectors.Plus(this.token) ||
			(Selectors.Minus(this.token) &&
				(!statementStart || !this.token.afterSpace || this.lexer.isAtWhitespace()))
		) {
			const token = this.token

			this.next()
			this.skipNewlines()

			const opB = this.parseMultDiv()

			base = this.astProvider.binaryExpression({
				operator: <Operator>token.value,
				left: base,
				right: opB,
				start: startToken.start,
				end: this.previousToken.end,
				range: [startToken.range[0], this.previousToken.range[1]],
				scope: this.currentScope,
			})
		}

		return base
	}

	parseMultDiv(asLval: boolean = false, statementStart: boolean = false): ASTBase {
		const startToken = this.token
		const val = this.parseUnaryMinus(asLval, statementStart)
		let base = val

		while (SelectorGroups.MultiDivOperators(this.token)) {
			const token = this.token

			this.next()
			this.skipNewlines()

			const opB = this.parseUnaryMinus()

			base = this.astProvider.binaryExpression({
				operator: <Operator>token.value,
				left: base,
				right: opB,
				start: startToken.start,
				end: this.previousToken.end,
				range: [startToken.range[0], this.previousToken.range[1]],
				scope: this.currentScope,
			})
		}

		return base
	}

	parseUnaryMinus(asLval: boolean = false, statementStart: boolean = false): ASTBase {
		if (!Selectors.Minus(this.token)) {
			return this.parseNew(asLval, statementStart)
		}

		const startToken = this.token

		this.next()
		this.skipNewlines()

		const val = this.parseNew()

		if (val instanceof ASTNumericLiteral || val instanceof ASTBooleanLiteral) {
			val.negated = true
			return val
		}

		return this.astProvider.unaryExpression({
			operator: Operator.Minus,
			argument: val,
			start: startToken.start,
			end: this.previousToken.end,
			range: [startToken.range[0], this.previousToken.range[1]],
			scope: this.currentScope,
		})
	}

	parseNew(asLval: boolean = false, statementStart: boolean = false): ASTBase {
		if (!Selectors.New(this.token)) {
			return this.parseAddressOf(asLval, statementStart)
		}

		const startToken = this.token

		this.next()
		this.skipNewlines()

		const val = this.parseNew()

		return this.astProvider.unaryExpression({
			operator: Operator.New,
			argument: val,
			start: startToken.start,
			end: this.previousToken.end,
			range: [startToken.range[0], this.previousToken.range[1]],
			scope: this.currentScope,
		})
	}

	parseAddressOf(asLval: boolean = false, statementStart: boolean = false): ASTBase {
		if (!Selectors.Reference(this.token)) {
			return this.parsePower(asLval, statementStart)
		}

		const startToken = this.token

		this.next()
		this.skipNewlines()

		const val = this.parsePower(true, statementStart)

		return this.astProvider.unaryExpression({
			operator: Operator.Reference,
			argument: val,
			start: startToken.start,
			end: this.previousToken.end,
			range: [startToken.range[0], this.previousToken.range[1]],
			scope: this.currentScope,
		})
	}

	parsePower(asLval: boolean = false, statementStart: boolean = false): ASTBase {
		const startToken = this.token
		const val = this.parseCallExpr(asLval, statementStart)

		if (Selectors.Power(this.token)) {
			this.next()
			this.skipNewlines()

			const opB = this.parseCallExpr()

			return this.astProvider.binaryExpression({
				operator: Operator.Power,
				left: val,
				right: opB,
				start: startToken.start,
				end: this.previousToken.end,
				range: [startToken.range[0], this.previousToken.range[1]],
				scope: this.currentScope,
			})
		}

		return val
	}

	parseCallExpr(asLval: boolean = false, statementStart: boolean = false): ASTBase {
		const startToken = this.token
		let base = this.parseMap(asLval, statementStart)

		while (!Selectors.EndOfFile(this.token)) {
			if (Selectors.MemberSeparator(this.token)) {
				this.next()
				this.skipNewlines()

				const identifier = this.parseIdentifier(ASTIdentifierKind.Property)
				const memberExpr = this.astProvider.memberExpression({
					base,
					indexer: Operator.Member,
					identifier,
					start: startToken.start,
					end: this.previousToken.end,
					range: [startToken.range[0], this.previousToken.range[1]],
					scope: this.currentScope,
				})

				this.currentScope.namespaces.push(memberExpr)
				base = memberExpr
			} else if (Selectors.SLBracket(this.token) && !this.token.afterSpace) {
				this.next()
				this.skipNewlines()

				if (Selectors.SliceSeparator(this.token)) {
					const left = this.astProvider.emptyExpression({
						start: this.previousToken.start,
						end: this.previousToken.end,
						range: this.previousToken.range,
						scope: this.currentScope,
					})

					this.next()
					this.skipNewlines()

					const right = Selectors.SRBracket(this.token)
						? this.astProvider.emptyExpression({
								start: this.previousToken.start,
								end: this.previousToken.end,
								range: this.previousToken.range,
								scope: this.currentScope,
							})
						: this.parseExpr(null)

					base = this.astProvider.sliceExpression({
						base,
						left,
						right,
						start: startToken.start,
						end: this.token.end,
						range: [startToken.range[0], this.token.range[1]],
						scope: this.currentScope,
					})
				} else {
					const index = this.parseExpr(null)

					if (Selectors.SliceSeparator(this.token)) {
						this.next()
						this.skipNewlines()

						const right = Selectors.SRBracket(this.token)
							? this.astProvider.emptyExpression({
									start: this.previousToken.start,
									end: this.previousToken.end,
									range: this.previousToken.range,
									scope: this.currentScope,
								})
							: this.parseExpr(null)

						base = this.astProvider.sliceExpression({
							base,
							left: index,
							right,
							start: startToken.start,
							end: this.token.end,
							range: [startToken.range[0], this.token.range[1]],
							scope: this.currentScope,
						})
					} else {
						base = this.astProvider.indexExpression({
							base,
							index,
							isStatementStart: statementStart,
							start: startToken.start,
							end: this.token.end,
							range: [startToken.range[0], this.token.range[1]],
							scope: this.currentScope,
						})
					}
				}

				this.requireToken(Selectors.SRBracket, startToken.start)
			} else if (Selectors.LParenthesis(this.token) && (!asLval || !this.token.afterSpace)) {
				const expressions = this.parseCallArgs()

				base = this.astProvider.callExpression({
					base,
					arguments: expressions,
					start: startToken.start,
					end: this.previousToken.end,
					range: [startToken.range[0], this.previousToken.range[1]],
					scope: this.currentScope,
				})
			} else {
				break
			}
		}

		return base
	}

	parseCallArgs(): ASTBase[] {
		const expressions = []

		if (Selectors.LParenthesis(this.token)) {
			this.next()

			if (Selectors.RParenthesis(this.token)) {
				this.next()
			} else {
				while (!Selectors.EndOfFile(this.token)) {
					this.skipNewlines()
					const arg = this.parseExpr(null)
					expressions.push(arg)
					this.skipNewlines()
					if (Selectors.RParenthesis(this.requireTokenOfAny(SelectorGroups.CallArgsEnd, arg.start)))
						break
				}
			}
		}

		return expressions
	}

	parseMap(asLval: boolean = false, statementStart: boolean = false): ASTBase {
		if (!Selectors.CLBracket(this.token)) {
			return this.parseList(asLval, statementStart)
		}

		const scope = this.currentScope
		const startToken = this.token
		const fields: ASTMapKeyString[] = []
		const mapConstructorExpr = this.astProvider.mapConstructorExpression({
			fields,
			start: startToken.start,
			end: null,
			range: [startToken.range[0], null],
			scope,
		})

		this.next()

		if (Selectors.CRBracket(this.token)) {
			this.next()
		} else {
			this.skipNewlines()

			while (!Selectors.EndOfFile(this.token)) {
				if (Selectors.CRBracket(this.token)) {
					this.next()
					break
				}

				const keyValueItem = this.astProvider.mapKeyString({
					key: null,
					value: null,
					start: this.token.start,
					end: null,
					range: [this.token.range[0], null],
					scope,
				})
				keyValueItem.key = this.parseExpr(null)

				if (this.consume(Selectors.MapKeyValueSeparator)) {
					this.skipNewlines()
					keyValueItem.value = this.parseExpr(keyValueItem)
				} else {
					keyValueItem.value = keyValueItem.key
				}
				keyValueItem.end = this.previousToken.end
				keyValueItem.range[1] = this.previousToken.range[1]
				fields.push(keyValueItem)

				if (Selectors.MapSeparator(this.token)) {
					this.next()
					this.skipNewlines()
				}

				if (Selectors.CRBracket(this.token)) {
					this.next()
					break
				}
			}
		}

		mapConstructorExpr.end = this.token.start
		mapConstructorExpr.range[1] = this.token.range[1]

		return mapConstructorExpr
	}

	parseList(asLval: boolean = false, statementStart: boolean = false): ASTBase {
		if (!Selectors.SLBracket(this.token)) {
			return this.parseQuantity(asLval, statementStart)
		}

		const scope = this.currentScope
		const startToken = this.token
		const fields: ASTListValue[] = []
		const listConstructorExpr = this.astProvider.listConstructorExpression({
			fields,
			start: startToken.start,
			end: null,
			range: [startToken.range[0], null],
			scope,
		})

		this.next()

		if (Selectors.SRBracket(this.token)) {
			this.next()
		} else {
			this.skipNewlines()

			while (!Selectors.EndOfFile(this.token)) {
				if (Selectors.SRBracket(this.token)) {
					this.next()
					break
				}

				const listValue = this.astProvider.listValue({
					value: null,
					start: this.token.start,
					end: null,
					range: [this.token.range[0], null],
					scope,
				})

				listValue.value = this.parseExpr(listValue)
				listValue.end = this.previousToken.end
				listValue.range[1] = this.previousToken.range[1]
				fields.push(listValue)

				if (Selectors.MapSeparator(this.token)) {
					this.next()
					this.skipNewlines()
				}

				if (Selectors.SRBracket(this.token)) {
					this.next()
					break
				}
			}
		}

		listConstructorExpr.end = this.token.start
		listConstructorExpr.range[1] = this.token.range[1]

		return listConstructorExpr
	}

	parseQuantity(asLval: boolean = false, statementStart: boolean = false): ASTBase {
		if (!Selectors.LParenthesis(this.token)) {
			return this.parseAtom(asLval, statementStart)
		}

		const startToken = this.token

		this.next()
		this.skipNewlines()

		const val = this.parseExpr(null)

		this.requireToken(Selectors.RParenthesis, startToken.start)

		return this.astProvider.parenthesisExpression({
			expression: val,
			start: startToken.start,
			end: this.previousToken.end,
			range: [startToken.range[0], this.previousToken.range[1]],
			scope: this.currentScope,
		})
	}

	parseAtom(_asLval: boolean = false, _statementStart: boolean = false): ASTBase {
		if (this.validator.isLiteral(<TokenType>this.token.type)) {
			return this.parseLiteral()
		} else if (this.isType(TokenType.Identifier)) {
			return this.parseIdentifier(ASTIdentifierKind.Variable)
		}

		this.raise(
			`got ${this.token} where number, string, or identifier is required`,
			new Range(this.token.start, this.token.end),
		)

		return this.parseInvalidCode()
	}

	parseLiteral(): ASTLiteral {
		const startToken = this.token
		const type = <TokenType>this.token.type
		const base: ASTLiteral = this.astProvider.literal(
			<
				| TokenType.StringLiteral
				| TokenType.NumericLiteral
				| TokenType.BooleanLiteral
				| TokenType.NilLiteral
			>type,
			{
				value: this.token.value,
				raw: this.token.raw,
				start: startToken.start,
				end: this.token.end,
				range: [startToken.range[0], this.token.range[1]],
				scope: this.currentScope,
			},
		)

		this.literals.push(<ASTLiteral>base)

		this.next()

		return base
	}

	parseIdentifier(kind: ASTIdentifierKind): ASTIdentifier | ASTBase {
		const identifierToken = this.requireType(TokenType.Identifier)

		if (identifierToken === null) {
			return this.parseInvalidCode()
		}

		const identifier = this.astProvider.identifier({
			kind: kind,
			name: identifierToken.value,
			start: identifierToken.start,
			end: identifierToken.end,
			range: identifierToken.range,
			scope: this.currentScope,
		})

		if (kind !== ASTIdentifierKind.Property) {
			this.currentScope.namespaces.push(identifier)
		}

		return identifier
	}

	parseInvalidCode() {
		const invalidToken = this.token
		const base = this.astProvider.invalidCodeExpression({
			start: invalidToken.start,
			end: invalidToken.end,
			range: invalidToken.range,
		})

		this.next()

		return base
	}

	raise(message: string, range: Range): ParserException {
		const err = new ParserException(message, range)

		this.statementErrors.push(err)

		return err
	}
}
