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
	ASTFunctionStatement,
	ASTIdentifier,
	ASTIfClause,
	ASTIfStatement,
	ASTIndexExpression,
	type ASTListValue,
	ASTMemberExpression,
	ASTReturnStatement,
	type ASTUnaryExpression,
	ASTWhileStatement,
} from "miniscript-core"

export class ExecutionError extends Error {
	constructor(
		public executor: MiniScriptExecutor,
		public statement: ASTBase,
		message: string,
	) {
		super(message)
		this.name = "ExecutionError"
	}
	public toString(): string {
		return `ExecutionError: ${this.message}\n${this.executor.sourceLocation(this.statement)}`
	}
}

//#region obsolete interfaces
// Statement path for tracking nested execution position - simple array of indexes
export interface StatementPath {
	statementIndexes: number[] // [parentIndex, childIndex, ...] like an instruction pointer
}

// Function call frame with proper function references
export interface FunctionCallFrame {
	functionName: string // Reference to function in registry
	parameters: Record<string, any> // Function parameters
	variables: Record<string, any> // Local variables
	statementPath: StatementPath // Current position in function
	returnValue?: any // For when function returns
}

// Execution state interface for deep pause/resume functionality
export interface ExecutionState {
	variables: Record<string, any>
	functionCallStack: FunctionCallFrame[]
	currentStatementPath: StatementPath
	source: string
	executionPaused: boolean
	pauseReason?: string
}
//#endregion
export type IP = number[]

export interface LoopScope {
	ipDepth: number
}

export interface ForScope extends LoopScope {
	iterator: MSValue[]
	index: number
	variable: string
}
export interface ExecutionStack {
	scope: MSScope
	ip: IP
	loopStack: (LoopScope | ForScope)[]
}

type MSValue = any
type MSScope = Record<string, any>
/**
 * This is a class so that `instanceof` can be used to check if an object is a function definition.
 */
class FunctionDefinition {
	constructor(
		public ip: IP,
		public parameters: string[],
		public scope: MSScope,
	) {}
	enterCall(args: any[]): ExecutionStack {
		const variables = {} as MSScope
		for (let i = 0; i < this.parameters.length; i++) {
			variables[this.parameters[i]] = args[i]
		}
		return {
			scope: Object.setPrototypeOf(variables, this.scope),
			ip: [...this.ip],
			loopStack: [],
		}
	}
}

interface ExecutionContext {
	statements?: Record<string, (...args: any[]) => any>
	variables?: Record<string, any>
	functions?: Record<string, any>
}

class NativeFunctionDefinition {
	/**
	 * @param evaluation - function to evaluate the function as an expression. Returns a value to place in the expression
	 * @param statement - function to call the function as a statement. If returns a result, the result is yielded
	 */
	constructor(public name: string){}
	evaluate(executor: MiniScriptExecutor, args: any[], ast: ASTBase): MSValue {
		const evaluation = executor.context.functions![this.name]
		if (!evaluation)
			throw new ExecutionError(
				executor,
				ast,
				"Native function definition has no evaluation function",
			)
		return evaluation(...args)
	}
	state(executor: MiniScriptExecutor, args: any[], ast: ASTBase): FunctionResult {
		const statement = executor.context.statements![this.name]
		if (!statement)
			throw new ExecutionError(
				executor,
				ast,
				"Native function definition has no statement function",
			)
		return statement(...args)
	}
}

type BranchedResult = { type: "branched" }
type YieldResult = { type: "yield"; value: any }
type ReturnResult = { type: "return"; value?: any }
// End of block
type EOBResult = { type: "eob" }

type FunctionResult = YieldResult | ReturnResult | EOBResult
type ExecutionResult = BranchedResult | FunctionResult | undefined | void

interface LValue {
	get(): MSValue
	set(value: MSValue): void
}
export class MiniScriptExecutor {
	public assertAST<E extends ASTBase>(
		expr: ASTBase,
		ctor: new (...args: any[]) => E,
		expectedName?: string,
	): asserts expr is E {
		if (!(expr instanceof ctor)) {
			const name = expectedName || (ctor as any).name || "expected type"
			throw new ExecutionError(this, expr, `Expected ${name}, got ${expr.constructor.name}`)
		}
	}
	public sourceLocation(expr: ASTBase): string {
		const source = this.source
		if (!source || !expr.start) return ""
		const lines = source.split("\n")
		const lineIdx = expr.start.line - 1
		const colIdx = Math.max(1, expr.start.character)
		const lineText = lines[lineIdx] ?? ""
		// Build a caret line positioning a ^ under the designated character
		const caretIndent = " ".repeat(colIdx - 1)
		const caretLine = `${caretIndent}^`
		return `${expr.start.line}:${expr.start.character}\n${lineText}\n${caretLine}`
	}

