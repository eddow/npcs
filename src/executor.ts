import {
	type Callable,
	type DoWhileScope,
	type ExecutionContext,
	ExecutionError,
	type ExecutionResult,
	type ExecutionStackEntry,
	type ExecutionState,
	type ForScope,
	FunctionDefinition,
	type FunctionResult,
	type IP,
	isCallable,
	type LValue,
	type MSScope,
	type MSValue,
	type PlanScope,
	stack,
} from './helpers'
import NpcScript from './npcs'
import {
	ASTAssignmentStatement,
	type ASTBase,
	ASTBaseBlock,
	type ASTBinaryExpression,
	ASTCallExpression,
	type ASTCallStatement,
	ASTClause,
	type ASTComparisonGroupExpression,
	ASTDoWhileLoop,
	ASTElseClause,
	ASTForGenericStatement,
	type ASTFunctionStatement,
	ASTIdentifier,
	ASTIfClause,
	ASTIfStatement,
	ASTIndexExpression,
	type ASTIsaExpression,
	type ASTListConstructorExpression,
	type ASTListValue,
	type ASTLiteral,
	type ASTLogicalExpression,
	type ASTMapConstructorExpression,
	ASTMemberExpression,
	ASTNumericLiteral,
	ASTParenthesisExpression,
	ASTPlanStatement,
	type ASTReturnStatement,
	type ASTSliceExpression,
	type ASTTernaryExpression,
	type ASTUnaryExpression,
	ASTWhileClause,
} from './script'

// Meant to be thrown by executeCall to signal a branched execution
class ExpressionCall {
	constructor(
		public readonly stack: ExecutionStackEntry,
		public readonly statement: ASTBase,
	) {}
}

export class MiniScriptExecutor {
	public assertAST<E extends ASTBase>(
		expr: ASTBase,
		ctor: abstract new (...args: any[]) => E,
		expectedName?: string,
	): asserts expr is E {
		if (!(expr instanceof ctor)) {
			const name = expectedName || (ctor as any).name || 'expected type'
			throw new ExecutionError(this, expr, `Expected ${name}, got ${expr.type}`)
		}
	}
	readonly script: NpcScript
	private stack: ExecutionStackEntry[]
	private planScopes: Array<{ planValue: any; savedState: PlanScope }>
	expressionsCacheIndex: number = 0
	expressionsCacheStack: number[] = []
	get state(): ExecutionState {
		return { stack: this.stack, plans: this.planScopes }
	}
	set state(state: ExecutionState) {
		this.stack = state.stack
		this.planScopes = state.plans
	}
	/**
	 * @param specs - the script or source code
	 * @param context - the context ("global" values)
	 * @param state - the state (stack - given to keep on execution)
	 */
	constructor(
		specs: NpcScript | string,
		public readonly context: ExecutionContext,
		state?: ExecutionState,
	) {
		this.script = typeof specs === 'string' ? new NpcScript(specs) : specs
		if (state) {
			this.stack = state.stack
			this.planScopes = state.plans
		} else {
			this.stack = [stack()]
			this.planScopes = []
		}
	}

	// Variable access methods
	private getVariable(name: string, statement: ASTBase): any {
		for (const scope of this.stack[0].loopScopes)
			if ('variable' in scope && scope.variable === name) return scope.iterator[scope.index]
		let scope: MSScope | undefined = this.stack[0].scope
		while (scope) {
			if (name in scope.variables) return scope.variables[name]
			scope = scope.parent
		}
		if (name in this.context) return Reflect.get(this.context, name)
		throw new ExecutionError(this, statement, `Variable ${name} not found`)
	}

