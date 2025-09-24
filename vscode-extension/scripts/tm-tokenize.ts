import fs from 'node:fs'
import path from 'node:path'
import { Registry, type IGrammar, type IRawGrammar } from 'vscode-textmate'
import { loadWASM, OnigScanner, OnigString } from 'vscode-oniguruma'

async function loadOnig(): Promise<void> {
	const wasmPath = require.resolve('vscode-oniguruma/release/onig.wasm')
	const wasmBin = fs.readFileSync(wasmPath).buffer
	await loadWASM(wasmBin)
}

async function loadGrammar(grammarPath: string): Promise<IGrammar> {
	const registry = new Registry({
		onigLib: Promise.resolve({
			createOnigScanner(patterns: string[]) { return new OnigScanner(patterns) },
			createOnigString(s: string) { return new OnigString(s) },
		}),
		loadGrammar: async (scopeName: string): Promise<IRawGrammar | null> => {
			if (scopeName !== 'source.npcs') return null
			const raw = fs.readFileSync(grammarPath, 'utf-8')
			return JSON.parse(raw)
		},
	})
	const grammar = await registry.loadGrammar('source.npcs')
	if (!grammar) throw new Error('Failed to load grammar')
	return grammar
}

function printTokens(line: string, tokens: ReturnType<IGrammar['tokenizeLine']>['tokens']) {
	const parts: string[] = []
	for (let i = 0; i < tokens.length; i++) {
		const t = tokens[i]
		const text = line.slice(t.startIndex, t.endIndex)
		parts.push(`${JSON.stringify(text)} => ${t.scopes.join(' ')} [${t.startIndex},${t.endIndex}]`)
	}
	console.log(parts.join('\n'))
}

async function main() {
	const file = process.argv[2]
	if (!file) {
		console.error('Usage: npm run tm:tokenize -- <file>')
		process.exit(1)
	}
	const abs = path.resolve(file)
	const grammarPath = path.resolve(__dirname, '..', 'syntaxes', 'npcs.tmLanguage.json')

	await loadOnig()
	const grammar = await loadGrammar(grammarPath)

	const source = fs.readFileSync(abs, 'utf-8')
	const lines = source.split(/\r?\n/)
	let ruleStack = null as any
	for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
		const line = lines[lineNumber]
		const { tokens, ruleStack: next } = grammar.tokenizeLine(line, ruleStack)
		process.stdout.write(`${lineNumber + 1}: ${line}\n`)
		printTokens(line, tokens)
		ruleStack = next
	}
}

main().catch((err) => { console.error(err); process.exit(1) })


