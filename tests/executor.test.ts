import { MiniScriptExecutor } from '../src/executor.js';
import { Lexer, Parser } from 'miniscript-core';

describe('MiniScript Executor Unit Tests', () => {
	let executor: MiniScriptExecutor;

	beforeEach(() => {
		executor = new MiniScriptExecutor();
	});

	const parseAndExecute = (code: string) => {
		const lexer = new Lexer(code);
		const parser = new Parser(code, { lexer });
		const ast = parser.parseChunk();
		executor.execute(ast);
	};

	describe('Variable Assignment', () => {
		it('should assign and retrieve variables', () => {
			parseAndExecute('x = 42');
			expect(executor.getVariable('x')).toBe(42);
		});

		it('should handle string variables', () => {
			parseAndExecute('name = "John"');
			expect(executor.getVariable('name')).toBe('John');
		});

		it('should handle boolean variables', () => {
			parseAndExecute('active = true');
			expect(executor.getVariable('active')).toBe(true);
		});
	});

	describe('Arithmetic Operations', () => {
		it('should perform addition', () => {
			parseAndExecute('result = 10 + 5');
			expect(executor.getVariable('result')).toBe(15);
		});

		it('should perform multiplication', () => {
			parseAndExecute('result = 6 * 7');
			expect(executor.getVariable('result')).toBe(42);
		});

		it('should perform complex expressions', () => {
			parseAndExecute('result = (10 + 5) * 2');
			expect(executor.getVariable('result')).toBe(30);
		});
	});

	describe('Object Operations', () => {
		it('should create and access object properties', () => {
			parseAndExecute(`
				person = {name: "Alice", age: 30}
				name = person.name
				age = person.age
			`);
			expect(executor.getVariable('name')).toBe('Alice');
			expect(executor.getVariable('age')).toBe(30);
		});

		it('should modify object properties', () => {
			parseAndExecute(`
				person = {age: 25}
				person.age = 26
				newAge = person.age
			`);
			expect(executor.getVariable('newAge')).toBe(26);
		});

		it('should handle nested objects', () => {
			parseAndExecute(`
				company = {ceo: {name: "Bob"}}
				ceoName = company.ceo.name
			`);
			expect(executor.getVariable('ceoName')).toBe('Bob');
		});
	});

	describe('Array Operations', () => {
		it('should create and access arrays', () => {
			parseAndExecute(`
				fruits = ["apple", "banana"]
				first = fruits[0]
				second = fruits[1]
			`);
			expect(executor.getVariable('first')).toBe('apple');
			expect(executor.getVariable('second')).toBe('banana');
		});

		it('should handle mixed data types in arrays', () => {
			parseAndExecute(`
				mixed = [42, "hello", true]
				num = mixed[0]
				str = mixed[1]
				bool = mixed[2]
			`);
			expect(executor.getVariable('num')).toBe(42);
			expect(executor.getVariable('str')).toBe('hello');
			expect(executor.getVariable('bool')).toBe(true);
		});
	});

	describe('Function Operations', () => {
		it('should create and call functions', () => {
			parseAndExecute(`
				add = function(a, b)
				return a + b
				end function
				result = add(5, 3)
			`);
			expect(executor.getVariable('result')).toBe(8);
		});

		it('should handle functions with objects', () => {
			parseAndExecute(`
				person = {age: 25}
				updateAge = function(p, newAge)
				p.age = newAge
				return p
				end function
				updated = updateAge(person, 30)
				finalAge = updated.age
			`);
			expect(executor.getVariable('finalAge')).toBe(30);
		});
	});

	describe('Control Flow', () => {
		it('should handle if statements', () => {
			parseAndExecute(`
				x = 10
				if x > 5 then
				result = "big"
				end if
			`);
			expect(executor.getVariable('result')).toBe('big');
		});

		it('should handle while loops', () => {
			parseAndExecute(`
				counter = 0
				while counter < 3
				counter = counter + 1
				end while
			`);
			expect(executor.getVariable('counter')).toBe(3);
		});
	});

	describe('String Operations', () => {
		it('should concatenate strings', () => {
			parseAndExecute(`
				greeting = "Hello" + " " + "World"
			`);
			expect(executor.getVariable('greeting')).toBe('Hello World');
		});

		it('should concatenate strings with numbers', () => {
			parseAndExecute(`
				message = "The answer is " + 42
			`);
			expect(executor.getVariable('message')).toBe('The answer is 42');
		});
	});
});
