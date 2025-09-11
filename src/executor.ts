import {
	ASTAssignmentStatement,
	type ASTBase,
	ASTBaseBlock,
	type ASTBinaryExpression,
	type ASTCallExpression,
	type ASTCallStatement,
	ASTClause,
	type ASTComparisonGroupExpression,
	ASTElseClause,
	ASTForGenericStatement,
	type ASTFunctionStatement,
	ASTIdentifier,
	ASTIfClause,
	ASTIfStatement,
	ASTIndexExpression,
	type ASTListValue,
	ASTMemberExpression,
	ASTReturnStatement,
	type ASTUnaryExpression,
	ASTWhileStatement,
} from 'miniscript-core'
import {
	type ExecutionContext,
	ExecutionError,
	type ExecutionResult,
	type ExecutionStack,
	type ForScope,
	FunctionDefinition,
	type FunctionResult,
	type IP,
	type LValue,
	type MSValue,
	NativeFunctionDefinition,
	parseStack,
	stringifyStack,
} from './helpers'
import NpcS from './npcs'

export class MiniScriptExecutor {
	public assertAST<E extends ASTBase>(
		expr: ASTBase,
		ctor: new (...args: any[]) => E,
		expectedName?: string,
	): asserts expr is E {
		if (!(expr instanceof ctor)) {
			const name = expectedName || (ctor as any).name || 'expected type'
			throw new ExecutionError(this, expr, `Expected ${name}, got ${expr.constructor.name}`)
		}
	}
	readonly script: NpcS
	private stack: ExecutionStack[]
	get state(): string {
		return stringifyStack(this.stack)
	}
	set state(state: string) {
		this.stack = parseStack(state)
	}
	constructor(
		specs: NpcS | string,
		public readonly context: ExecutionContext,
		state: string | ExecutionStack[] = [
			{ scope: {}, ip: { indexes: [0], functionIndex: undefined }, loopScopes: [], yielding: false },
		],
	) {
		this.script = typeof specs === 'string' ? new NpcS(specs, context) : specs
		this.stack = typeof state === 'string' ? parseStack(state) : state
	}

	// Variable access methods
	private getVariable(name: string): any {
		for (const scope of this.stack[0].loopScopes)
			if ('variable' in scope && scope.variable === name) return scope.iterator[scope.index]
		const scope = this.stack[0].scope
		if (name in scope) return scope[name]
		const rv = this.context[name]
		return typeof rv === 'function' ? new NativeFunctionDefinition(name) : rv
	}

	private setVariable(name: string, value: any, statement: ASTBase): void {
		for (const scope of this.stack[0].loopScopes)
			if ('variable' in scope && scope.variable === name) {
				scope.iterator[scope.index] = value
				return
			}
		let scope = this.stack[0].scope
		if (name in scope)
			while (scope) {
				if (Object.hasOwn(scope, name)) {
					scope[name] = value
					return
				}
				scope = Object.getPrototypeOf(scope)
			}
		else if(name in this.context)
			throw new ExecutionError(this, statement, `Cannot set ${name} native value`)
		scope[name] = value
	}

	// Main execution entry point
	execute(enteringScopeDepth: number = 1): FunctionResult {
		while (true) {
			// Get current statement from IP
			const statement = this.getStatementByIP(this.stack[0].ip)
			// Execute the current statement
			const result = statement ? this.executeStatement(statement) : { type: 'return' } as FunctionResult
			if (result)
				switch (result.type) {
					case 'return':
						const leavingScope = this.stack.shift()
						if (this.stack.length < enteringScopeDepth) return result as FunctionResult
						this.incrementIP(this.stack[0].ip)

						if (leavingScope?.yielding && result.value !== undefined)
							return { type: 'yield', value: result.value }
						break
					case 'yield':
						this.incrementIP(this.stack[0].ip)
						return result
					case 'branched':
						break
				}
			else this.incrementIP(this.stack[0].ip)
		}
	}

