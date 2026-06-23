import NpcScript from '../../src/npcs.js'

describe('DO-WHILE-LOOP execution', () => {
	it('should execute do-while-loop correctly', () => {
		const source = `counter = 0
do
    print("Counter: " + counter)
    counter = counter + 1
while counter < 3 loop
print("Done!")`

		const output: string[] = []
		const context = {
			print: (...args: any[]) => output.push(args.join(' ')),
		}

		const script = new NpcScript(source)
		script.execute(context)

		expect(output).toEqual(['Counter: 0', 'Counter: 1', 'Counter: 2', 'Done!'])
	})

	it('should execute do-while-loop with multiple conditions (first passing)', () => {
		const source = `counter = 0
do
    print("Counter: " + counter)
    counter = counter + 1
while counter < 3 while false loop
print("Done!")`

		const output: string[] = []
		const context = {
			print: (...args: any[]) => output.push(args.join(' ')),
		}

		const script = new NpcScript(source)
		script.execute(context)

		expect(output).toEqual(['Counter: 0', 'Counter: 1', 'Counter: 2', 'Done!'])
	})

	it('should execute do-while-loop with no conditions (infinite until safety limit)', () => {
		const source = `counter = 0
do
    print("Counter: " + counter)
    counter = counter + 1
    if counter >= 3 then break
loop
print("Done!")`

		const output: string[] = []
		const context = {
			print: (...args: any[]) => output.push(args.join(' ')),
		}

		const script = new NpcScript(source)
		script.execute(context)

		expect(output).toEqual(['Counter: 0', 'Counter: 1', 'Counter: 2', 'Done!'])
	})

	it('should execute if-then-do-loop correctly', () => {
		const source = `counter = 0
if counter < 2 then do
    print("Counter: " + counter)
    counter = counter + 1
while counter < 3 loop
print("Done!")`

		const output: string[] = []
		const context = {
			print: (...args: any[]) => output.push(args.join(' ')),
		}

		const script = new NpcScript(source)
		script.execute(context)

		expect(output).toEqual(['Counter: 0', 'Counter: 1', 'Counter: 2', 'Done!'])
	})

	it('should not execute if-then-do-loop when if condition is false', () => {
		const source = `counter = 5
if counter < 2 then do
    print("This should not print")
    counter = counter + 1
while counter < 3 loop
print("Done!")`

		const output: string[] = []
		const context = {
			print: (...args: any[]) => output.push(args.join(' ')),
		}

		const script = new NpcScript(source)
		script.execute(context)

		expect(output).toEqual(['Done!'])
	})

	it('should execute do-while-loop with 2 conditions', () => {
		const source = `result = ""
do
	result = result + "a"
while result.length < 2
	result = result + "b"
while result.length < 1
	result = result + "c"
loop
print("Final result: " + result)`

		const output: string[] = []
		const context = {
			print: (...args: any[]) => output.push(args.join(' ')),
		}

		const script = new NpcScript(source)
		script.execute(context)

		expect(output).toEqual(['Final result: aba'])
	})
})
