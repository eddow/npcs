import NpcScript from '../../src/npcs.js'
import {
	reviveExecutionState,
	serializeExecutionState,
	type StateValueHook,
} from '../../src/helpers.js'

/**
 * Round-trip helper through a real JSON boundary (as a storage layer would).
 */
function roundTrip(state: any, serializeHook?: StateValueHook, reviveHook?: StateValueHook) {
	const json = JSON.stringify(serializeExecutionState(state, serializeHook))
	return reviveExecutionState(JSON.parse(json), reviveHook)
}

function execute(script: NpcScript, context: Record<string, any>, state?: any): any {
	const result = script.execute(context, state)
	return 'state' in result ? result : { ...result, state: undefined }
}

function makeOutputContext(output: string[], extra: Record<string, any> = {}) {
	return {
		print(...args: any[]) {
			output.push(args.join(' '))
		},
		// A native call returning a non-undefined value triggers a yield in this engine.
		yield: (arg: any) => arg,
		...extra,
	}
}

describe('serializeExecutionState / reviveExecutionState', () => {
	it('round-trips a plain paused state through JSON and resumes deterministically', () => {
		const source = `
x = 10
print "before"
yield "pause"
print "after x=" + x
print "done"
`
		// Reference: continue directly with the raw (live) state.
		const rawOut: string[] = []
		const rawScript = new NpcScript(source)
		const rawFirst = execute(rawScript, makeOutputContext(rawOut))
		expect(rawFirst.type).toBe('yield')
		execute(rawScript, makeOutputContext(rawOut), rawFirst.state)

		// Serialize → JSON → revive → continue.
		const out: string[] = []
		const script = new NpcScript(source)
		const first = execute(script, makeOutputContext(out))
		expect(first.type).toBe('yield')
		const revived = roundTrip(first.state)
		const second = execute(script, makeOutputContext(out), revived)
		expect(second.type).toBe('return')
		expect(out).toEqual(rawOut)
	})

	it('serializes to a plain JSON-safe graph (no cycles, no functions)', () => {
		const script = new NpcScript('f = function(a)\n yield "p"\n return a * 2\nend function\nf 5')
		const out: string[] = []
		const first = execute(script, makeOutputContext(out))
		expect(first.type).toBe('yield')
		// JSON.stringify must succeed and contain no raw functions.
		const json = JSON.stringify(serializeExecutionState(first.state))
		expect(json).not.toContain('=>')
		expect(() => JSON.parse(json)).not.toThrow()
	})

	it('resolves native functions through the hook (caller-supplied reference)', () => {
		const source = `
function use(fn)
	yield "pause"
	fn "world"
end function
use nativeFn
`
		// NOTE: a native function that returns a non-undefined value triggers a yield in this
		// engine, so `nativeFn` must return undefined to let `use` continue to `return`.
		const out: string[] = []
		const nativeFn = (msg: string) => {
			out.push(`native:${msg}`)
		}

		const serializeHook: StateValueHook = (value) =>
			typeof value === 'function' && value === nativeFn ? { __fnRef: 'nativeFn' } : undefined
		const reviveHook: StateValueHook = (value) =>
			value && typeof value === 'object' && (value as any).__fnRef === 'nativeFn'
				? nativeFn
				: undefined

		const script = new NpcScript(source)
		const first = execute(script, makeOutputContext(out, { nativeFn }))
		expect(first.type).toBe('yield')

		const revived = roundTrip(first.state, serializeHook, reviveHook)
		const second = execute(script, makeOutputContext(out, { nativeFn }), revived)
		expect(second.type).toBe('return')
		expect(out).toEqual(['native:world'])
	})

	it('throws when a native function cannot be serialized without a hook', () => {
		const script = new NpcScript('f = nativeFn\nyield "pause"\n')
		const out: string[] = []
		const first = execute(script, makeOutputContext(out, { nativeFn: () => {} }))
		expect(first.type).toBe('yield')
		expect(() => serializeExecutionState(first.state)).toThrow(/Functions cannot be serialized/)
	})

	it('round-trips an active plan scope, substituting host objects via the hook', () => {
		const source = `
plan jobPlan
	checking allowed
	print "in plan"
	yield "pause"
	print "plan done"
end plan
print "after"
`
		const jobPlan = { id: 1 }
		const events: string[] = []
		const out: string[] = []

		const serializeHook: StateValueHook = (value) =>
			value === jobPlan ? { __gameRef: { kind: 'job', id: (value as any).id } } : undefined
		const reviveHook: StateValueHook = (value) =>
			value && typeof value === 'object' && (value as any).__gameRef?.kind === 'job'
				? jobPlan
				: undefined

		const context = makeOutputContext(out, {
			jobPlan,
			allowed: true,
			plan: {
				begin: (p: any) => events.push(`begin:${p.id}`),
				conclude: (p: any) => events.push(`conclude:${p.id}`),
				cancel: (p: any) => events.push(`cancel:${p.id}`),
				finally: (p: any) => events.push(`finally:${p.id}`),
			},
		})

		const script = new NpcScript(source)
		const first = execute(script, context)
		expect(first.type).toBe('yield')
		expect(events).toEqual(['begin:1'])

		const revived = roundTrip(first.state, serializeHook, reviveHook)
		const second = execute(script, context, revived)
		expect(second.type).toBe('return')
		expect(out).toEqual(['in plan', 'plan done', 'after'])
		expect(events).toEqual(['begin:1', 'conclude:1', 'finally:1'])
	})

	it('rebuilds the scope parent chain so closures resolve outer variables', () => {
		const source = `
outer = function()
	a = 10
	inner = function()
		b = 20
		yield "pause"
		print a + b
	end function
	inner()
end function
outer()
print "done"
`
		const rawOut: string[] = []
		const rawScript = new NpcScript(source)
		const rawFirst = execute(rawScript, makeOutputContext(rawOut))
		expect(rawFirst.type).toBe('yield')
		execute(rawScript, makeOutputContext(rawOut), rawFirst.state)

		const out: string[] = []
		const script = new NpcScript(source)
		const first = execute(script, makeOutputContext(out))
		expect(first.type).toBe('yield')

		// Verify the parent chain is rebuilt on revive (stack[0].parent -> stack[1].scope).
		const revived = roundTrip(first.state)
		const stack = (revived as any).stack
		expect(stack.length).toBe(3)
		expect(stack[0].scope.parent).toBe(stack[1].scope)
		expect(stack[1].scope.parent).toBe(stack[2].scope)
		expect(stack[2].scope.parent).toBeUndefined()

		const second = execute(script, makeOutputContext(out), revived)
		expect(second.type).toBe('return')
		expect(out).toEqual(rawOut)
	})
})
