import type { FunctionResult } from '../../src/helpers.js'
import NpcScript from '../../src/npcs.js'

function executeScript(
	script: NpcScript,
	context: Record<string, any>,
	state?: any,
): FunctionResult & { state?: any } {
	const result = script.execute(context, state)
	return 'state' in result ? result : { ...result, state: undefined }
}

describe('Plan checking execution', () => {
	it('requires all checking clauses to pass before entering the plan body', () => {
		const output: string[] = []
		const events: string[] = []
		const script = new NpcScript(`
plan "goToWork"
	checking "Not hungry": hunger < 10
	checking has_job
	print "working"
end plan
print "after"
`)
		const context = {
			hunger: 12,
			has_job: true,
			print(...args: any[]) {
				output.push(args.join(' '))
			},
			plan: {
				begin: (plan: string) => events.push(`begin:${plan}`),
			},
		}

		const result = script.execute(context)

		expect(result).toEqual({ type: 'return' })
		expect(output).toEqual(['after'])
		expect(events).toEqual([])
	})

	it('cancels a running plan on resume when a checking fails and reports payload snapshots', () => {
		const output: string[] = []
		const events: Array<{ plan: string; metadata?: any }> = []
		const script = new NpcScript(`
plan "goToWork"
	checking { label: status, allowed: allowed }: allowed
	wait
	print "working"
end plan
print "after"
`)
		const context = {
			allowed: true,
			status: 'entry',
			wait: () => 'wait',
			print(...args: any[]) {
				output.push(args.join(' '))
			},
			plan: {
				begin: (plan: string) => events.push({ plan: `begin:${plan}` }),
				cancel: (plan: string, metadata?: any) => events.push({ plan: `cancel:${plan}`, metadata }),
				finally: (plan: string, metadata?: any) =>
					events.push({ plan: `finally:${plan}`, metadata }),
			},
		}

		const first = executeScript(script, context)
		expect(first).toEqual({ type: 'yield', value: 'wait', state: expect.anything() })

		context.allowed = false
		context.status = 'resume'

		const second = executeScript(script, context, first.state)
		expect(second).toEqual({ type: 'return', state: undefined })
		expect(output).toEqual(['after'])
		expect(events[0]).toEqual({ plan: 'begin:goToWork' })
		expect(events[1].plan).toBe('cancel:goToWork')
		expect(events[1].metadata.reason).toMatchObject({
			type: 'checking_failed',
			phase: 'resume',
			checkIndex: 0,
			descriptionOnEnter: { label: 'entry', allowed: true },
			descriptionOnFailure: { label: 'resume', allowed: false },
		})
		expect(events[2]).toEqual({
			plan: 'finally:goToWork',
			metadata: events[1].metadata,
		})
	})

	it('cancels nested plans when an outer checking fails on resume', () => {
		const events: string[] = []
		const script = new NpcScript(`
plan "parent"
	checking parent_ok
	plan "child"
		checking child_ok
		wait
	end plan
end plan
`)
		const context = {
			parent_ok: true,
			child_ok: true,
			wait: () => 'wait',
			plan: {
				begin: (plan: string) => events.push(`begin:${plan}`),
				cancel: (plan: string) => events.push(`cancel:${plan}`),
				finally: (plan: string) => events.push(`finally:${plan}`),
			},
		}

		const first = executeScript(script, context)
		expect(first).toEqual({ type: 'yield', value: 'wait', state: expect.anything() })
		expect(events).toEqual(['begin:parent', 'begin:child'])

		context.parent_ok = false
		const second = executeScript(script, context, first.state)

		expect(second).toEqual({ type: 'return', state: undefined })
		expect(events).toEqual([
			'begin:parent',
			'begin:child',
			'cancel:child',
			'finally:child',
			'cancel:parent',
			'finally:parent',
		])
	})
})
