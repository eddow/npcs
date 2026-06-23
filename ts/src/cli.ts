import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ScriptExecutor } from './executor.js'

function showUsage() {
	console.log('Usage: npx tsx cli.ts <script-file>')
	console.log('')
	console.log('Examples:')
	console.log('  npx tsx cli.ts tests/basic.test.npcs')
	console.log('  npx tsx cli.ts tests/error.test.npcs')
	console.log('  npx tsx cli.ts my-script.npcs')
	console.log('')
	console.log('The script file can be:')
	console.log('  - A relative path from current directory')
	console.log('  - An absolute path')
	console.log('  - A file in tests/ (just the name without .npcs)')
}

async function runScript(scriptPath: string) {
	console.log(`🚀 Running MiniScript: ${scriptPath}`)

	try {
		// Determine the actual file path
		const filePath = resolve(scriptPath)

		// Check if file exists
		if (!existsSync(filePath)) {
			console.error(`❌ File not found: ${filePath}`)
			console.log('')
			showUsage()
			process.exit(1)
		}

		// Read the script file
		const source = readFileSync(filePath, 'utf-8')

		// Create executor and run
		const context = {
			print(...args: any[]) {
				console.log(args.join(' '))
			},
		}

		const executor = new ScriptExecutor(source, context)

		console.log('🚀 Executing MiniScript...')
		console.log('📤 Output:')
		console.log('-'.repeat(30))

		const result = executor.execute()

		console.log('-'.repeat(30))
		console.log('✅ Execution completed!')
		console.log('📋 Result:', result)
	} catch (error) {
		console.error('❌ Error:', String(error))
		if (error instanceof Error) {
			console.error('Stack:', error.stack)
		}
		process.exit(1)
	}
}

// Main CLI logic
async function main() {
	const args = process.argv.slice(2)

	if (args.length === 0) {
		console.log('❌ No script file provided')
		console.log('')
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