	// Get statement by instruction pointer
	private getStatementByIP(ip: IP): any {
		if (ip.indexes.length === 0) {
			return null
		}
		while (true) {
			const statements = [] as ASTBase[]
			let currentBlock: ASTBase = this.script.function(ip.functionIndex)
			let container: ASTBase[] | undefined
			for (const i of ip.indexes) {
				if (currentBlock instanceof ASTBaseBlock) {
					container = currentBlock.body
				} else if (currentBlock instanceof ASTIfStatement) {
					container = currentBlock.clauses
				} else
					throw new ExecutionError(
						this,
						currentBlock,
						`Container not found for ip: ${ip.indexes.join('.')} -> ${currentBlock.constructor.name}`,
					)
				currentBlock = container![i]
				statements.push(currentBlock)
			}
			let lastStatement = statements.pop()
			if (lastStatement || ip.indexes.length <= 1) return lastStatement
			ip.indexes.pop()
			lastStatement = statements.pop()!
			if (lastStatement instanceof ASTClause) {
				ip.indexes.pop()
				this.incrementIP(ip)
			} else if (
				lastStatement instanceof ASTAssignmentStatement ||
				lastStatement instanceof ASTReturnStatement
			) {
				// function definition
				return null
			} else if (lastStatement instanceof ASTWhileStatement) {
				this.stack[0].loopScopes.shift()
				return lastStatement
			} else if (lastStatement instanceof ASTForGenericStatement) {
				const forLoop = this.stack[0].loopScopes[0] as ForScope
				forLoop.index++
				if (forLoop.index < forLoop.iterator.length) this.stack[0].ip.indexes.push(0)
				else {
					this.stack[0].loopScopes.shift()
					this.incrementIP(ip)
				}
			} else {
				throw new ExecutionError(
					this,
					lastStatement,
					`Unknown loop statement type: ${lastStatement.constructor.name}`,
				)
			}
		}
	}

	// Increment the instruction pointer (move to next statement)
	private incrementIP(ip: IP): void {
		ip.indexes[ip.indexes.length - 1]++
	}

	private executeStatement(statement: ASTBase): ExecutionResult {
		const statementType = statement.constructor.name

		switch (statementType) {
			case 'ASTAssignmentStatement':
				this.executeAssignment(statement as ASTAssignmentStatement)
				break
			case 'ASTIfStatement':
				return this.executeIf(statement as ASTIfStatement)
			case 'ASTWhileStatement':
				return this.executeWhile(statement as ASTWhileStatement)
			case 'ASTForGenericStatement':
				return this.executeForGeneric(statement as ASTForGenericStatement)
			case 'ASTCallStatement':
				return this.executeProcedure(statement as ASTCallStatement)
			case 'ASTCallExpression':
				this.executeCall(statement as ASTCallExpression)
				break
			case 'ASTReturnStatement':
				return this.executeReturn(statement as ASTReturnStatement)
			case 'ASTBreakStatement':
				return this.executeBreak(statement)
			case 'ASTContinueStatement':
				return this.executeContinue(statement)
			case 'ASTImportCodeExpression':
				return this.executeImport(statement)
			default:
				console.log(`Unknown statement type: ${statementType}`)
				return undefined
		}
	}

	private evaluateLValue(expr: ASTBase): LValue | false {
		if (expr instanceof ASTIdentifier)
			return {
				get: () => this.getVariable(expr.name),
				set: (value: MSValue) => {
					this.setVariable(expr.name, value, expr)
				},
			}
		let base: any
		let index: any
		if (expr instanceof ASTMemberExpression) {
			base = this.evaluateExpression(expr.base)
			this.assertAST(expr.identifier, ASTIdentifier)
			index = expr.identifier.name
		} else if (expr instanceof ASTIndexExpression) {
			base = this.evaluateExpression(expr.base)
			index = this.evaluateExpression(expr.index)
		} else {
			return false
		}
		return {
			get: () => base[index],
			set: (value: MSValue) => {
				base[index] = value
			},
		}
	}
	private executeAssignment(statement: ASTAssignmentStatement): ExecutionResult {
		// Check if this is a member expression assignment (e.g., person.age = 40)
		const lValue = this.evaluateLValue(statement.variable)
		if (!lValue) throw new ExecutionError(this, statement.variable, 'Invalid L-Value target')
		lValue.set(this.evaluateExpression(statement.init))
	}

