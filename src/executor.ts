//import * as MiniScript from 'miniscript-core';

export interface ExecutionState {
	variables: Record<string, any>;
	callStack: CallFrame[];
	currentStatementIndex: number;
	source: string;
	executionPaused: boolean;
	pauseReason?: string;
}

export interface CallFrame {
	statementIndex: number;
	statements: any[];
	variables: Record<string, any>;
	parentFrame?: CallFrame;
}

export class MiniScriptExecutor {
	private variables: Map<string, any> = new Map();
	private functions: Map<string, any> = new Map();
	private callStack: CallFrame[] = [];
	private currentStatementIndex: number = 0;
	private ast: any = null;
	private source: string = '';
	private executionPaused: boolean = false;
	private pauseReason: string = '';

	constructor() {
		// Add native functions
		this.functions.set('waitTomorrow', this.createWaitTomorrowFunction());
	}

	execute(ast: any, source?: string): any {
		if (!ast || !ast.body) {
			throw new Error('Invalid AST: missing body');
		}

		this.ast = ast;
		this.source = source || '';
		this.currentStatementIndex = 0;

		// Execute each statement in the chunk
		for (let i = this.currentStatementIndex; i < ast.body.length; i++) {
			this.currentStatementIndex = i;
			const result = this.executeStatement(ast.body[i]);
			
			// Check if execution was paused
			if (this.executionPaused) {
				return result;
			}
		}
	}

	private executeStatement(statement: any): any {
		const statementType = statement.constructor.name;
		
		switch (statementType) {
			case 'ASTAssignmentStatement':
				return this.executeAssignment(statement);
			case 'ASTIfStatement':
				return this.executeIf(statement);
			case 'ASTWhileStatement':
				return this.executeWhile(statement);
			case 'ASTCallStatement':
				return this.executeCall(statement);
			case 'ASTCallExpression':
				return this.executeCall({ expression: statement });
			case 'ASTReturnStatement':
				return this.executeReturn(statement);
			case 'ASTBreakStatement':
				return this.executeBreak(statement);
			default:
				console.log(`Unknown statement type: ${statementType}`);
				return undefined;
		}
	}

	private executeAssignment(statement: any): any {
		const value = this.evaluateExpression(statement.init);
		
		// Check if this is a member expression assignment (e.g., person.age = 40)
		if (statement.variable.constructor.name === 'ASTMemberExpression') {
			const object = this.evaluateExpression(statement.variable.base);
			const property = statement.variable.identifier ? statement.variable.identifier.name : this.evaluateExpression(statement.variable.indexer);
			
			if (object && typeof object === 'object') {
				object[property] = value;
				return value;
			}
		} else {
			// Regular variable assignment
			const varName = statement.variable.name;
			this.variables.set(varName, value);
			return value;
		}
	}

	private executeIf(statement: any): any {
		if (!statement.clauses || statement.clauses.length === 0) {
			return undefined;
		}

		// Execute the first clause (if condition)
		const ifClause = statement.clauses[0];
		if (this.evaluateExpression(ifClause.condition)) {
			return this.executeBlock(ifClause.body);
		}

		// Check for else clauses
		for (let i = 1; i < statement.clauses.length; i++) {
			const clause = statement.clauses[i];
			if (clause.condition === null || this.evaluateExpression(clause.condition)) {
				return this.executeBlock(clause.body);
			}
		}

		return undefined;
	}

	private executeWhile(statement: any): any {
		while (this.evaluateExpression(statement.condition)) {
			const result = this.executeBlock(statement.body);
			if (result === 'BREAK') {
				break;
			}
		}
		return undefined;
	}

	private executeCall(statement: any): any {
		// Handle both func and expression properties
		const funcRef = statement.func || statement.expression;
		if (!funcRef) {
			throw new Error('Function call missing function reference');
		}
		
		// Handle different AST structures
		const funcName = funcRef.name || (funcRef.base && funcRef.base.name);
		
		// Check if it's a built-in function
		if (funcName === 'print') {
			return this.executePrint(statement);
		}

		// Check if it's a user-defined function
		if (this.functions.has(funcName)) {
			const func = this.functions.get(funcName);
			const args = statement.args || (statement.expression && statement.expression.arguments);
			const evaluatedArgs = args ? args.map((arg: any) => this.evaluateExpression(arg)) : [];
			return func(...evaluatedArgs);
		}

		// Check if it's a variable that contains a function
		if (this.variables.has(funcName)) {
			const func = this.variables.get(funcName);
			if (typeof func === 'function') {
				const args = statement.args || (statement.expression && statement.expression.arguments);
				const evaluatedArgs = args ? args.map((arg: any) => this.evaluateExpression(arg)) : [];
				return func(...evaluatedArgs);
			}
		}

		throw new Error(`Unknown function: ${funcName}`);
	}

	private executePrint(statement: any): void {
		// Handle both args and expression.arguments
		const args = statement.args || (statement.expression && statement.expression.arguments);
		const evaluatedArgs = args ? args.map((arg: any) => this.evaluateExpression(arg)) : [];
		console.log(...evaluatedArgs);
	}

