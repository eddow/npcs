import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse, stringify } from 'flatted'
import { ExecutionContext, NpcScript, reviveState, serializeState } from './src'
import { LexerException } from './src/script'
import { lexerExceptionLocation } from './src/npcs'

function showUsage() {
	console.log('Usage: npx tsx games/play.ts <script> <game> [sentence ...]')
	console.log('')
	console.log('Examples:')
	console.log('  npx tsx games/play.ts north go')
	console.log('  npx tsx games/play.ts say to Guard hello there, good sir!')
	console.log('  npx tsx games/play.ts attack goblin with my shiny sword')
}

function main() {
	const args = process.argv.slice(2)

	if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
		showUsage()
		process.exit(args.length === 0 ? 1 : 0)
	}

	if (args.length < 2) {
		console.error('❌ Expected at least 2 arguments: <script> <game>')
		console.log('')
		showUsage()
		process.exit(1)
	}

	const [script, game, ...words] = args

	
	function file(str: string, ext: string) {
		return resolve(/\.[^\/\\]+$/.test(str) ? str : `${str}.${ext}`)
	}
	// Resolve script file path (append .npcs if not provided)
	const scriptPath = file(script, 'npcs')

	if (!existsSync(scriptPath)) {
		console.error(`❌ Script file not found: ${scriptPath}`)
		process.exit(1)
	}

	// Resolve game state file path (append .json if not provided)
	const gameStatePath = file(game, 'json')

	// Load script source
	const source = readFileSync(scriptPath, 'utf-8')

	// Build execution context with utilities
	const sentence = words.join(' ')
	const context: ExecutionContext = {
		print(...args: any[]) {
			console.log(...args)
		},
		sentence
	}

	// Load previous state if any
	let priorState: any | undefined
	if (existsSync(gameStatePath)) {
		try {
			priorState = parse(readFileSync(gameStatePath, 'utf-8'), reviveState)
		} catch {}
	}

	try {
		// Create game
		const npc = new NpcScript(source)

		// Execute game
		const result = npc.execute(context, priorState)
		if (result.type === 'return') {
			console.log('✅ return:', result.value)
			// Clear saved state on completion
			if (existsSync(gameStatePath)) {
				try { unlinkSync(gameStatePath) } catch {}
			}
		} else if (result.type === 'yield') {
			console.log('⏸️ yield:', result.value)
			// Persist state for next run
			writeFileSync(gameStatePath, stringify(result.state, serializeState), 'utf-8')
			console.log(`💾 saved state -> ${gameStatePath}`)
		}
	} catch (error) {
		console.error('❌ Error:', String(error))
		if(error instanceof LexerException) {
			console.error(lexerExceptionLocation(error, source))
		}
		if (error instanceof Error) {
			console.error('Stack:', error.stack)
		}
		process.exit(1)
	}
}

main()