	private executeIf(statement: ASTIfStatement): ExecutionResult {
		if (!statement.clauses || statement.clauses.length === 0) {
			return undefined
		}

		// Check each clause to find the first true condition
		for (let i = 0; i < statement.clauses.length; i++) {
			const clause = statement.clauses[i]
			this.assertAST(clause, ASTClause)
			if (
				clause instanceof ASTElseClause ||
				(clause instanceof ASTIfClause && this.evaluateExpression(clause.condition))
			) {
				// Enter this clause's block - push clause index and then 0 for first statement
				this.stack[0].ip.indexes.push(i)
				this.stack[0].ip.indexes.push(0)
				return { type: 'branched' }
			}
		}

		// Check for else clauses
		for (let i = 1; i < (statement as any).clauses.length; i++) {
			const clause = (statement as any).clauses[i]
			if (
				(clause as any).condition === null ||
				(clause as any).condition === undefined ||
				this.evaluateExpression((clause as any).condition)
			) {
				// Enter the else block - push index 0 for first statement in the block
				this.stack[0].ip.indexes.push(0)
				return undefined // Continue execution in the new block
			}
		}

		// No clause executed, continue with next statement
		return undefined
	}

	private executeWhile(statement: ASTWhileStatement): ExecutionResult {
		// Check if we're entering the loop for the first time
		if (this.evaluateExpression(statement.condition)) {
			// Enter the while loop body - push index 0 for first statement in the block
			this.stack[0].loopScopes.unshift({ ipDepth: this.stack[0].ip.indexes.length })
			this.stack[0].ip.indexes.push(0)
			return { type: 'branched' } // Continue execution in the new block
		}

		// Loop condition is false, continue with next statement
		return undefined
	}

	private executeProcedure(statement: ASTCallStatement): ExecutionResult {
		const expr = statement.expression as ASTCallExpression
		// Get arguments
		const args = expr.arguments
		const evaluatedArgs = args ? args.map((arg: any) => this.evaluateExpression(arg)) : []

		// Evaluate the function reference to get the function definition
		const func = this.evaluateExpression(expr.base)

		if (func instanceof FunctionDefinition) {
			this.stack.unshift(func.enterCall(evaluatedArgs, true))
			return { type: 'branched' }
		} else if (func instanceof NativeFunctionDefinition) {
			const value = func.evaluate(this, evaluatedArgs, statement)
			return value !== undefined ? { type: 'yield', value: value } : undefined
		} else {
			throw new ExecutionError(this, statement, 'Cannot call non-function value')
		}
	}

	private executeCall(statement: ASTCallExpression): MSValue {
		// Get arguments
		const args = statement.arguments
		const evaluatedArgs = args ? args.map((arg: any) => this.evaluateExpression(arg)) : []
		// Handle both func and expression properties
		// Evaluate the function reference to get the function definition
		const func = this.evaluateExpression(statement.base)

		if (func instanceof FunctionDefinition) {
			this.stack.unshift(func.enterCall(evaluatedArgs, false))
			const result = this.execute(this.stack.length)

			switch (result.type) {
				case 'yield':
					throw new ExecutionError(this, statement, 'Function call cannot yield')
				case 'return':
					return result.value
			}
		} else if (func instanceof NativeFunctionDefinition) {
			return func.evaluate(this, evaluatedArgs, statement)
		} else {
			throw new ExecutionError(this, statement, 'Cannot call non-function value')
		}
	}

	private executeReturn(statement: ASTReturnStatement): ExecutionResult {
		return statement.argument
			? { type: 'return', value: this.evaluateExpression(statement.argument) }
			: { type: 'return' }
	}