	private executeReturn(statement: any): any {
		if (statement.argument) {
			return this.evaluateExpression(statement.argument);
		}
		return undefined;
	}

	private executeBreak(statement: any): any {
		// For now, just return a special value that can be checked
		// In a more sophisticated implementation, this would throw an exception
		// that could be caught by the loop
		return 'BREAK';
	}

	private executeBlock(statements: any[]): any {
		if (!statements) return undefined;
		
		// Create a new call frame
		const frame: CallFrame = {
			statementIndex: 0,
			statements: statements,
			variables: Object.fromEntries(this.variables.entries())
		};
		
		this.callStack.push(frame);
		
		try {
			for (let i = 0; i < statements.length; i++) {
				frame.statementIndex = i;
				const result = this.executeStatement(statements[i]);
				
				// Check if execution was paused
				if (this.executionPaused) {
					return result;
				}
				
				// Handle return statements
				if (result !== undefined && statements[i].constructor.name === 'ASTReturnStatement') {
					return result;
				}
				// Handle break statements
				if (result === 'BREAK') {
					return 'BREAK';
				}
			}
			return undefined;
		} finally {
			// Remove the call frame
			this.callStack.pop();
		}
	}

	private evaluateExpression(expr: any): any {
		if (!expr) return undefined;

		const exprType = expr.constructor.name;
		
		switch (exprType) {
			case 'ASTLiteral':
			case 'ASTNumericLiteral':
			case 'ASTStringLiteral':
			case 'ASTBooleanLiteral':
			case 'ASTMapKeyString':
			case 'ASTListValue':
				// Handle primitive types directly
				if (typeof expr.value === 'string' || typeof expr.value === 'number' || typeof expr.value === 'boolean') {
					return expr.value;
				}
				return this.evaluateExpression(expr.value);
			case 'ASTIdentifier':
				return this.variables.get(expr.name);
			case 'ASTBinaryExpression':
				return this.evaluateBinaryExpression(expr);
			case 'ASTUnaryExpression':
				return this.evaluateUnaryExpression(expr);
			case 'ASTCallExpression':
				return this.executeCall({ expression: expr });
			case 'ASTFunctionExpression':
			case 'ASTFunctionStatement':
				return this.createFunction(expr);
			case 'ASTMapConstructorExpression':
				return this.evaluateMapConstructor(expr);
			case 'ASTMemberExpression':
				return this.evaluateMemberExpression(expr);
			case 'ASTIndexExpression':
				return this.evaluateIndexExpression(expr);
			case 'ASTListConstructorExpression':
				return this.evaluateListConstructor(expr);
			case 'ASTParenthesisExpression':
				return this.evaluateExpression(expr.expression);
			default:
				console.log(`Unknown expression type: ${exprType}`);
				return undefined;
		}
	}

	private evaluateBinaryExpression(expr: any): any {
		const left = this.evaluateExpression(expr.left);
		const right = this.evaluateExpression(expr.right);
		const operator = expr.operator;

		switch (operator) {
			case '+':
				return left + right;
			case '-':
				return left - right;
			case '*':
				return left * right;
			case '/':
				return left / right;
			case '>':
				return left > right;
			case '<':
				return left < right;
			case '>=':
				return left >= right;
			case '<=':
				return left <= right;
			case '==':
				return left == right;
			case '!=':
				return left != right;
			default:
				throw new Error(`Unknown binary operator: ${operator}`);
		}
	}

	private evaluateUnaryExpression(expr: any): any {
		const operand = this.evaluateExpression(expr.operand);
		const operator = expr.operator;

		switch (operator) {
			case '!':
				return !operand;
			case '-':
				return -operand;
			default:
				throw new Error(`Unknown unary operator: ${operator}`);
		}
	}

	private createFunction(expr: any): any {
		return (...args: any[]) => {
			// Create a new scope for the function
			const oldVariables = new Map(this.variables);
			
			// Set up function parameters
			const params = expr.params || expr.parameters;
			if (params) {
				params.forEach((param: any, index: number) => {
					this.variables.set(param.name, args[index]);
				});
			}

			// Execute function body
			const result = this.executeBlock(expr.body);

			// Restore old scope
			this.variables = oldVariables;

			return result;
		};
	}

	private evaluateMapConstructor(expr: any): any {
		const obj: any = {};
		if (expr.fields) {
			expr.fields.forEach((field: any) => {
				// For ASTMapKeyString, the key is field.key.name (identifier)
				const key = field.key.name;
				const value = this.evaluateExpression(field.value);
				obj[key] = value;
			});
		}
		return obj;
	}

	private evaluateMemberExpression(expr: any): any {
		const object = this.evaluateExpression(expr.base);
		const property = expr.identifier ? expr.identifier.name : this.evaluateExpression(expr.indexer);
		
		if (object && typeof object === 'object') {
			return object[property];
		}
		return undefined;
	}

