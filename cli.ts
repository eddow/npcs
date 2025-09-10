import { readFileSync, existsSync } from "node:fs"
import { join, resolve } from "node:path"
import MiniScript, { ASTChunk } from "miniscript-core"
import { MiniScriptExecutor, rootScope } from "./src/executor.js"

function showUsage() {
	console.log("Usage: npx tsx cli.ts <script-file>")
	console.log("")
	console.log("Examples:")
	console.log("  npx tsx cli.ts tests/fixtures/basic.mns")
	console.log("  npx tsx cli.ts tests/fixtures/functions.mns")
	console.log("  npx tsx cli.ts my-script.mns")
	console.log("")
	console.log("The script file can be:")
	console.log("  - A relative path from current directory")
	console.log("  - An absolute path")
	console.log("  - A file in tests/fixtures/ (just the name without .mns)")
}

async function runScript(scriptPath: string) {
	console.log(`🚀 Running MiniScript: ${scriptPath}`)
	
	try {
		// Determine the actual file path
		let filePath: string
		
		if (scriptPath.endsWith('.mns')) {
			// Full path provided
			filePath = resolve(scriptPath)
		} else {
			// Try as fixture name first, then as relative path
			const fixturePath = join(process.cwd(), "tests", "fixtures", `${scriptPath}.mns`)
			if (existsSync(fixturePath)) {
				filePath = fixturePath
			} else {
				filePath = resolve(scriptPath)
			}
		}
		
		// Check if file exists
		if (!existsSync(filePath)) {
			console.error(`❌ File not found: ${filePath}`)
			console.log("")
			showUsage()
			process.exit(1)
		}
		
		// Read the script file
		const content = readFileSync(filePath, "utf-8")
		
		// Parse the MiniScript code
		const lexer = new MiniScript.Lexer(content)
		const parser = new MiniScript.Parser(content, { lexer })
		const ast = parser.parseChunk() as ASTChunk
		
		console.log("🌳 AST parsed successfully")
		console.log("📊 AST type:", ast.constructor.name)
		console.log("📊 Number of statements:", ast.body?.length || 0)
		
		console.log("\n" + "=".repeat(50) + "\n")
		
		// Create executor and run
		const root = rootScope({}, {
			print: (...args: any[]) => {
				console.log(args.join(" "))
			}
		})
		
		const executor = new MiniScriptExecutor(ast, content, root)
		
		console.log("🚀 Executing MiniScript...")
		console.log("📤 Output:")
		console.log("-".repeat(30))
		
		const result = executor.execute()
		
		console.log("-".repeat(30))
		console.log("✅ Execution completed!")
		console.log("📋 Result:", result)
		
	} catch (error) {
		console.error("❌ Error:", String(error))
		if (error instanceof Error) {
			console.error("Stack:", error.stack)
		}
		process.exit(1)
	}
}

// Main CLI logic
async function main() {
	const args = process.argv.slice(2)
	
	if (args.length === 0) {
		console.log("❌ No script file provided")
		console.log("")
		showUsage()
		process.exit(1)
	}
	
	if (args[0] === '--help' || args[0] === '-h') {
		showUsage()
		process.exit(0)
	}
	
	await runScript(args[0])
}

// Run the CLI
main().catch(console.error)
