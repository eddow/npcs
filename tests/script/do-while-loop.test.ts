import NpcScript from '../../src/npcs.js'

describe('DO-WHILE-LOOP syntax', () => {
	it('should parse simple do loop', () => {
		const source = 'do loop'
		const script = new NpcScript(source)
		expect(script.ast.toString()).toContain('DoWhileLoop')
	})

	it('should parse do while as one-liner', () => {
		const source = 'do while true loop'
		const script = new NpcScript(source)
		expect(script.ast.toString()).toContain('DoWhileLoop')
		expect(script.ast.toString()).toContain('Literal[1:10-1:14][true]')
	})

	it('should parse if-then-do-loop as one-liner without endif', () => {
		const source = `if true then do
    print("test")
loop`
		const script = new NpcScript(source)
		expect(script.ast.toString()).toContain('IfStatement')
		expect(script.ast.toString()).toContain('DoWhileLoop')
		expect(script.ast.toString()).toContain('Literal[1:4-1:8][true]')
	})

	it('should parse do with single condition', () => {
		const source = `do
    print("test")
while true loop`
		const script = new NpcScript(source)
		expect(script.ast.toString()).toContain('DoWhileLoop')
		expect(script.ast.toString()).toContain('Literal[3:7-3:11][true]')
	})

	it('should parse do with multiple conditions', () => {
		const source = `do
    print("test")
while true while false loop`
		const script = new NpcScript(source)
		expect(script.ast.toString()).toContain('DoWhileLoop')
		expect(script.ast.toString()).toContain('Literal[3:7-3:11][true]')
		expect(script.ast.toString()).toContain('Literal[3:18-3:23][false]')
	})

	it('should parse empty do block with conditions', () => {
		const source = 'do while true while false loop'
		const script = new NpcScript(source)
		expect(script.ast.toString()).toContain('DoWhileLoop')
	})

	it('should reject simple while statement', () => {
		const source = 'while true'
		expect(() => new NpcScript(source)).toThrow(
			'while statement not allowed outside of do-while loop',
		)
	})

	it('should reject end while statement', () => {
		const source = `while true
    print("test")
end while`
		expect(() => new NpcScript(source)).toThrow(
			'while statement not allowed outside of do-while loop',
		)
	})

	it('should parse do-while-loop with main block and 2 while clauses with blocks (snapshot test)', () => {
		const source = `result = 0
do
	result = result + 1
while result < 3
	result = result + 1
	result = result + 1
while result < 2
	result = result + 1
	result = result + 1
	result = result + 2
loop
print("Final result: " + result)`

		const script = new NpcScript(source)

		// Test the complete AST structure with snapshot testing
		expect(script.ast.toString()).toBe(`Chunk[1:1-12:33][
	AssignmentStatement[1:1-1:11][Identifier[1:1-1:7][result] = Literal[1:10-1:11][0]]
	DoWhileLoop[2:1-11:5][
	Chunk[2:1-11:5][
		AssignmentStatement[3:2-3:21][Identifier[3:2-3:8][result] = BinaryExpression[3:11-3:21][Identifier[3:11-3:17][result] + Literal[3:20-3:21][1]]]
	]
	
	WhileClause[4:1-6:21][BinaryExpression[4:7-4:17][Identifier[4:7-4:13][result] < Literal[4:16-4:17][3]]
		AssignmentStatement[5:2-5:21][Identifier[5:2-5:8][result] = BinaryExpression[5:11-5:21][Identifier[5:11-5:17][result] + Literal[5:20-5:21][1]]]
		AssignmentStatement[6:2-6:21][Identifier[6:2-6:8][result] = BinaryExpression[6:11-6:21][Identifier[6:11-6:17][result] + Literal[6:20-6:21][1]]]
	]
	WhileClause[7:1-10:21][BinaryExpression[7:7-7:17][Identifier[7:7-7:13][result] < Literal[7:16-7:17][2]]
		AssignmentStatement[8:2-8:21][Identifier[8:2-8:8][result] = BinaryExpression[8:11-8:21][Identifier[8:11-8:17][result] + Literal[8:20-8:21][1]]]
		AssignmentStatement[9:2-9:21][Identifier[9:2-9:8][result] = BinaryExpression[9:11-9:21][Identifier[9:11-9:17][result] + Literal[9:20-9:21][1]]]
		AssignmentStatement[10:2-10:21][Identifier[10:2-10:8][result] = BinaryExpression[10:11-10:21][Identifier[10:11-10:17][result] + Literal[10:20-10:21][2]]]
	]]
	CallExpression[12:1-12:33][Identifier[12:1-12:6][print](BinaryExpression[12:7-12:32][Literal[12:7-12:23][Final result: ] + Identifier[12:26-12:32][result]])]
]`)
	})

	it('should parse embeded do-while-loop', () => {
		const source = `result = 0
do while result < 3
	result = result + 1
	do while result < 2
		result = result + 1
	loop
while result < 2
	result = result + 1
loop
print("Final result: " + result)`

		const script = new NpcScript(source)

		// Test the complete AST structure with snapshot testing
		expect(script.ast.toString()).toBe(`Chunk[1:1-10:33][
	AssignmentStatement[1:1-1:11][Identifier[1:1-1:7][result] = Literal[1:10-1:11][0]]
	DoWhileLoop[2:1-9:5][
	Chunk[2:1-9:5][]
	
	WhileClause[2:4-6:6][BinaryExpression[2:10-2:20][Identifier[2:10-2:16][result] < Literal[2:19-2:20][3]]
		AssignmentStatement[3:2-3:21][Identifier[3:2-3:8][result] = BinaryExpression[3:11-3:21][Identifier[3:11-3:17][result] + Literal[3:20-3:21][1]]]
		DoWhileLoop[4:2-6:6][
		Chunk[4:2-6:6][]
		
		WhileClause[4:5-5:22][BinaryExpression[4:11-4:21][Identifier[4:11-4:17][result] < Literal[4:20-4:21][2]]
			AssignmentStatement[5:3-5:22][Identifier[5:3-5:9][result] = BinaryExpression[5:12-5:22][Identifier[5:12-5:18][result] + Literal[5:21-5:22][1]]]
		]]
	]
	WhileClause[7:1-8:21][BinaryExpression[7:7-7:17][Identifier[7:7-7:13][result] < Literal[7:16-7:17][2]]
		AssignmentStatement[8:2-8:21][Identifier[8:2-8:8][result] = BinaryExpression[8:11-8:21][Identifier[8:11-8:17][result] + Literal[8:20-8:21][1]]]
	]]
	CallExpression[10:1-10:33][Identifier[10:1-10:6][print](BinaryExpression[10:7-10:32][Literal[10:7-10:23][Final result: ] + Identifier[10:26-10:32][result]])]
]`)
	})
})