	private executeContinue(statement: ASTBase): ExecutionResult {
		if (!this.stack[0].loopScopes.length)
			throw new ExecutionError(this, statement, 'Break/Continue statement outside of loop')
		const lastLoop = this.stack[0].loopScopes[0]
		this.stack[0].ip.indexes.splice(lastLoop.ipDepth)
		const loopStatement = this.getStatementByIP(this.stack[0].ip)
		this.assertAST(loopStatement, ASTBaseBlock)
		this.stack[0].ip.indexes.push(loopStatement.body.length)
		return { type: 'branched' }
	}
	private executeBreak(statement: ASTBase): ExecutionResult {
		if (!this.stack[0].loopScopes.length)
			throw new ExecutionError(this, statement, 'Break/Continue statement outside of loop')
		this.stack[0].ip.indexes.splice(this.stack[0].loopScopes.shift()!.ipDepth)
		this.incrementIP(this.stack[0].ip)
		return { type: 'branched' }
	}

	private evaluateExpression(expr: ASTBase): MSValue {
		if (!expr) return undefined

		const exprType = expr.constructor.name

		const lValue = this.evaluateLValue(expr)
		if (lValue) {
			return lValue.get()
		}
		switch (exprType) {
			case 'ASTNumericLiteral':
			case 'ASTStringLiteral':
			case 'ASTBooleanLiteral':
				return (expr as any).value
			case 'ASTNilLiteral':
				return null
			case 'ASTListValue':
				return this.evaluateExpression((expr as ASTListValue).value)
			case 'ASTBinaryExpression':
				return this.evaluateBinaryExpression(expr as ASTBinaryExpression)
			case 'ASTUnaryExpression':
				return this.evaluateUnaryExpression(expr as ASTUnaryExpression)
			case 'ASTCallExpression':
				return this.executeCall(expr as ASTCallExpression)
			case 'ASTFunctionStatement':
				return this.createFunction(expr as ASTFunctionStatement)
			case 'ASTMapConstructorExpression':
				return this.evaluateMapConstructor(expr)
			case 'ASTListConstructorExpression':
				return this.evaluateListConstructor(expr)
			case 'ASTParenthesisExpression':
				return this.evaluateExpression((expr as any).expression)
			case 'ASTIsaExpression':
				return this.evaluateIsaExpression(expr)
			case 'ASTLogicalExpression':
				return this.evaluateLogicalExpression(expr)
			case 'ASTComparisonGroupExpression':
				return this.evaluateComparisonGroupExpression(expr as ASTComparisonGroupExpression)
			default:
				console.log(`Unknown expression type: ${exprType}`)
				return undefined
		}
	}

	private evaluateBinaryExpression(expr: ASTBinaryExpression): any {
		const left = this.evaluateExpression(expr.left)
		const right = this.evaluateExpression(expr.right)
		const operator = expr.operator
		// biome-ignore-start lint/suspicious/noDoubleEquals: We keep it fuzzy for npc-s
		switch (operator) {
			case '+':
				return left + right
			case '-':
				return left - right
			case '*':
				return left * right
			case '/':
				return left / right
			case '%':
				return left % right
			case '>':
				return left > right
			case '<':
				return left < right
			case '>=':
				return left >= right
			case '<=':
				return left <= right
			case '==':
				return left == right
			case '!=':
				return left != right
			default:
				throw new ExecutionError(this, expr, `Unknown binary operator: ${operator}`)
		}
		// biome-ignore-end lint/suspicious/noDoubleEquals: We keep it fuzzy for npc-s
	}

	private evaluateUnaryExpression(expr: ASTUnaryExpression): any {
		const argument = this.evaluateExpression(expr.argument)
		const operator = expr.operator

		switch (operator) {
			case 'not':
			case '!':
				return !argument
			case '-':
				return -argument
			case '+':
				return +argument
			default:
				throw new ExecutionError(this, expr, `Unknown unary operator: ${operator}`)
		}
	}