	constructor(
		private readonly ast: any,
		private readonly source: string,
		public readonly context: ExecutionContext,
		public stack: ExecutionStack[] = [{ scope: {}, ip: [0], loopStack: [] }],
	) {}

	// Variable access methods
	private getVariable(name: string): any {
		const scope = this.stack[0].scope
		if(name in scope) return scope[name]
		if(this.context.variables && name in this.context.variables) return this.context.variables[name]
		if(
			(this.context.functions && name in this.context.functions) ||
			(this.context.statements && name in this.context.statements)
		)
			return new NativeFunctionDefinition(name)
	}

	private setVariable(name: string, value: any): void {
		let scope = this.stack[0].scope
		if(name in scope) while(scope) {
			if (Object.hasOwn(scope, name)) {
				scope[name] = value
				return
			}
			scope = Object.getPrototypeOf(scope)
		} else scope[name] = value
	}

	// Main execution entry point
	execute(enteringScopeDepth: number = 1): FunctionResult {
		while (true) {
			// Get current statement from IP
			const statement = this.getStatementByIP(this.stack[0].ip)
			// Execute the current statement
			const result = statement ? this.executeStatement(statement) : { type: "eob" }
			if (result)
				switch (result.type) {
					case "eob":
						this.stack.shift()
					case "return":
						if (this.stack.length < enteringScopeDepth) return result as ReturnResult
						this.incrementIP(this.stack[0].ip)
						break
					case "yield":
						this.incrementIP(this.stack[0].ip)
						return result as YieldResult
					case "branched":
						break
					default:
						throw new ExecutionError(this, statement, `Unknown result type: ${result.type}`)
				}
			else this.incrementIP(this.stack[0].ip)
		}
	}

