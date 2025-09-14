import type { ASTBase } from 'miniscript-core'
import type { MiniScriptExecutor } from './executor'

export class ExecutionError extends Error {
	constructor(
		public executor: MiniScriptExecutor,
		public statement: ASTBase,
		message: string,
	) {
		super(message)
		this.name = 'ExecutionError'
	}
	public toString(): string {
		return `ExecutionError: ${this.message}\n${this.executor.script.sourceLocation(this.statement)}`
	}
}

export type IP = {
	indexes: number[]
	functionIndex?: number
}

export interface LoopScope {
	ipDepth: number
}

export interface ForScope extends LoopScope {
	iterator: MSValue[]
	index: number
	variable: string
}
export interface ExecutionStackEntry {
	scope: MSScope
	ip: IP
	loopScopes: (LoopScope | ForScope)[]
	evaluatedCache?: Record<number, any>
	targetReturn?: number
}

export type ExecutionState = ExecutionStackEntry[]

export function stack(partial: Partial<ExecutionStackEntry> = {}): ExecutionStackEntry {
	return {
		scope: { variables: {} },
		ip: { indexes: [0], functionIndex: undefined },
		loopScopes: [],
		...partial,
	}
}

export type MSValue = any
export type MSScope = {
	variables: Record<string, any>
	parent?: MSScope
}
/**
 * This is a class so that `instanceof` can be used to check if an object is a function definition.
 */
export class FunctionDefinition {
	constructor(
		public index: number,
		public parameters: string[],
		public scope: MSScope,
	) {}
	enterCall(args: any[], targetReturn?: number): ExecutionStackEntry {
		const variables = {}
		for (let i = 0; i < this.parameters.length; i++) {
			variables[this.parameters[i]] = args[i]
		}
		return stack({
			scope: { variables, parent: this.scope },
			ip: { indexes: [0], functionIndex: this.index },
			targetReturn,
		})
	}
	call(args: any[]): ExecutionState {
		return [this.enterCall(args)]
	}
}

export type ExecutionContext = Record<string, any>

export class NativeFunctionDefinition {
	/**
	 * @param evaluation - function to evaluate the function as an expression. Returns a value to place in the expression
	 * @param statement - function to call the function as a statement. If returns a result, the result is yielded
	 */
	constructor(public name: string) {}
	evaluate(executor: MiniScriptExecutor, args: any[], ast: ASTBase): MSValue {
		const evaluation = executor.context[this.name]
		if (!evaluation) throw new ExecutionError(executor, ast, 'Native value not found')
		if (typeof evaluation !== 'function')
			throw new ExecutionError(executor, ast, `Native value ${this.name} is not a function`)
		return evaluation.apply(executor.context, args)
	}
}

export type BranchedResult = { type: 'branched' }
export type FunctionResult = { type: 'return' | 'yield'; value?: any }
export type ExecutionResult = BranchedResult | FunctionResult | undefined | void

export interface LValue {
	get(): MSValue
	set(value: MSValue): void
}

export function serializeState(_key, value) {
	if (value && typeof value === 'object') {
		// Handle function definitions - serialize as plain object for reinstantiation
		if (value instanceof FunctionDefinition) {
			return {
				__type: 'FunctionDefinition',
				index: value.index,
				parameters: value.parameters,
				scope: value.scope,
			}
		}
		// Handle native function definitions - serialize as plain object for reinstantiation
		if (value instanceof NativeFunctionDefinition) {
			return {
				__type: 'NativeFunctionDefinition',
				name: value.name,
			}
		}
	}
	return value
}

export function reviveState(_key, value) {
	if (value && typeof value === 'object') {
		// Restore function definitions
		if (value.__type === 'FunctionDefinition') {
			return new FunctionDefinition(value.index, value.parameters, value.scope)
		}

		// Restore native function definitions
		if (value.__type === 'NativeFunctionDefinition') {
			return new NativeFunctionDefinition(value.name)
		}
	}
	return value
}

export interface Operators {
	'+'(left: any, right: any): any
	'-'(left: any, right: any): any
	'*'(left: any, right: any): any
	'/'(left: any, right: any): any
	'%'(left: any, right: any): any
	'>'(left: any, right: any): any
	'<'(left: any, right: any): any
	'>='(left: any, right: any): any
	'<='(left: any, right: any): any
	'=='(left: any, right: any): any
	'!='(left: any, right: any): any
	'!.'(argument: any): any
	'-.'(argument: any): any
	'+.'(argument: any): any
	and(left: any, right: any): any
	or(left: any, right: any): any
}

export const jsOperators: Operators = {
	'+': (left, right) => left + right,
	'-': (left, right) => left - right,
	'*': (left, right) => left * right,
	'/': (left, right) => left / right,
	'%': (left, right) => left % right,
	'>': (left, right) => left > right,
	'<': (left, right) => left < right,
	'>=': (left, right) => left >= right,
	'<=': (left, right) => left <= right,
	// biome-ignore-start lint/suspicious/noDoubleEquals: We keep it fuzzy for npc-s
	'==': (left, right) => left == right,
	'!=': (left, right) => left != right,
	// biome-ignore-end lint/suspicious/noDoubleEquals: We keep it fuzzy for npc-s
	'!.': (argument) => !argument,
	'-.': (argument) => -argument,
	'+.': (argument) => +argument,
	and: (left, right) => left && right,
	or: (left, right) => left || right,
}

export type IsaTypes = Record<string, (value: any) => boolean>

export const jsIsaTypes: IsaTypes = {
	number: (value) => typeof value === 'number',
	string: (value) => typeof value === 'string',
	boolean: (value) => typeof value === 'boolean',
	map: (value) => value !== null && typeof value === 'object' && !Array.isArray(value),
	list: (value) => Array.isArray(value),
}
