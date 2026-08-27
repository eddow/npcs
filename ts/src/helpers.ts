import type { ScriptExecutor } from './executor'
import type { ASTBase } from './script'

export class ExecutionError extends Error {
	public error?: Error
	public context?: Record<string, unknown>
	constructor(
		public executor: ScriptExecutor,
		public statement: ASTBase,
		message: string | Error,
	) {
		super(typeof message === 'string' ? message : message.message)
		this.error = typeof message === 'string' ? undefined : message
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

export interface DoWhileScope extends LoopScope {
	occurrences: number
}

export interface ForScope extends LoopScope {
	iterator: MSValue[]
	index: number
	variable: string
}
export interface ExecutionStackEntry {
	scope: MSScope
	ip: IP
	loopScopes: (LoopScope | ForScope | DoWhileScope)[]
	evaluatedCache?: Record<number, any>
	targetReturn?: number
}

// TODO: all optional properties
export interface PlanScope {
	ipDepth: number
	stackDepth: number
	planIP: IP
	checkStates: PlanCheckState[]
}

export interface PlanCheckState {
	descriptionOnEnter?: any
}

export interface PlanInterruptionReason {
	type: 'checking_failed'
	phase: 'enter' | 'resume'
	checkIndex: number
	condition: string
	descriptionOnEnter?: any
	descriptionOnFailure?: any
}

export type ExecutionState = {
	stack: ExecutionStackEntry[]
	plans: Array<{
		planValue: any
		savedState: PlanScope
	}>
}

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
		public parameterDefaults: any[] = [],
	) {}
	enterCall(args: any[], targetReturn?: number): ExecutionStackEntry {
		const variables: Record<string, any> = {}
		for (let i = 0; i < this.parameters.length; i++) {
			variables[this.parameters[i]] = args[i] !== undefined ? args[i] : this.parameterDefaults[i]
		}
		return stack({
			scope: { variables, parent: this.scope },
			ip: { indexes: [0], functionIndex: this.index },
			targetReturn,
		})
	}
	call(args: any[]): ExecutionState {
		return { stack: [this.enterCall(args)], plans: [] }
	}
}
export type ExecutionContext = Record<string, any>

export type BranchedResult = { type: 'branched' }
export type FunctionResult = { type: 'return' | 'yield'; value?: any }
export type ExecutionResult = BranchedResult | FunctionResult | undefined | void

export interface LValue {
	get(): MSValue
	set(value: MSValue): void
}

export function serializeState(_key: string, value: any) {
	if (typeof value === 'function') {
		throw new Error(`Not implemented: Functions cannot be serialized
In order to have native functions in the serialized state (in variables or used as parameters),
	a custom (de)serializer has to be provided`)
	}
	if (value && typeof value === 'object') {
		// Handle function definitions - serialize as plain object for reinstantiation
		if (value instanceof FunctionDefinition) {
			return {
				__type: 'FunctionDefinition',
				index: value.index,
				parameters: value.parameters,
				scope: value.scope,
				parameterDefaults: value.parameterDefaults,
			}
		}
	}
	return value
}

export function reviveState(_key: string, value: any) {
	if (value && typeof value === 'object') {
		// Restore function definitions
		if (value.__type === 'FunctionDefinition') {
			return new FunctionDefinition(
				value.index,
				value.parameters,
				value.scope,
				value.parameterDefaults ?? [],
			)
		}
	}
	return value
}

/**
 * A hook the host provides to (de)serialize values npc-script cannot handle
 * natively: native functions and host objects (e.g. game-world references).
 *
 * Return a non-`undefined` value to take ownership of `value` — produce a token
 * during serialization, or a live value during revival. Return `undefined` to
 * fall through to npc-script's default handling.
 */
export type StateValueHook = (value: unknown) => unknown

function serializeStackEntry(
	entry: ExecutionStackEntry,
	serializeValue: (value: unknown) => unknown
): Record<string, unknown> {
	const out: Record<string, unknown> = {
		scope: serializeValue(entry.scope),
		ip: { indexes: [...entry.ip.indexes], functionIndex: entry.ip.functionIndex },
		loopScopes: serializeValue(entry.loopScopes),
	}
	if (entry.targetReturn !== undefined) out.targetReturn = entry.targetReturn
	if (entry.evaluatedCache !== undefined) out.evaluatedCache = serializeValue(entry.evaluatedCache)
	return out
}

function serializePlanScope(
	savedState: PlanScope,
	serializeValue: (value: unknown) => unknown
): Record<string, unknown> {
	return {
		ipDepth: savedState.ipDepth,
		stackDepth: savedState.stackDepth,
		planIP: {
			functionIndex: savedState.planIP.functionIndex,
			indexes: [...savedState.planIP.indexes],
		},
		checkStates: serializeValue(savedState.checkStates),
	}
}

/**
 * Serialize an {@link ExecutionState} into a plain, JSON-stringifiable object
 * graph. Native functions and host objects are delegated to `hook`.
 *
 * Reference tracking: object identity is preserved through a `{ __ref: n }` token.
 * The first occurrence of a shared / cyclic object is inlined; every later one
 * becomes a reference token. This breaks the cycles inherent to the state
 * (`scope.parent` back-links and `FunctionDefinition.scope` closures) and dedups
 * shared references, so the result is an acyclic, JSON-safe DAG.
 */