	private createFunction(expr: ASTFunctionStatement): FunctionDefinition {
		// Find the instruction pointer for this function definition
		// Extract parameter names
		const parameters = ((expr as any).params || (expr as any).parameters || []).map(
			(param: any) => param.name,
		)

		// Return a FunctionDefinition instance
		return new FunctionDefinition(this.script.indexes.get(expr)!, parameters, this.stack[0].scope)
	}

	private evaluateMapConstructor(expr: ASTBase): any {
		const obj: any = {}
		if ((expr as any).fields) {
			;(expr as any).fields.forEach((field: any) => {
				// For ASTMapKeyString, the key is field.key.name (identifier)
				const key = field.key.name
				const value = this.evaluateExpression(field.value)
				obj[key] = value
			})
		}
		return obj
	}

	private evaluateListConstructor(expr: ASTBase): any {
		const arr: any[] = []
		if ((expr as any).fields) {
			;(expr as any).fields.forEach((field: any) => {
				arr.push(this.evaluateExpression(field))
			})
		}
		return arr
	}

	private executeForGeneric(statement: ASTForGenericStatement): ExecutionResult {
		const variable = statement.variable.name
		const iterator = this.evaluateExpression(statement.iterator)
		if (!Array.isArray(iterator)) {
			throw new ExecutionError(this, statement, 'For loop iterator must be a list')
		}
		this.stack[0].loopScopes.unshift({
			iterator,
			index: 0,
			ipDepth: this.stack[0].ip.indexes.length,
			variable,
		})
		this.stack[0].ip.indexes.push(0)
		return { type: 'branched' } // Let the main loop handle execution
	}

	private executeImport(statement: ASTBase): ExecutionResult {
		throw new ExecutionError(this, statement, 'Import statement not implemented')
	}

	// New expression evaluation methods
	private evaluateIsaExpression(expr: ASTBase): boolean {
		const left = this.evaluateExpression((expr as any).left)
		const right = (expr as any).right.name // Type name (number, string, boolean, map, list)

		switch (right) {
			case 'number':
				return typeof left === 'number'
			case 'string':
				return typeof left === 'string'
			case 'boolean':
				return typeof left === 'boolean'
			case 'map':
				return left !== null && typeof left === 'object' && !Array.isArray(left)
			case 'list':
				return Array.isArray(left)
			default:
				return false
		}
	}

	private evaluateLogicalExpression(expr: ASTBase): any {
		const left = this.evaluateExpression((expr as any).left)
		const right = this.evaluateExpression((expr as any).right)
		const operator = (expr as any).operator

		switch (operator) {
			case 'and':
				return left && right
			case 'or':
				return left || right
			default:
				throw new ExecutionError(this, expr, `Unknown logical operator: ${operator}`)
		}
	}

	private evaluateComparisonGroupExpression(expr: ASTComparisonGroupExpression): boolean {
		const operators = expr.operators
		const expressions = expr.expressions
		if (!expressions || expressions.length < 2) return true

		let leftValue = this.evaluateExpression(expressions[0])
		for (let i = 0; i < operators.length; i++) {
			const rightValue = this.evaluateExpression(expressions[i + 1])
			const operator = operators[i]
			let comparisonOk: boolean
			// biome-ignore-start lint/suspicious/noDoubleEquals: We keep it fuzzy for npc-s
			switch (operator) {
				case '<':
					comparisonOk = leftValue < rightValue
					break
				case '>':
					comparisonOk = leftValue > rightValue
					break
				case '<=':
					comparisonOk = leftValue <= rightValue
					break
				case '>=':
					comparisonOk = leftValue >= rightValue
					break
				case '==':
					comparisonOk = leftValue == rightValue
					break
				case '!=':
					comparisonOk = leftValue != rightValue
					break
				default:
					throw new ExecutionError(
						this,
						expr as unknown as ASTBase,
						`Unknown comparison operator: ${operator}`,
					)
			}
			// biome-ignore-end lint/suspicious/noDoubleEquals: We keep it fuzzy for npc-s
			if (!comparisonOk) return false
			leftValue = rightValue
		}
		return true
	}
}
