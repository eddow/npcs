
import { 
	ASTAssignmentStatement,
	type ASTBase,
	ASTBaseBlock,
	ASTBinaryExpression,
	ASTCallExpression,
	ASTCallStatement,
	ASTChunk,
	ASTClause,
	ASTComparisonGroupExpression,
	ASTElseClause,
	ASTForGenericStatement,
	ASTFunctionStatement,
	ASTIdentifier,
	ASTIfClause,
	ASTIfStatement,
	ASTIndexExpression,
	ASTListValue,
	ASTLiteral,
	ASTMapKeyString,
	ASTMemberExpression,
	ASTReturnStatement,
	ASTUnaryExpression,
	ASTWhileStatement
} from "miniscript-core"

export class ExecutionError extends Error {
	constructor(public executor: MiniScriptExecutor, public statement: ASTBase, message: string) {
		super(message)
		this.name = 'ExecutionError'
	}
	public toString(): string {
		return `ExecutionError: ${this.message}\n` +
			this.executor.sourceLocation(this.statement)
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
export interface ExecutionScope {
	variables: Record<string, any>
	ip: IP
	loopStack: (LoopScope | ForScope)[]
}

type MSValue = any
/**
 * This is a class so that `instanceof` can be used to check if an object is a function definition.
 */
class FunctionDefinition {
	constructor(public ip: IP, public parameters: string[]) {}
	enterCall(args: any[]): ExecutionScope {
		const variables = {} as Record<string, MSValue>
		for(let i = 0; i < this.parameters.length; i++) {
			variables[this.parameters[i]] = args[i]
		}
		return {
			variables,
			ip: [...this.ip],
			loopStack: []
		}
	}
}

class NativeFunctionDefinition {
	private evaluation?: (...args: any[]) => any
	private statement?: (...args: any[]) => any
	/**
	 * @param evaluation - function to evaluate the function as an expression. Returns a value to place in the expression
	 * @param statement - function to call the function as a statement. If returns a result, the result is yielded
	 */
	constructor({
		evaluation, statement
	}: {
		evaluation?: (args: any[]) => any,
		statement?: (args: any[]) => any
	} = {}) {
		this.evaluation = evaluation
		this.statement = statement
	}
	evaluate(executor: MiniScriptExecutor, args: any[], statement: ASTBase): MSValue {
		if(!this.evaluation) throw new ExecutionError(executor, statement, "Native function definition has no evaluation function")
		return this.evaluation(...args)
	}
	state(executor: MiniScriptExecutor, args: any[], statement: ASTBase): FunctionResult {
		if(!this.statement) throw new ExecutionError(executor, statement, "Native function definition has no statement function")
		return this.statement(...args)
	}
}
type BranchedResult = { type: 'branched' }
type YieldResult = { type: 'yield', value: any }
type ReturnResult = { type: 'return', value?: any }
// End of block
type EOBResult = { type: 'eob' }

type FunctionResult = YieldResult | ReturnResult | EOBResult
type ExecutionResult = BranchedResult | FunctionResult | undefined | void

interface LValue {
	get(): MSValue
	set(value: MSValue): void
}

export class MiniScriptExecutor {
	public assertAST<E extends ASTBase>(
		expr: ASTBase, ctor: new (...args: any[]) => E, expectedName?: string
	): asserts expr is E {
		if(!(expr instanceof ctor)) {
			const name = expectedName || (ctor as any).name || 'expected type'
			throw new ExecutionError(this, expr, `Expected ${name}, got ${expr.constructor.name}`)
		}
	}
	public sourceLocation(expr: ASTBase): string {
		const source = this.source
		if(!source || !expr.start) return ""
		const lines = source.split("\n")
		const lineIdx = expr.start.line - 1
		const colIdx = Math.max(1, expr.start.character)
		const lineText = lines[lineIdx] ?? ""
		// Build a caret line positioning a ^ under the designated character
		const caretIndent = ' '.repeat(colIdx - 1)
		const caretLine = `${caretIndent}^`
		return `${expr.start.line}:${expr.start.character}\n${lineText}\n${caretLine}`
	}
	get scope(): ExecutionScope {
		return this.scopes[0]
	}
	static rootScope(
		variables: Record<string, any>,
		statements: Record<string, any> = {},
		functions: Record<string, any> = {}
	): ExecutionScope {
		variables = { ...variables }
		for(const [name, value] of Object.entries(statements)) {
			variables[name] = new NativeFunctionDefinition({statement: value})
		}
		for(const [name, value] of Object.entries(functions)) {
			variables[name] = new NativeFunctionDefinition({evaluation: value})
		}
		return {
			variables,
			ip: [0],
			loopStack: []
		}
	}
	static emptyScope(): ExecutionScope {
		return {
			variables: {},
			ip: [0],
			loopStack: []
		}
	}
	constructor(private ast: any, public scopes: ExecutionScope[] = [], private source?: string) {
		if(scopes.length === 0) scopes = [MiniScriptExecutor.rootScope({})]
		if(scopes.length < 2) scopes.push(MiniScriptExecutor.emptyScope())
	}

	// Variable access methods
	private getVariable(name: string): any {
		for(const loop of this.scope.loopStack) {
			if('variable' in loop && loop.variable === name) {
				return loop.iterator[loop.index]
			}
		}
		for(const scope of this.scopes) {
			if(name in scope.variables) {
				return scope.variables[name]
			}
		}
		return undefined
	}

	private setVariable(name: string, value: any, statement: ASTBase): void {
		for(const loop of this.scope.loopStack) {
			if('variable' in loop && loop.variable === name) {
				throw new ExecutionError(this, statement, "Cannot set variable in for loop")
			}
		}
		for(let i = this.scopes.length - 1; i >= 0; i--) {
			if(name in this.scopes[i].variables) {
				this.scopes[i].variables[name] = value
				return
			}
		}
		this.scopes[0].variables[name] = value
	}

	// Main execution entry point
	execute(enteringScopeDepth: number = 2): FunctionResult {
		while (true) {
			// Get current statement from IP
			const statement = this.getStatementByIP(this.scope.ip)
			// Execute the current statement
			const result = statement ? this.executeStatement(statement) : {type: 'eob'}
			if(result) switch(result.type) {
				case 'eob':
					this.scopes.shift()
				case 'return':
					if(this.scopes.length < enteringScopeDepth)
						return result as ReturnResult
					this.incrementIP(this.scope.ip)
					break
				case 'yield':
					this.incrementIP(this.scope.ip)
					return result as YieldResult
				case 'branched':
					break
				default:
					throw new ExecutionError(this, statement, `Unknown result type: ${result.type}`)
			} else this.incrementIP(this.scope.ip)
		}
	}

	// Get statement by instruction pointer
	private getStatementByIP(ip: IP): any {
		if (ip.length === 0) {
			return null
		}
		while(true) {
			const statements = [] as ASTBase[]
			let currentBlock = this.ast
			let container: ASTBase[]|undefined
			for(const i of ip) {
				if(currentBlock instanceof ASTAssignmentStatement) {
					const av = (currentBlock as ASTAssignmentStatement).init
					if(!(av instanceof ASTFunctionStatement)) {
						throw new ExecutionError(this, currentBlock, `Assignment statement init is not a function statement: ${av.constructor.name}`)
					}
					container = av.body
				} else if(currentBlock instanceof ASTBaseBlock) {
					container = currentBlock.body
				} else if(currentBlock instanceof ASTIfStatement) {
					container = currentBlock.clauses
				} else
					throw new ExecutionError(this, currentBlock, `Container not found for ip: ${ip.join(".")} -> ${currentBlock.constructor.name}`)
				currentBlock = container![i]
				statements.push(currentBlock)
			}
			let lastStatement = statements.pop()
			if(lastStatement || ip.length <= 1) return lastStatement
			ip.pop()
			lastStatement = statements.pop()!
			if(lastStatement instanceof ASTClause) {
				ip.pop()
				this.incrementIP(ip)
			} else if(lastStatement instanceof ASTAssignmentStatement) {
				// function definition
				return null
			} else if(lastStatement instanceof ASTWhileStatement) {
				this.scope.loopStack.pop()
				return lastStatement
			} else if(lastStatement instanceof ASTForGenericStatement) {
				const forLoop = this.scope.loopStack[this.scope.loopStack.length - 1] as ForScope
				forLoop.index++
				if(forLoop.index < forLoop.iterator.length)
					this.scope.ip.push(0)
				else {
					this.scope.loopStack.pop()
					this.incrementIP(ip)
				}
			} else {
				throw new ExecutionError(this, lastStatement, `Unknown loop statement type: ${lastStatement.constructor.name}`)
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
		if(expr instanceof ASTIdentifier)
			return {
				get: () => this.getVariable(expr.name),
				set: (value: MSValue) => {
					this.setVariable(expr.name, value, expr)
				}
			}
		let base: any
		let index: any
		if(expr instanceof ASTMemberExpression) {
			base = this.evaluateExpression(expr.base)
			this.assertAST(expr.identifier, ASTIdentifier)
			index = expr.identifier.name
		} else if(expr instanceof ASTIndexExpression) {
			base = this.evaluateExpression(expr.base)
			index = this.evaluateExpression(expr.index)
		} else {
			return false
		}
		return {
			get: () => base[index],
			set: (value: MSValue) => {
				base[index] = value
			}
		}
	}
	private executeAssignment(statement: ASTAssignmentStatement): ExecutionResult {
		// Check if this is a member expression assignment (e.g., person.age = 40)
		const lValue = this.evaluateLValue(statement.variable)
		if(!lValue) throw new ExecutionError(this, statement.variable, "Invalid L-Value target")
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
				this.scope.ip.push(i)
				this.scope.ip.push(0)
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
				this.scope.ip.push(0)
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
			this.scope.loopStack.push({ ipDepth: this.scope.ip.length })
			this.scope.ip.push(0)
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

		if(func instanceof FunctionDefinition) {
			this.scopes.unshift(func.enterCall(evaluatedArgs))
			return { type: 'branched' }
		} else if(func instanceof NativeFunctionDefinition) {
			const value = func.state(this, evaluatedArgs, statement)
			return value !== undefined ? { type: 'yield', value: value } : undefined
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


		if(func instanceof FunctionDefinition) {
			this.scopes.unshift(func.enterCall(evaluatedArgs))
			const result = this.execute(this.scopes.length)
			
			switch(result.type) {
				case 'yield':
					throw new ExecutionError(this, statement, "Function call cannot yield")
				case 'return':
					return result.value
				case 'eob':
					return undefined
				default:
					throw new ExecutionError(this, statement, "Unknown function call result type: ${result.type}")
			}
		} else if(func instanceof NativeFunctionDefinition) {
			return func.evaluate(this, evaluatedArgs, statement)
		} else {
			throw new ExecutionError(this, statement, "Cannot call non-function value")
		}
	}

	private executeReturn(statement: ASTReturnStatement): ExecutionResult {
		try {
			let value: any
			if(statement.argument) {
				value = this.evaluateExpression(statement.argument)
			}

			return statement.argument ?
				{ type: 'return', value: this.evaluateExpression(statement.argument) } :
				{ type: 'return' }
		} finally {
			this.scopes.shift()
		}
	}


	private executeContinue(statement: ASTBase): ExecutionResult {
		if(!this.scope.loopStack.length)
			throw new ExecutionError(this, statement, "Break/Continue statement outside of loop")
		const lastLoop = this.scope.loopStack[this.scope.loopStack.length - 1]
		this.scope.ip.splice(lastLoop.ipDepth)
		const loopStatement = this.getStatementByIP(this.scope.ip)
		this.assertAST(loopStatement, ASTBaseBlock)
		this.scope.ip.push(loopStatement.body.length)
		return { type: 'branched' }
	}
	private executeBreak(statement: ASTBase): ExecutionResult {
		if(!this.scope.loopStack.length)
			throw new ExecutionError(this, statement, "Break/Continue statement outside of loop")
		this.scope.ip.splice(this.scope.loopStack.pop()!.ipDepth)
		this.incrementIP(this.scope.ip)
		return { type: 'branched' }
	}

	private evaluateExpression(expr: ASTBase): MSValue {
		if (!expr) return undefined

		const exprType = expr.constructor.name

		const lValue = this.evaluateLValue(expr)
		if(lValue) {
			return lValue.get()
		}
		switch (exprType) {
			case "ASTNumericLiteral":
			case "ASTStringLiteral":
			case "ASTBooleanLiteral":
				return (expr as any).value
			case "ASTNilLiteral":
				return null
			case "ASTMapKeyString":
				let m: ASTMapKeyString = expr as ASTMapKeyString
				debugger
				throw new Error('not implemented')
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
		const parameters = ((expr as any).params || (expr as any).parameters || []).map((param: any) => param.name)

		// Return a FunctionDefinition instance
		return new FunctionDefinition([...this.scope.ip, 0], parameters)
	}

	private evaluateMapConstructor(expr: ASTBase): any {
		const obj: any = {}
		if ((expr as any).fields) {
			(expr as any).fields.forEach((field: any) => {
				// For ASTMapKeyString, the key is field.key.name (identifier)
				const key = field.key.name
				const value = this.evaluateExpression(field.value)
				obj[key] = value
			})
		}
		return obj
	}

	private evaluateMemberExpression(expr: ASTBase): any {
		const object = this.evaluateExpression((expr as any).base)
		// TODO redo me
		const property = (expr as any).identifier ? (expr as any).identifier.name : this.evaluateExpression((expr as any).indexer)

		// Special handling for built-in properties
		if (property === "len" && Array.isArray(object)) {
			return object.length
		}
		if (property === "keys" && object && typeof object === "object" && !Array.isArray(object)) {
			return Object.keys(object)
		}

		if (object && typeof object === "object") {
			return object[property]
		}
		return undefined
	}

	private evaluateIndexExpression(expr: ASTBase): any {
		const object = this.evaluateExpression((expr as any).base)
		const index = this.evaluateExpression((expr as any).index)

		if (object && (Array.isArray(object) || typeof object === "object")) {
			return object[index]
		}
		return undefined
	}

	private evaluateListConstructor(expr: ASTBase): any {
		const arr: any[] = []
		if ((expr as any).fields) {
			(expr as any).fields.forEach((field: any) => {
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
		this.scope.loopStack.push({ iterator, index: 0, ipDepth: this.scope.ip.length, variable } as ForScope)
		this.scope.ip.push(0)
		return { type: 'branched' } // Let the main loop handle execution
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
					throw new ExecutionError(this, expr as unknown as ASTBase, `Unknown comparison operator: ${operator}`)
			}
			if (!comparisonOk) return false
			leftValue = rightValue
		}
		return true
	}
}
