import NpcScript from '../../src/npcs'
import { Lexer, Parser } from '../../src/script/index'

describe('Ternary Operator', () => {
	describe('Parsing', () => {
		test('should parse basic ternary expression', () => {
			const content = `result = "yes" if true else "no"`
			const lexer = new Lexer(content, { unsafe: true })
			const parser = new Parser(content, { unsafe: true, lexer })
			const ast = parser.parseChunk()

			expect(lexer.errors.length).toBe(0)
			expect(parser.errors.length).toBe(0)
			expect(ast.toString()).toContain('TernaryExpression')
		})

		test('should parse ternary with numeric values', () => {
			const content = `result = 1 if x > 0 else 0`
			const lexer = new Lexer(content, { unsafe: true })
			const parser = new Parser(content, { unsafe: true, lexer })
			const ast = parser.parseChunk()

			expect(lexer.errors.length).toBe(0)
			expect(parser.errors.length).toBe(0)
			expect(ast.toString()).toContain('TernaryExpression')
		})

		test('should parse ternary with complex expressions', () => {
			const content = `result = (x + y) if (a > b) else (x - y)`
			const lexer = new Lexer(content, { unsafe: true })
			const parser = new Parser(content, { unsafe: true, lexer })
			const ast = parser.parseChunk()

			expect(lexer.errors.length).toBe(0)
			expect(parser.errors.length).toBe(0)
			expect(ast.toString()).toContain('TernaryExpression')
		})

		test('should handle ternary in function calls', () => {
			const content = `print("positive" if x > 0 else "negative")`
			const lexer = new Lexer(content, { unsafe: true })
			const parser = new Parser(content, { unsafe: true, lexer })
			const ast = parser.parseChunk()

			expect(lexer.errors.length).toBe(0)
			expect(parser.errors.length).toBe(0)
			expect(ast.toString()).toContain('TernaryExpression')
		})
	})

	describe('Execution', () => {
		test('should execute ternary with true condition', () => {
			const script = new NpcScript(`
				x = 5
				result = "positive" if x > 0 else "negative"
			`)

			const context = {}
			const result = script.execute(context)

			expect(result.type).toBe('return')
		})

		test('should execute ternary with false condition', () => {
			const script = new NpcScript(`
				x = 0
				result = "positive" if x > 0 else "zero or negative"
			`)

			const context = {}
			const result = script.execute(context)

			expect(result.type).toBe('return')
		})

		test('should execute ternary with boolean conditions', () => {
			const script = new NpcScript(`
				flag = true
				result = "yes" if flag else "no"
			`)

			const context = {}
			const result = script.execute(context)

			expect(result.type).toBe('return')
		})

		test('should execute ternary with string conditions', () => {
			const script = new NpcScript(`
				name = "Alice"
				result = "Hello " + name if name != "" else "Hello Stranger"
			`)

			const context = {}
			const result = script.execute(context)

			expect(result.type).toBe('return')
		})

		test('should execute ternary with numeric results', () => {
			const script = new NpcScript(`
				x = 10
				result = 100 if x > 5 else 0
			`)

			const context = {}
			const result = script.execute(context)

			expect(result.type).toBe('return')
		})

		test('should execute ternary in assignment', () => {
			const script = new NpcScript(`
				score = 85
				grade = "A" if score >= 90 else "B" if score >= 80 else "C"
			`)

			const context = {}
			const result = script.execute(context)

			expect(result.type).toBe('return')
		})

		test('should return correct value for true condition', () => {
			const script = new NpcScript(`
				x = 10
				result = "positive" if x > 0 else "negative"
				return result
			`)

			const context = {}
			const result = script.execute(context)

			expect(result.type).toBe('return')
			expect(result.value).toBe('positive')
		})

		test('should return correct value for false condition', () => {
			const script = new NpcScript(`
				x = -5
				result = "positive" if x > 0 else "negative"
				return result
			`)

			const context = {}
			const result = script.execute(context)

			expect(result.type).toBe('return')
			expect(result.value).toBe('negative')
		})

		test('should return correct numeric value', () => {
			const script = new NpcScript(`
				score = 85
				bonus = 100 if score >= 80 else 0
				return bonus
			`)

			const context = {}
			const result = script.execute(context)

			expect(result.type).toBe('return')
			expect(result.value).toBe(100)
		})

		test('should return correct value for zero condition', () => {
			const script = new NpcScript(`
				count = 0
				message = "has items" if count > 0 else "empty"
				return message
			`)

			const context = {}
			const result = script.execute(context)

			expect(result.type).toBe('return')
			expect(result.value).toBe('empty')
		})

		test('should return correct value for string condition', () => {
			const script = new NpcScript(`
				name = "Alice"
				greeting = "Hello " + name if name != "" else "Hello Stranger"
				return greeting
			`)

			const context = {}
			const result = script.execute(context)

			expect(result.type).toBe('return')
			expect(result.value).toBe('Hello Alice')
		})

		test('should return correct value for empty string condition', () => {
			const script = new NpcScript(`
				name = ""
				greeting = "Hello " + name if name != "" else "Hello Stranger"
				return greeting
			`)

			const context = {}
			const result = script.execute(context)

			expect(result.type).toBe('return')
			expect(result.value).toBe('Hello Stranger')
		})

		test('should handle nested ternary expressions', () => {
			const script = new NpcScript(`
				score = 85
				grade = "A" if score >= 90 else "B" if score >= 80 else "C" if score >= 70 else "F"
				return grade
			`)

			const context = {}
			const result = script.execute(context)

			expect(result.type).toBe('return')
			expect(result.value).toBe('B')
		})

		test('should return correct boolean value', () => {
			const script = new NpcScript(`
				flag = true
				result = "yes" if flag else "no"
				return result
			`)

			const context = {}
			const result = script.execute(context)

			expect(result.type).toBe('return')
			expect(result.value).toBe('yes')
		})

		test('should handle ternary with arithmetic expressions', () => {
			const script = new NpcScript(`
				x = 10
				y = 5
				result = x + y if x > y else x - y
				return result
			`)

			const context = {}
			const result = script.execute(context)

			expect(result.type).toBe('return')
			expect(result.value).toBe(15)
		})
	})

	describe('Edge Cases', () => {
		test('should handle empty string condition', () => {
			const script = new NpcScript(`
				name = ""
				result = "Hello " + name if name != "" else "Hello Stranger"
			`)

			const context = {}
			const result = script.execute(context)

			expect(result.type).toBe('return')
		})

		test('should handle zero condition', () => {
			const script = new NpcScript(`
				count = 0
				result = "has items" if count > 0 else "empty"
			`)

			const context = {}
			const result = script.execute(context)

			expect(result.type).toBe('return')
		})

		test('should handle null condition', () => {
			const script = new NpcScript(`
				value = null
				result = "has value" if value != null else "no value"
			`)

			const context = {}
			const result = script.execute(context)

			expect(result.type).toBe('return')
		})
	})
})