	private setVariable(name: string, value: any, statement: ASTBase): void {
		for (const scope of this.stack[0].loopScopes)
			if ('variable' in scope && scope.variable === name) {
				scope.iterator[scope.index] = value
				return
			}
		let scope: MSScope | undefined = this.stack[0].scope
		while (scope) {
			if (name in scope.variables) {
				scope.variables[name] = value
				return
			}
			scope = scope.parent
		}
		let propertyDescriptor: PropertyDescriptor | undefined
		if (name in this.context) {
			let browser = this.context as any
			while (!propertyDescriptor && browser && browser !== Object.prototype) {
				propertyDescriptor = Object.getOwnPropertyDescriptor(browser, name)
				browser = Object.getPrototypeOf(browser)
			}
			if (!propertyDescriptor?.set || !Reflect.set(this.context, name, value, this.context))
				throw new ExecutionError(this, statement, `Cannot set variable ${name}`)
		} else this.stack[0].scope.variables[name] = value
	}

	// Main execution entry point
	execute(): FunctionResult {
		while (true) {
			// Get current statement from IP
			const statement = this.getStatementByIP(this.stack[0].ip)
			// Execute the current statement
			const result = statement
				? this.executeStatement(statement)
				: ({ type: 'return' } as FunctionResult)
			if (result)
				switch (result.type) {
					case 'return': {
						const leavingScope = this.stack.shift()!

						// Check if we're exiting a function that contained a plan
						// If the stack depth is now less than when any plan started, cancel those plans
						for (let i = this.planScopes.length - 1; i >= 0; i--) {
							const { savedState } = this.planScopes[i]
							if (this.stack.length < savedState.stackDepth) {
								// We're exiting a function that contained this plan, cancel it
								const cancelledPlan = this.planScopes.splice(i, 1)[0]
								this.finishPlan('cancel', cancelledPlan.planValue)
							}
						}

						if (!this.stack.length) return result as FunctionResult

						if (leavingScope.targetReturn === undefined) {
							this.incrementIP(this.stack[0].ip)
							delete this.stack[0].evaluatedCache
							if (result.value !== undefined) return { type: 'yield', value: result.value }
						} else {
							this.stack[0].evaluatedCache![leavingScope.targetReturn] = result.value
						}
						break
					}
					case 'yield':
						this.incrementIP(this.stack[0].ip)
						return result
					case 'branched':
						break
				}
			else this.incrementIP(this.stack[0].ip)
		}
	}
	*[Symbol.iterator]() {
		while (true) {
			const { type, value } = this.execute()
			switch (type) {
				case 'return':
					return value
				case 'yield':
					yield value
					break
				default:
					throw new Error(`Unknown executor result type: ${type}`)
			}
		}
	}

