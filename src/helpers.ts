import { parse, stringify } from "flatted"
import type { ASTBase } from "miniscript-core"
import type { MiniScriptExecutor } from "./executor"

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
	loopScopes: (LoopScope | ForScope)[]
}

export type MSValue = any
export type MSScope = Record<string, any>
/**
 * This is a class so that `instanceof` can be used to check if an object is a function definition.
 */
export class FunctionDefinition {
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
			loopScopes: [],
		}
	}
}

export interface ExecutionContext {
	statements?: Record<string, (...args: any[]) => any>
	variables?: Record<string, any>
	functions?: Record<string, any>
}

export class NativeFunctionDefinition {
	/**
	 * @param evaluation - function to evaluate the function as an expression. Returns a value to place in the expression
	 * @param statement - function to call the function as a statement. If returns a result, the result is yielded
	 */
	constructor(public name: string) {}
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

export type BranchedResult = { type: "branched" }
export type YieldResult = { type: "yield"; value: any }
export type ReturnResult = { type: "return"; value?: any }
// End of block
export type EOBResult = { type: "eob" }

export type FunctionResult = YieldResult | ReturnResult | EOBResult
export type ExecutionResult = BranchedResult | FunctionResult | undefined | void

export interface LValue {
	get(): MSValue
	set(value: MSValue): void
}

export function stringifyStack(stack: ExecutionStack[]): any {
	const stringifiedScopes = new Map<object, object>()

	function prototyped(value: object): object {
		if (!value || typeof value !== "object") return value
		if (!(value instanceof Object)) {
			if (!stringifiedScopes.has(value)) {
				const proto = Object.getPrototypeOf(value)
				stringifiedScopes.set(
					value,
					Object.create(
						proto === null ? null : prototyped(proto),
						Object.getOwnPropertyDescriptors(value),
					),
				)
			}
			return stringifiedScopes.get(value)!
		}
		return value
	}

	return stringify(stack, (key, value) => {
		if (value && typeof value === "object") {
			// Handle scope objects (non-Object instances with prototype chains)
			if (!(value instanceof Object)) {
				return prototyped(value)
			}
			// Handle function definitions - serialize as plain object for reinstantiation
			if (value instanceof FunctionDefinition) {
				return {
					__type: "FunctionDefinition",
					ip: value.ip,
					parameters: value.parameters,
					scope: prototyped(value.scope),
				}
			}
			// Handle native function definitions - serialize as plain object for reinstantiation
			if (value instanceof NativeFunctionDefinition) {
				return {
					__type: "NativeFunctionDefinition",
					name: value.name,
				}
			}
		}
		return value
	})
}

export function parseStack(serialized: any): ExecutionStack[] {
	const deserializedScopes = new Map<object, object>()

	function restorePrototype(value: object): object {
		if (!value || typeof value !== "object") return value
		if (!(value instanceof Object)) {
			if (!deserializedScopes.has(value)) {
				const proto = Object.getPrototypeOf(value)
				deserializedScopes.set(
					value,
					Object.create(
						proto === null ? null : restorePrototype(proto),
						Object.getOwnPropertyDescriptors(value),
					),
				)
			}
			return deserializedScopes.get(value)!
		}
		return value
	}

	return parse(serialized, (key, value) => {
		if (value && typeof value === "object") {
			// Restore function definitions
			if (value.__type === "FunctionDefinition") {
				return new FunctionDefinition(value.ip, value.parameters, restorePrototype(value.scope))
			}

			// Restore native function definitions
			if (value.__type === "NativeFunctionDefinition") {
				return new NativeFunctionDefinition(value.name)
			}

			// Handle scope objects (non-Object instances with prototype chains)
			if (!(value instanceof Object)) {
				return restorePrototype(value)
			}
		}
		return value
	})
}