export function serializeExecutionState(
	state: ExecutionState,
	hook?: StateValueHook
): Record<string, unknown> {
	// Live object → ref index. First occurrence inlined; later ones become `__ref`.
	const seen = new Map<object, number>()
	const refs: unknown[] = []

	const serializeValue = (value: unknown): unknown => {
		if (value === null || value === undefined) return value

		if (value instanceof FunctionDefinition) {
			const existing = seen.get(value)
			if (existing !== undefined) return { __ref: existing }
			const idx = refs.length
			seen.set(value, idx)
			const token: Record<string, unknown> = {
				__type: 'FunctionDefinition',
				index: value.index,
				parameters: value.parameters,
			}
			refs.push(token)
			token.scope = serializeValue(value.scope)
			token.parameterDefaults = value.parameterDefaults.map(serializeValue)
			return token
		}

		if (typeof value === 'function') {
			if (hook) {
				const handled = hook(value)
				if (handled !== undefined) return handled
			}
			throw new Error(`Not implemented: Functions cannot be serialized
In order to have native functions in the serialized state (in variables or used as parameters),
	a custom (de)serializer has to be provided`)
		}

		if (typeof value === 'object') {
			if (hook) {
				const handled = hook(value)
				if (handled !== undefined) return handled
			}
			const existing = seen.get(value)
			if (existing !== undefined) return { __ref: existing }
			const idx = refs.length
			seen.set(value, idx)
			if (Array.isArray(value)) {
				const arr: unknown[] = []
				refs.push(arr)
				for (const v of value) arr.push(serializeValue(v))
				return arr
			}
			const obj: Record<string, unknown> = {}
			refs.push(obj)
			for (const key of Object.keys(value)) obj[key] = serializeValue((value as any)[key])
			return obj
		}

		return value
	}

	return {
		stack: state.stack.map((entry) => serializeStackEntry(entry, serializeValue)),
		plans: state.plans.map((plan) => ({
			planValue: serializeValue(plan.planValue),
			savedState: serializePlanScope(plan.savedState, serializeValue),
		})),
	}
}

function revivePlanScope(savedState: Record<string, unknown>, reviveValue: (value: unknown) => unknown): PlanScope {
	return {
		ipDepth: savedState.ipDepth as number,
		stackDepth: savedState.stackDepth as number,
		planIP: savedState.planIP as IP,
		checkStates: reviveValue(savedState.checkStates) as PlanCheckState[],
	}
}

/**
 * Revive a serialized execution-state object graph back into an {@link ExecutionState}.
 * `hook` resolves native-function / host-object tokens; the fresh execution context
 * is supplied by the caller (captured by `hook`) and is never serialized.
 */
export function reviveExecutionState(
	data: Record<string, unknown>,
	hook?: StateValueHook
): ExecutionState {
	// Ref index → revived object. Slots are allocated *before* recursing so cyclic
	// `{ __ref }` tokens resolve back to the in-progress container.
	const refs: unknown[] = []

	const reviveValue = (value: unknown): unknown => {
		if (value === null || value === undefined) return value
		if (typeof value !== 'object') return value

		if (hook) {
			const handled = hook(value)
			if (handled !== undefined) return handled
		}

		const ref = (value as { __ref?: number }).__ref
		if (typeof ref === 'number') return refs[ref]

		if ((value as { __type?: string }).__type === 'FunctionDefinition') {
			const idx = refs.length
			const fd = new FunctionDefinition(0, [], {} as MSScope, [])
			refs.push(fd)
			fd.index = (value as any).index
			fd.parameters = (value as any).parameters
			fd.scope = reviveValue((value as any).scope) as MSScope
			fd.parameterDefaults = ((value as any).parameterDefaults ?? []).map(reviveValue)
			return fd
		}

		if (Array.isArray(value)) {
			const idx = refs.length
			const arr: unknown[] = []
			refs.push(arr)
			for (const v of value) arr.push(reviveValue(v))
			return arr
		}

		const idx = refs.length
		const obj: Record<string, unknown> = {}
		refs.push(obj)
		for (const key of Object.keys(value)) obj[key] = reviveValue((value as any)[key])
		return obj
	}

	return {
		stack: (data.stack as Record<string, unknown>[]).map((entry) => {
			const out: ExecutionStackEntry = {
				scope: reviveValue(entry.scope) as MSScope,
				ip: entry.ip as IP,
				loopScopes: reviveValue(entry.loopScopes) as ExecutionStackEntry['loopScopes'],
			}
			if (entry.targetReturn !== undefined) out.targetReturn = entry.targetReturn as number
			if (entry.evaluatedCache !== undefined)
				out.evaluatedCache = reviveValue(entry.evaluatedCache) as Record<number, any>
			return out
		}),
		plans: (data.plans as Record<string, unknown>[]).map((plan) => ({
			planValue: reviveValue(plan.planValue),
			savedState: revivePlanScope(plan.savedState as Record<string, unknown>, reviveValue),
		})),
	}
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
}

export type IsaTypes = Record<string, (value: any) => boolean>

export const jsIsaTypes: IsaTypes = {
	number: (value) => typeof value === 'number',
	string: (value) => typeof value === 'string',
	boolean: (value) => typeof value === 'boolean',
	map: (value) => value !== null && typeof value === 'object' && !Array.isArray(value),
	list: (value) => Array.isArray(value),
}

export type Callable = FunctionDefinition | Function
export function isCallable(value: any): value is Callable {
	return value instanceof FunctionDefinition || typeof value === 'function'
}