	private countLoopOccurrences(statement: ASTBase) {
		const dwScope = this.stack[0].loopScopes[0] as DoWhileScope
		if (dwScope.occurrences++ > 1000)
			throw new ExecutionError(
				this,
				statement,
				'While loop "stack overflow": has more than 1000 occurrences',
			)
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
				} else if (currentBlock instanceof ASTDoWhileLoop) {
					container = [currentBlock.mainBlock, ...currentBlock.whileClauses]
				} else
					throw new ExecutionError(
						this,
						currentBlock,
						`Container not found for ip: ${ip.indexes.join('.')} -> ${currentBlock.type}`,
					)
				currentBlock = container![i]
				statements.unshift(currentBlock)
			}
			let lastStatement = statements.shift()
			if (lastStatement || ip.indexes.length <= 1) return lastStatement
			ip.indexes.pop()
			lastStatement = statements.shift()!
			if (lastStatement instanceof ASTClause) {
				ip.indexes.pop()
				this.incrementIP(ip)
			} else if (lastStatement instanceof ASTPlanStatement) {
				// Exit from a plan-block: call global plan functions if available
				const { planValue } = this.planScopes.shift()!

				// Call standardized plan conclude method
				this.finishPlan('conclude', planValue)

				this.incrementIP(ip)
			} else if (lastStatement instanceof ASTDoWhileLoop) {
				// Here, we finished the whiles and none succeeded, get out of the loop
				this.incrementIP(ip)
			} else if (lastStatement instanceof ASTWhileClause) {
				ip.indexes.pop()
				ip.indexes.push(0, 0)
				this.countLoopOccurrences(statements[0])
			} else if (statements[0] instanceof ASTDoWhileLoop) {
				// Here, we finished the main block as it was not a while clause
				const dwl = statements[0] as ASTDoWhileLoop
				// Not a while clause, so it's the main block
				if (dwl.whileClauses.length === 0) {
					ip.indexes.push(0)
					this.countLoopOccurrences(statements[0])
					continue
				}
				this.incrementIP(ip) // Just go on first `whileClause`
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
					`Unknown loop statement type: ${lastStatement.type}`,
				)
			}
		}
	}

	// Increment the instruction pointer (move to next statement)
	private incrementIP(ip: IP): void {
		ip.indexes[ip.indexes.length - 1]++
	}

	private executeStatement(statement: ASTBase): ExecutionResult {
		const statementType = statement.type
		this.expressionsCacheIndex = 0
		this.expressionsCacheStack = []
		this.stack[0].evaluatedCache ??= {}
		let keepExpressionCache = false
		try {
			switch (statementType) {
				case 'AssignmentStatement':
					return this.executeAssignment(statement as ASTAssignmentStatement)
				case 'IfStatement':
				case 'IfShortcutStatement':
					return this.executeIf(statement as ASTIfStatement)
				case 'DoWhileLoop':
					return this.executeDoWhileLoop(statement as ASTDoWhileLoop)
				case 'WhileClause':
					return this.executeWhileClause(statement as ASTWhileClause)
				case 'ForGenericStatement':
					return this.executeForGeneric(statement as ASTForGenericStatement)
				case 'PlanStatement':
					return this.executePlan(statement as ASTPlanStatement)
				case 'CallStatement':
					return this.executeProcedure(statement as ASTCallStatement)
				case 'ReturnStatement':
					return this.executeReturn(statement as ASTReturnStatement)
				case 'BreakStatement':
					return this.executeBreak(statement)
				case 'ContinueStatement':
					return this.executeContinue(statement)
				case 'ImportCodeExpression':
					return this.executeImport(statement)
				default: {
					const value = this.evaluateExpression(statement)
					// If something evaluates to a function, it is called without arguments and yielded
					if (isCallable(value)) return this.executeProcedure(value, statement)
					return undefined
				}
			}
		} catch (e) {
			if (e instanceof ExpressionCall) {
				this.stack.unshift(e.stack)
				keepExpressionCache = true
				return { type: 'branched' }
			}
			throw e
		} finally {
			if (!keepExpressionCache) {
				delete this.stack[0].evaluatedCache
			}
		}
	}

	private executePlan(statement: ASTPlanStatement): ExecutionResult {
		// Evaluate the plan expression (can be anything)
		const planValue = this.evaluateExpression(statement.expression)

		// Add the plan value and saved state to the stack (unshift for LIFO order)
		this.planScopes.unshift({
			planValue,
			savedState: {
				ipDepth: this.stack[0].ip.indexes.length,
				stackDepth: this.stack.length,
			},
		})

		// Notify plan begin if available
		if (typeof this.context.plan?.begin === 'function')
			this.context.plan.begin.call(this.context, planValue)

		// Enter the plan block body
		this.stack[0].ip.indexes.push(0)
		return { type: 'branched' }
	}

	clearExpressionCache(expressionCacheStackLength: number) {
		const toRemove = this.expressionsCacheStack.splice(expressionCacheStackLength + 1)
		for (const index of toRemove) delete this.stack[0].evaluatedCache![index]
	}
	private evaluateExpression(expr: ASTBase): MSValue {
		while (expr instanceof ASTParenthesisExpression) expr = expr.expression
		if (!expr) return undefined

		const expressionsCacheIndex = this.expressionsCacheIndex++

		const expressionCacheStackLength = this.expressionsCacheStack.length
		this.expressionsCacheStack.push(expressionsCacheIndex)

		if (expressionsCacheIndex in this.stack[0].evaluatedCache!) {
			this.clearExpressionCache(expressionCacheStackLength)
			return this.stack[0].evaluatedCache![expressionsCacheIndex]
		}
		const calculated = (() => {
			const lValue = this.evaluateLValue(expr)
			if (lValue) {
				return lValue.get()
			}
			const exprType = expr.type
			switch (exprType) {
				case 'StringLiteral':
				case 'BooleanLiteral':
					return (expr as ASTLiteral).value
				case 'NumericLiteral':
					this.assertAST(expr, ASTNumericLiteral)
					return expr.negated ? -expr.value : expr.value
				case 'NilLiteral':
					return null
				case 'ListValue':
					return this.evaluateExpression((expr as ASTListValue).value!)
				case 'BinaryExpression':
					return this.evaluateBinaryExpression(expr as ASTBinaryExpression)
				case 'BinaryNegatedExpression':
				case 'NegationExpression':
				case 'UnaryExpression':
					return this.evaluateUnaryExpression(expr as ASTUnaryExpression)
				case 'LogicalExpression':
					return this.evaluateLogicalExpression(expr as ASTLogicalExpression)
				case 'TernaryExpression':
					return this.evaluateTernaryExpression(expr as ASTTernaryExpression)
				case 'CallExpression':
					return this.executeCall(expr as ASTCallExpression, expressionCacheStackLength)
				case 'FunctionDeclaration':
					return this.createFunction(expr as ASTFunctionStatement)
				case 'MapConstructorExpression':
					return this.evaluateMapConstructor(expr as ASTMapConstructorExpression)
				case 'ListConstructorExpression':
					return this.evaluateListConstructor(expr as ASTListConstructorExpression)
				case 'ParenthesisExpression':
					return this.evaluateExpression((expr as ASTParenthesisExpression).expression)
				case 'IsaExpression':
					return this.evaluateIsaExpression(expr as ASTIsaExpression)
				case 'ComparisonGroupExpression':
					return this.evaluateComparisonGroupExpression(expr as ASTComparisonGroupExpression)
				case 'SliceExpression':
					return this.evaluateSliceExpression(expr as ASTSliceExpression)
				default:
					throw new ExecutionError(this, expr, `Unknown expression type: ${exprType}`)
			}
		})()
		this.clearExpressionCache(expressionCacheStackLength)
		this.stack[0].evaluatedCache![expressionsCacheIndex] = calculated
		return calculated
	}

	private evaluateLValue(expr: ASTBase): LValue | false {
		if (expr instanceof ASTIdentifier)
			return {
				get: () => this.getVariable(expr.name!, expr),
				set: (value: MSValue) => {
					this.setVariable(expr.name!, value, expr)
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
		// It can be a string, a date, ... too
		if (!base /*|| typeof base !== 'object'*/)
			throw new ExecutionError(this, expr, `Invalid collection \`${base}\` for index \`${index}\``)
		return {
			get: () => base[index],
			set: (value: MSValue) => {
				base[index] = value
			},
		}
	}

	private callNative(func: Function, args: any[], ast: ASTBase): any {
		try {
			return this.script.callNative(func, args, this.context)
		} catch (e) {
			//console.error(`At: ${this.script.sourceLocation(ast)}`)
			throw new ExecutionError(this, ast, e as Error)
		}
	}

	private executeCall(statement: ASTCallExpression, eCacheStackLength: number): MSValue {
		// Get arguments
		const args = statement.arguments
		const evaluatedArgs = args ? args.map((arg: any) => this.evaluateExpression(arg)) : []
		// Handle both func and expression properties
		// Evaluate the function reference to get the function definition
		const func = this.evaluateExpression(statement.base)

		if (func instanceof FunctionDefinition) {
			const returnIndex = this.expressionsCacheStack[eCacheStackLength]
			this.clearExpressionCache(eCacheStackLength)
			throw new ExpressionCall(func.enterCall(evaluatedArgs, returnIndex), statement)
		} else if (this.script.isNative(func)) {
			return this.callNative(func, evaluatedArgs, statement)
		} else {
			throw new ExecutionError(this, statement, 'Cannot call non-function value')
		}
	}

	private executeAssignment(statement: ASTAssignmentStatement): ExecutionResult {
		// Check if this is a member expression assignment (e.g., person.age = 40)
		const lValue = this.evaluateLValue(statement.variable)
		if (!lValue) throw new ExecutionError(this, statement.variable, 'Invalid L-Value target')
		lValue.set(this.evaluateExpression(statement.init!))
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
				this.stack[0].ip.indexes.push(i, 0)
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

	private executeDoWhileLoop(_statement: ASTDoWhileLoop): ExecutionResult {
		this.stack[0].loopScopes.unshift({
			ipDepth: this.stack[0].ip.indexes.length,
			occurrences: 1,
		})
		this.stack[0].ip.indexes.push(0, 0)
		return { type: 'branched' }
	}

	private executeWhileClause(statement: ASTWhileClause): ExecutionResult {
		if (this.evaluateExpression(statement.condition)) {
			this.stack[0].ip.indexes.push(0)
			return { type: 'branched' }
		}
	}

	private executeProcedure(
		statement: ASTCallStatement | Callable,
		from?: ASTBase,
	): ExecutionResult {
		// Evaluate the function reference to get the function definition
		// Function is evaluated *after* the arguments so that it does not have to be serialized (in case of native functions)
		const [evaluatedArgs, func, source] = isCallable(statement)
			? [[], statement, from!]
			: (() => {
					const expr = statement.expression
					this.assertAST(expr, ASTCallExpression)
					// Get arguments
					const args = expr.arguments
					return [
						args ? args.map((arg: any) => this.evaluateExpression(arg)) : [],
						this.evaluateExpression(expr.base),
						statement,
					]
				})()

		if (func instanceof FunctionDefinition) {
			this.stack.unshift(func.enterCall(evaluatedArgs))
			return { type: 'branched' }
		} else if (this.script.isNative(func)) {
			const value = this.callNative(func, evaluatedArgs, source)
			return value !== undefined ? { type: 'yield', value: value } : undefined
		} else {
			throw new ExecutionError(this, source, `Cannot call non-function value ${func}`)
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

		// Check if we're continuing a loop that contained a plan
		// Cancel any plans that are active (they will be interrupted by the continue)
		for (let i = this.planScopes.length - 1; i >= 0; i--) {
			const cancelledPlan = this.planScopes.splice(i, 1)[0]
			this.finishPlan('cancel', cancelledPlan.planValue)
		}

		const lastLoop = this.stack[0].loopScopes[0]
		this.stack[0].ip.indexes.splice(lastLoop.ipDepth)
		const loopStatement = this.getStatementByIP(this.stack[0].ip)
		if (loopStatement instanceof ASTDoWhileLoop) {
			this.stack[0].ip.indexes.push(0, 0)
			return { type: 'branched' }
		}
		this.assertAST(loopStatement, ASTBaseBlock)
		this.stack[0].ip.indexes.push(loopStatement.body.length)
		return { type: 'branched' }
	}
	private executeBreak(statement: ASTBase): ExecutionResult {
		if (!this.stack[0].loopScopes.length)
			throw new ExecutionError(this, statement, 'Break/Continue statement outside of loop')

		// Check if we're breaking out of a loop that contained a plan
		// Cancel any plans that are active (they will be interrupted by the break)
		for (let i = this.planScopes.length - 1; i >= 0; i--) {
			const cancelledPlan = this.planScopes.splice(i, 1)[0]
			this.finishPlan('cancel', cancelledPlan.planValue)
		}

		this.stack[0].ip.indexes.splice(this.stack[0].loopScopes.shift()!.ipDepth)
		this.incrementIP(this.stack[0].ip)
		return { type: 'branched' }
	}
	private evaluateBinaryExpression(expr: ASTBinaryExpression): any {
		const left = this.evaluateExpression(expr.left)
		const right = this.evaluateExpression(expr.right)
		const operator = this.script.operators[expr.operator]
		if (!operator) throw new ExecutionError(this, expr, `Unknown binary operator: ${expr.operator}`)
		return operator(left, right)
	}

	private evaluateUnaryExpression(expr: ASTUnaryExpression): any {
		const argument = this.evaluateExpression(expr.argument)
		// Special handling for 'new' operator: create an object with given prototype
		if (expr.operator === 'new') {
			if (argument === null || typeof argument !== 'object')
				throw new ExecutionError(
					this,
					expr,
					`'new' operator expects an object prototype, got ${typeof argument}`,
				)
			return Object.create(argument, {})
		}
		const operator =
			this.script.operators[`${expr.operator === 'not' ? '!' : (expr.operator ?? '??!?')}.`]
		if (!operator) throw new ExecutionError(this, expr, `Unknown unary operator: ${expr.operator}`)
		return operator(argument)
	}

	private evaluateLogicalExpression(expr: ASTLogicalExpression): any {
		const breakOn = {
			and: false,
			or: true,
		}[expr.operator]
		if (!!this.evaluateExpression(expr.left) === breakOn) return breakOn

		return this.evaluateExpression(expr.right)
	}

	private evaluateTernaryExpression(expr: ASTTernaryExpression): any {
		const condition = this.evaluateExpression(expr.condition)
		// In MiniScript, truthy values are non-null, non-false, non-zero, non-empty string
		const isTruthy =
			condition !== null && condition !== false && condition !== 0 && condition !== ''

		if (isTruthy) {
			return this.evaluateExpression(expr.trueValue)
		} else {
			return this.evaluateExpression(expr.falseValue)
		}
	}

	private createFunction(expr: ASTFunctionStatement): FunctionDefinition {
		// Find the instruction pointer for this function definition
		// Extract parameter names
		const parameters = expr.parameters.map((param) => {
			// Handle default parameters (which are AssignmentStatement objects)
			if (param instanceof ASTAssignmentStatement) {
				this.assertAST(param.variable, ASTIdentifier)
				return param.variable.name
			}
			// Handle regular parameters (which are ASTIdentifier objects)
			this.assertAST(param, ASTIdentifier)
			return param.name
		})
		// Extract default values aligned with parameters
		const parameterDefaults = expr.parameters.map((param) => {
			if (param instanceof ASTAssignmentStatement) {
				return this.evaluateExpression(param.init!)
			}
			return undefined
		})

		// Return a FunctionDefinition instance
		return new FunctionDefinition(
			this.script.functionIndexes.get(expr)!,
			parameters as string[],
			this.stack[0].scope,
			parameterDefaults,
		)
	}

	private evaluateMapConstructor(expr: ASTMapConstructorExpression): any {
		const obj: any = {}
		if (expr.fields) {
			for (const field of expr.fields) {
				this.assertAST(field.key!, ASTIdentifier)
				const key = field.key.name!
				const value = this.evaluateExpression(field.value!)
				obj[key] = value
			}
		}
		return obj
	}

	private evaluateListConstructor(expr: ASTListConstructorExpression): any {
		return expr.fields?.map((field: any) => this.evaluateExpression(field)) ?? []
	}

	private executeForGeneric(statement: ASTForGenericStatement): ExecutionResult {
		const variable = statement.variable.name
		let iterator = this.evaluateExpression(statement.iterator)
		if (typeof iterator !== 'object') {
			throw new ExecutionError(this, statement, 'For loop iterator must be an map or a list')
		}
		if (!Array.isArray(iterator)) iterator = Object.keys(iterator)
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
	private evaluateIsaExpression(expr: ASTIsaExpression): boolean {
		const left = this.evaluateExpression(expr.left)
		this.assertAST(expr.right, ASTIdentifier)
		const right = expr.right.name!
		const isaType = this.script.isaTypes[right]
		if (!isaType) throw new ExecutionError(this, expr, `Unknown ISA type: ${right}`)
		return isaType(left)
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

	private evaluateSliceExpression(expr: ASTSliceExpression): any {
		const base = this.evaluateExpression(expr.base)
		const left = this.evaluateExpression(expr.left)

		// Validate that base is sliceable (string or array)
		if (typeof base !== 'string' && !Array.isArray(base)) {
			throw new ExecutionError(
				this,
				expr,
				'Slice operation can only be applied to strings or lists',
			)
		}

		// Handle EmptyExpression for omitted end index (e.g., text[7:])
		if (expr.right.type === 'EmptyExpression') {
			// Only validate left index
			if (typeof left !== 'number') {
				throw new ExecutionError(this, expr, 'Slice start index must be a number')
			}

			// Handle negative indices
			const length = base.length
			const startIndex = left < 0 ? Math.max(0, length + left) : Math.min(length, left)

			// Return slice from start to end
			return base.slice(startIndex)
		}

		const right = this.evaluateExpression(expr.right)
		// Validate indices are numbers
		if (typeof left !== 'number') {
			throw new ExecutionError(this, expr, 'Slice start index must be a number')
		}
		if (typeof right !== 'number') {
			throw new ExecutionError(this, expr, 'Slice end index must be a number')
		}

		// Handle negative indices
		const length = base.length
		const startIndex = left < 0 ? Math.max(0, length + left) : Math.min(length, left)
		const endIndex = right < 0 ? Math.max(0, length + right) : Math.min(length, right)

		// Perform the slice
		return base.slice(startIndex, endIndex)
	}

	/**
	 * Cancel a specific plan or all plans
	 * @param plan - The plan to cancel, or undefined to cancel all plans
	 * @returns the new execution state if plans were cancelled, or undefined if script is completely cancelled
	 */
	cancel(plan?: any): ExecutionState | undefined {
		// Find the specific plan in the stack
		const planIndex = this.planScopes.findIndex((p) => p.planValue === plan)
		if (planIndex === -1) {
			// Plan not found, cancel all plans using standardized method
			for (const { planValue } of this.planScopes) this.finishPlan('cancel', planValue)
			this.planScopes = []
			// If no stack remains, script is completely cancelled
			return undefined
		}

		// Cancel the specific plan and all its sub-plans (plans that were started after this one)
		const plansToCancel = this.planScopes.splice(0, planIndex + 1)
		for (const { planValue } of plansToCancel) this.finishPlan('cancel', planValue)

		// Restore the execution state to what it was when the plan started
		if (plansToCancel.length > 0) {
			const { savedState } = plansToCancel.pop()! // Use the most recent plan's state

			// Restore the stack to the original depth
			this.stack = this.stack.slice(-savedState.stackDepth)

			// Restore the IP depth by truncating indexes to the original depth
			if (this.stack[0] && savedState.ipDepth !== undefined) {
				this.stack[0].ip.indexes.splice(savedState.ipDepth)
				this.expressionsCacheIndex = 0
				this.expressionsCacheStack = []
				if (this.stack[0]) delete this.stack[0].evaluatedCache
				this.incrementIP(this.stack[0].ip)
			}

			// Clear expression cache since we're restoring state
			this.expressionsCacheIndex = 0
			this.expressionsCacheStack = []
			if (this.stack[0]) delete this.stack[0].evaluatedCache
		}

		// Return the new execution state after cancellation
		return this.state
	}
	private finishPlan(endType: 'conclude' | 'cancel', planValue: any): void {
		const endCall = (endType: 'conclude' | 'cancel' | 'finally', planValue: any): void => {
			if (typeof this.context.plan?.[endType] === 'function')
				this.context.plan[endType].call(this.context, planValue)
		}
		endCall(endType, planValue)
		endCall('finally', planValue)
	}
}
