import NpcScript from '../../src/npcs.js'

describe('NpcS direct usage', () => {
	it('executes a simple script and returns a value', () => {
		const output: string[] = []
		const context = {
			print: (...args: any[]) => output.push(args.join(' ')),
			yield: (arg: any) => arg,
		}

		const script = 'return 5 + 7'
		const npc = new NpcScript(script)
		const result = npc.execute(context)

		expect(output).toEqual([])
		expect(result).toEqual({ type: 'return', value: 12 })
	})

	it('pauses and resumes using execute(state)', () => {
		const output: string[] = []
		const context = {
			print(...args: any[]) {
				output.push(args.join(' '))
			},
			yield: (arg: any) => arg,
		}

		const script = `
x = 10
print "Before yield: x = " + x
yield 42
print "After yield: x = " + x
`
		const npc = new NpcScript(script)

		const first = npc.execute(context)
		expect(first).toEqual({ type: 'yield', value: expect.anything(), state: expect.anything() })
		expect(output).toEqual(['Before yield: x = 10'])

		output.length = 0
		// @ts-expect-error Jest doesn't ts-"assert" when it "expects"
		const second = npc.execute(context, first.state)
		expect(second).toEqual({ type: 'return' })
		expect(output).toEqual(['After yield: x = 10'])
	})

	it('iterates over yields using the iterator API', () => {
		const output: string[] = []
		const context = {
			print: (...args: any[]) => output.push(args.join(' ')),
			yield: (arg: any) => arg,
		}

		const script = `
yield "a"
yield "b"
return 99
`
		const npc = new NpcScript(script)

		const yielded: any[] = []
		for (const v of npc.executor(context)) {
			yielded.push(v)
		}

		expect(yielded).toEqual(['a', 'b'])
		expect(output).toEqual([])
	})

	it('iterates over yields using Array.from', () => {
		const output: string[] = []
		const context = {
			print: (...args: any[]) => output.push(args.join(' ')),
			yield: (arg: any) => arg,
		}

		const script = `
yield "a"
yield "b"
return 99
`
		const npc = new NpcScript(script)

		expect(Array.from(npc.executor(context))).toEqual(['a', 'b'])
		expect(output).toEqual([])
	})

	it('executes named function definitions', () => {
		const output: string[] = []
		const context = {
			print: (...args: any[]) => {
				output.push(args.join(' '))
			},
			yield: (arg: any) => arg,
		}

		const script = `
function myFunction()
    return "Hello from named function"
end function

function add(a, b)
    return a + b
end function

function greet(name)
    return "Hello " + name
end function

print myFunction()
print add(5, 3)
print greet()
print greet("Alice")
return "done"
`
		const npc = new NpcScript(script)
		const result = npc.execute(context)

		expect(result).toEqual({ type: 'return', value: 'done' })
		expect(output).toEqual([
			'Hello from named function',
			'8',
			'Hello undefined',
			'Hello Alice'
		])
	})

	it('executes both named and anonymous function syntax', () => {
		const output: string[] = []
		const context = {
			print: (...args: any[]) => {
				output.push(args.join(' '))
			},
			yield: (arg: any) => arg,
		}

		const script = `
// Named function
function namedFunc()
    return "Named function"
end function

// Anonymous function
anonFunc = function()
    return "Anonymous function"
end function

print namedFunc()
print anonFunc()
return "done"
`
		const npc = new NpcScript(script)
		const result = npc.execute(context)

		expect(result).toEqual({ type: 'return', value: 'done' })
		expect(output).toEqual([
			'Named function',
			'Anonymous function'
		])
	})
})
