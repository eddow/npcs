import { Lexer, Parser } from "miniscript-core";
import { MiniScriptExecutor } from "./src/executor";

const content = `
// Test object creation and property access
person = {name: "John", age: 39, city: "New York"}
print "Person name: " + person.name
print "Person age: " + person.age
print "Person city: " + person.city

// Test nested objects
company = {name: "TechCorp", ceo: {name: "Jane", age: 45}}
print "Company: " + company.name
print "CEO name: " + company.ceo.name
print "CEO age: " + company.ceo.age

// Test object property modification
person.age = 40
print "Updated age: " + person.age

// Test object with different property types
data = {count: 10, active: true, items: ["apple", "banana"]}
print "Count: " + data.count
print "Active: " + data.active
print "First item: " + data.items[0]

// Test function that works with objects
updatePerson = function(p, newAge)
p.age = newAge
return p
end function

updated = updatePerson(person, 41)
print "Final age: " + updated.age
`
const lexer = new Lexer(content)
const parser = new Parser(content, { lexer })
const payload = parser.parseChunk()
console.log("Parsing successful!")
console.log("AST type:", payload.constructor.name)/*
console.log("Number of statements:", payload.body.length)

// Show the structure of each statement
payload.body.forEach((stmt, index) => {
	console.log(`Statement ${index + 1}:`, stmt.constructor.name)
	if (stmt.constructor.name === 'ASTIfStatement') {
		console.log(`	- If condition: ${stmt.condition ? 'present' : 'missing'}`)
		if (stmt.clauses && stmt.clauses.length > 0) {
			const totalBodyStatements = stmt.clauses.reduce((total, clause) => {
				return total + (clause.body ? clause.body.length : 0)
			}, 0)
			console.log(`	- If body statements: ${totalBodyStatements}`)
			stmt.clauses.forEach((clause, i) => {
				console.log(`		- clause ${i}: ${clause.body ? clause.body.length : 0} statements`)
			})
		} else {
			console.log(`	- If body statements: 0`)
		}
	} else if (stmt.constructor.name === 'ASTWhileStatement') {
		console.log(`	- While condition: ${stmt.condition ? 'present' : 'missing'}`)
		console.log(`	- While body statements: ${stmt.body ? stmt.body.length : 0}`)
	} else if (stmt.constructor.name === 'ASTFunctionStatement') {
		console.log(`	- Function name: ${stmt.name || 'unnamed'}`)
		console.log(`	- Function parameters: ${stmt.params ? stmt.params.length : 0}`)
		console.log(`	- Function body statements: ${stmt.body ? stmt.body.length : 0}`)
	} else if (stmt.constructor.name === 'ASTCallStatement') {
		console.log(`	- Function call: ${stmt.func ? stmt.func.name || 'unnamed' : 'unknown'}`)
		console.log(`	- Arguments: ${stmt.args ? stmt.args.length : 0}`)
	}
})*/

console.log("\n" + "=".repeat(50))
console.log("EXECUTING MINISCRIPT PROGRAM:")
console.log("=".repeat(50))

// Execute the AST
const executor = new MiniScriptExecutor()
try {
	executor.execute(payload)
	console.log("\n" + "=".repeat(50))
	console.log("EXECUTION COMPLETED SUCCESSFULLY!")
	console.log("=".repeat(50))
} catch (error) {
	console.error("Execution error:", error)
}