	private evaluateIndexExpression(expr: any): any {
		const object = this.evaluateExpression(expr.base);
		const index = this.evaluateExpression(expr.index);
		
		if (object && (Array.isArray(object) || typeof object === 'object')) {
			return object[index];
		}
		return undefined;
	}

	private evaluateListConstructor(expr: any): any {
		const arr: any[] = [];
		if (expr.fields) {
			expr.fields.forEach((field: any) => {
				arr.push(this.evaluateExpression(field));
			});
		}
		return arr;
	}

	// Helper method to get variable value
	getVariable(name: string): any {
		return this.variables.get(name);
	}

	// Helper method to set variable value
	setVariable(name: string, value: any): void {
		this.variables.set(name, value);
	}

	// Native function that pauses execution
	private createWaitTomorrowFunction(): Function {
		return (...args: any[]) => {
			this.executionPaused = true;
			this.pauseReason = 'waitTomorrow called';
			
			// Serialize and print the execution state
			const state = this.serializeState();
			console.log('EXECUTION PAUSED - State serialized:');
			console.log(JSON.stringify(state, null, 2));
			
			return 'EXECUTION_PAUSED';
		};
	}

	// Serialize the current execution state
	serializeState(): ExecutionState {
		return {
			variables: this.serializeVariables(),
			callStack: this.serializeCallStack(),
			currentStatementIndex: this.currentStatementIndex,
			source: this.source,
			executionPaused: this.executionPaused,
			pauseReason: this.pauseReason
		};
	}

	// Serialize variables, handling functions specially
	private serializeVariables(): Record<string, any> {
		const serialized: Record<string, any> = {};
		
		for (const [key, value] of this.variables.entries()) {
			if (typeof value === 'function') {
				// For functions, we need to create a reference
				serialized[key] = {
					__type: 'function',
					__reference: this.getFunctionReference(value)
				};
			} else {
				serialized[key] = value;
			}
		}
		
		return serialized;
	}

	// Serialize call stack
	private serializeCallStack(): CallFrame[] {
		return this.callStack.map(frame => ({
			statementIndex: frame.statementIndex,
			statements: frame.statements.map(stmt => ({
				type: stmt.type || stmt.constructor.name,
				start: stmt.start,
				end: stmt.end
			})),
			variables: this.serializeVariablesFromMap(new Map(Object.entries(frame.variables))),
			parentFrame: frame.parentFrame
		}));
	}

	// Helper to serialize variables from a Map
	private serializeVariablesFromMap(vars: Map<string, any>): Record<string, any> {
		const serialized: Record<string, any> = {};
		
		for (const [key, value] of vars.entries()) {
			if (typeof value === 'function') {
				serialized[key] = {
					__type: 'function',
					__reference: this.getFunctionReference(value)
				};
			} else {
				serialized[key] = value;
			}
		}
		
		return serialized;
	}

	// Get a reference for a function (simplified for now)
	private getFunctionReference(func: Function): string {
		// In a real implementation, this would be more sophisticated
		// For now, we'll use a simple approach
		return `function_${func.toString().slice(0, 50)}`;
	}

	// Serialize AST without circular references
	private serializeAST(ast: any): any {
		if (!ast) return null;
		
		// Create a simple representation of the AST
		return {
			type: ast.type || ast.constructor.name,
			body: ast.body ? ast.body.map((stmt: any) => ({
				type: stmt.type || stmt.constructor.name,
				// Add minimal info needed for resumption
				start: stmt.start,
				end: stmt.end
			})) : undefined
		};
	}

	// Restore execution state
	restoreState(state: ExecutionState, MiniScript?: any): void {
		this.variables = new Map(Object.entries(state.variables));
		this.currentStatementIndex = state.currentStatementIndex;
		this.source = state.source;
		this.executionPaused = state.executionPaused;
		this.pauseReason = state.pauseReason || '';
		
		// Re-parse the source to get the AST
		if (this.source && MiniScript) {
			const lexer = new MiniScript.Lexer(this.source);
			const parser = new MiniScript.Parser(this.source, { lexer });
			this.ast = parser.parseChunk();
		}
		
		// Restore call stack (simplified - we'll rebuild it during execution)
		this.callStack = [];
		
		// Restore functions (simplified for now)
		this.functions.set('waitTomorrow', this.createWaitTomorrowFunction());
	}

	// Resume execution from current state
	resume(): any {
		if (!this.executionPaused) {
			throw new Error('Execution is not paused');
		}
		
		this.executionPaused = false;
		this.pauseReason = '';
		
		// Continue execution from current statement
		if (this.ast && this.ast.body) {
			for (let i = this.currentStatementIndex + 1; i < this.ast.body.length; i++) {
				this.currentStatementIndex = i;
				const result = this.executeStatement(this.ast.body[i]);
				
				// Check if execution was paused again
				if (this.executionPaused) {
					return result;
				}
			}
		}
	}
}