	// Get statement by instruction pointer
	private getStatementByIP(ip: IP): any {
		if (ip.length === 0) {
			return null
		}
		while (true) {
			const statements = [] as ASTBase[]
			let currentBlock = this.ast
			let container: ASTBase[] | undefined
			for (const i of ip) {
				if (currentBlock instanceof ASTAssignmentStatement) {
					const av = (currentBlock as ASTAssignmentStatement).init
					if (!(av instanceof ASTFunctionStatement)) {
						throw new ExecutionError(
							this,
							currentBlock,
							`Assignment statement init is not a function statement: ${av.constructor.name}`,
						)
					}
					container = av.body
				} else if (currentBlock instanceof ASTReturnStatement) {
					const rv = currentBlock.argument
					if (!(rv instanceof ASTFunctionStatement)) {
						throw new ExecutionError(
							this,
							currentBlock,
							`Return statement argument is not a function statement: ${rv?.constructor.name ?? "undefined"}`,
						)
					}
					container = rv.body
				} else if (currentBlock instanceof ASTBaseBlock) {
					container = currentBlock.body
				} else if (currentBlock instanceof ASTIfStatement) {
					container = currentBlock.clauses
				} else
					throw new ExecutionError(
						this,
						currentBlock,
						`Container not found for ip: ${ip.join(".")} -> ${currentBlock.constructor.name}`,
					)
				currentBlock = container![i]
				statements.push(currentBlock)
			}
			let lastStatement = statements.pop()
			if (lastStatement || ip.length <= 1) return lastStatement
			ip.pop()
			lastStatement = statements.pop()!
			if (lastStatement instanceof ASTClause) {
				ip.pop()
				this.incrementIP(ip)
			} else if (
				lastStatement instanceof ASTAssignmentStatement ||
				lastStatement instanceof ASTReturnStatement
			) {
				// function definition
				return null
			} else if (lastStatement instanceof ASTWhileStatement) {
				this.stack[0].loopStack.pop()
				return lastStatement
			} else if (lastStatement instanceof ASTForGenericStatement) {
				const forLoop = this.stack[0].loopStack[this.stack[0].loopStack.length - 1] as ForScope
				forLoop.index++
				if (forLoop.index < forLoop.iterator.length) this.stack[0].ip.push(0)
				else {
					this.stack[0].loopStack.pop()
					this.stack[0].scope = Object.getPrototypeOf(this.stack[0].scope)
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
		ip[ip.length - 1]++
	}

	private executeStatement(statement: ASTBase): ExecutionResult {
		const statementType = statement.constructor.name

		switch (statementType) {
			case "ASTAssignmentStatement":
				this.executeAssignment(statement as ASTAssignmentStatement)
				break
			case "ASTIfStatement":
				return this.executeIf(statement as ASTIfStatement)
			case "ASTWhileStatement":
				return this.executeWhile(statement as ASTWhileStatement)
			case "ASTCallStatement":
				return this.executeProcedure(statement as ASTCallStatement)
			case "ASTCallExpression":
				this.executeCall(statement as ASTCallExpression)
				break
			case "ASTReturnStatement":
				return this.executeReturn(statement as ASTReturnStatement)
			case "ASTBreakStatement":
				return this.executeBreak(statement)
			case "ASTContinueStatement":
				return this.executeContinue(statement)
			case "ASTForGenericStatement":
				return this.executeForGeneric(statement as ASTForGenericStatement)
			case "ASTImportCodeExpression":
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
					this.setVariable(expr.name, value)
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
		if (!lValue) throw new ExecutionError(this, statement.variable, "Invalid L-Value target")
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
				this.stack[0].ip.push(i)
				this.stack[0].ip.push(0)
				return { type: "branched" }
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
				this.stack[0].ip.push(0)
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
			this.stack[0].loopStack.push({ ipDepth: this.stack[0].ip.length })
			this.stack[0].ip.push(0)
			return { type: "branched" } // Continue execution in the new block
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
			this.stack.unshift(func.enterCall(evaluatedArgs))
			return { type: "branched" }
		} else if (func instanceof NativeFunctionDefinition) {
			const value = func.state(this, evaluatedArgs, statement)
			return value !== undefined ? { type: "yield", value: value } : undefined
		} else {
			throw new ExecutionError(this, statement, "Cannot call non-function value")
		}
	}

	private executeCall(statement: ASTCallExpression): MSValue {
		// Get arguments
		const args = statement.arguments
		const evaluatedArgs = args ? args.map((arg: any) => this.evaluateExpression(arg)) : []
		// Handle both func and expression properties : TODO: What was this ASTCallStatement.func?
		// Evaluate the function reference to get the function definition
		const func = this.evaluateExpression(statement.base)

		if (func instanceof FunctionDefinition) {
			this.stack.unshift(func.enterCall(evaluatedArgs))
			const result = this.execute(this.stack.length)

			switch (result.type) {
				case "yield":
					throw new ExecutionError(this, statement, "Function call cannot yield")
				case "return":
					return result.value
				case "eob":
					return undefined
			}
		} else if (func instanceof NativeFunctionDefinition) {
			return func.evaluate(this, evaluatedArgs, statement)
		} else {
			throw new ExecutionError(this, statement, "Cannot call non-function value")
		}
	}

	private executeReturn(statement: ASTReturnStatement): ExecutionResult {
		try {
			return statement.argument
				? { type: "return", value: this.evaluateExpression(statement.argument) }
				: { type: "return" }
		} finally {
			this.stack.shift()
		}
	}

	private executeContinue(statement: ASTBase): ExecutionResult {
		if (!this.stack[0].loopStack.length)
			throw new ExecutionError(this, statement, "Break/Continue statement outside of loop")
		const lastLoop = this.stack[0].loopStack[this.stack[0].loopStack.length - 1]
		this.stack[0].ip.splice(lastLoop.ipDepth)
		const loopStatement = this.getStatementByIP(this.stack[0].ip)
		this.assertAST(loopStatement, ASTBaseBlock)
		this.stack[0].ip.push(loopStatement.body.length)
		return { type: "branched" }
	}
	private executeBreak(statement: ASTBase): ExecutionResult {
		if (!this.stack[0].loopStack.length)
			throw new ExecutionError(this, statement, "Break/Continue statement outside of loop")
		this.stack[0].ip.splice(this.stack[0].loopStack.pop()!.ipDepth)
		this.incrementIP(this.stack[0].ip)
		return { type: "branched" }
	}

	private evaluateExpression(expr: ASTBase): MSValue {
		if (!expr) return undefined

		const exprType = expr.constructor.name

		const lValue = this.evaluateLValue(expr)
		if (lValue) {
			return lValue.get()
		}
		switch (exprType) {
			case "ASTNumericLiteral":
			case "ASTStringLiteral":
			case "ASTBooleanLiteral":
				return (expr as any).value
			case "ASTNilLiteral":
				return null
			case "ASTListValue":
				return this.evaluateExpression((expr as ASTListValue).value)
			case "ASTBinaryExpression":
				return this.evaluateBinaryExpression(expr as ASTBinaryExpression)
			case "ASTUnaryExpression":
				return this.evaluateUnaryExpression(expr as ASTUnaryExpression)
			case "ASTCallExpression":
				return this.executeCall(expr as ASTCallExpression)
			case "ASTFunctionStatement":
				return this.createFunction(expr as ASTFunctionStatement)
			case "ASTMapConstructorExpression":
				return this.evaluateMapConstructor(expr)
			case "ASTListConstructorExpression":
				return this.evaluateListConstructor(expr)
			case "ASTParenthesisExpression":
				return this.evaluateExpression((expr as any).expression)
			case "ASTIsaExpression":
				return this.evaluateIsaExpression(expr)
			case "ASTLogicalExpression":
				return this.evaluateLogicalExpression(expr)
			case "ASTComparisonGroupExpression":
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
			case "+":
				return left + right
			case "-":
				return left - right
			case "*":
				return left * right
			case "/":
				return left / right
			case "%":
				return left % right
			case ">":
				return left > right
			case "<":
				return left < right
			case ">=":
				return left >= right
			case "<=":
				return left <= right
			case "==":
				return left == right
			case "!=":
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
			case "not":
			case "!":
				return !argument
			case "-":
				return -argument
			case "+":
				return +argument
			default:
				throw new ExecutionError(this, expr, `Unknown unary operator: ${operator}`)
		}
	}

	private createFunction(expr: ASTBase): FunctionDefinition {
		// Find the instruction pointer for this function definition
		// Extract parameter names
		const parameters = ((expr as any).params || (expr as any).parameters || []).map(
			(param: any) => param.name,
		)

		// Return a FunctionDefinition instance
		return new FunctionDefinition([...this.stack[0].ip, 0], parameters, this.stack[0].scope)
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
			throw new ExecutionError(this, statement, "For loop iterator must be a list")
		}
		const forScope = {
			iterator,
			index: 0,
			ipDepth: this.stack[0].ip.length,
			variable,
		} as ForScope
		this.stack[0].loopStack.push(forScope)
		this.stack[0].ip.push(0)
		this.stack[0].scope = Object.setPrototypeOf({
			get [variable]() {
				return iterator[forScope.index]
			},
			set [variable](_value: any) {
				throw new ExecutionError(this, statement, `Cannot set variable ${variable} in for loop`)
			}
		}, this.stack[0].scope)
		return { type: "branched" } // Let the main loop handle execution
	}

	private executeImport(statement: ASTBase): ExecutionResult {
		throw new ExecutionError(this, statement, "Import statement not implemented")
	}

	// New expression evaluation methods
	private evaluateIsaExpression(expr: ASTBase): boolean {
		const left = this.evaluateExpression((expr as any).left)
		const right = (expr as any).right.name // Type name (number, string, boolean, map, list)

		switch (right) {
			case "number":
				return typeof left === "number"
			case "string":
				return typeof left === "string"
			case "boolean":
				return typeof left === "boolean"
			case "map":
				return left !== null && typeof left === "object" && !Array.isArray(left)
			case "list":
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
			case "and":
				return left && right
			case "or":
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
				case "<":
					comparisonOk = leftValue < rightValue
					break
				case ">":
					comparisonOk = leftValue > rightValue
					break
				case "<=":
					comparisonOk = leftValue <= rightValue
					break
				case ">=":
					comparisonOk = leftValue >= rightValue
					break
				case "==":
					comparisonOk = leftValue == rightValue
					break
				case "!=":
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
