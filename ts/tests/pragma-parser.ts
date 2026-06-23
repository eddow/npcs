/**
 * Pragma parser for cross-engine `.test.npcs` files.
 *
 * Extracts and parses the `/* @npcs-test ... *​/` header block,
 * splitting into steps and parsing per-step directives.
 *
 * See tests/spec.md for the full specification.
 */

// ── Types ───────────────────────────────────────────────────────────

export interface ParsedStep {
	/** @output strings in order */
	outputs: string[]
	/** Expected result type */
	resultType: 'yield' | 'return' | 'error'
	/** Expected result value (undefined = any value accepted) */
	resultValue?: any
	/** Whether a value was explicitly specified in the directive */
	resultValueSpecified: boolean
	/** Substring to match in error message (only for resultType='error') */
	errorSubstring?: string
	/** Per-step timeout in ms */
	timeoutMs: number
	/** Globals injected for this step (merged with globalGlobals) */
	globals: Record<string, any>
}

export interface ParsedTest {
	/** Steps in execution order */
	steps: ParsedStep[]
	/** Globals set before the first separator (apply to all steps) */
	globalGlobals: Record<string, any>
	/** Default timeout for steps that don't specify their own */
	defaultTimeoutMs: number
}

// ── MiniScript literal parser ───────────────────────────────────────

/**
 * Parse a MiniScript literal value from a string.
 * Supports: numbers, strings, booleans, null, arrays, maps.
 */
function parseLiteral(input: string): any {
	const s = input.trim()
	if (s === 'true') return true
	if (s === 'false') return false
	if (s === 'null') return null

	// String: "..." with \" escape
	if (s.startsWith('"')) return parseString(s)

	// Number: integer or float
	if (/^-?\d/.test(s)) {
		const n = Number(s)
		if (!Number.isNaN(n)) return n
	}

	// Array: [...]
	if (s.startsWith('[')) return parseArray(s)

	// Map: {...}
	if (s.startsWith('{')) return parseMap(s)

	throw new Error(`Cannot parse MiniScript literal: ${s}`)
}

function parseString(s: string): string {
	let result = ''
	let i = 1 // skip opening "
	while (i < s.length) {
		if (s[i] === '\\' && i + 1 < s.length) {
			const next = s[i + 1]
			if (next === '"') {
				result += '"'
				i += 2
			} else if (next === '\\') {
				result += '\\'
				i += 2
			} else if (next === 'n') {
				result += '\n'
				i += 2
			} else if (next === 't') {
				result += '\t'
				i += 2
			} else {
				result += s[i]
				i++
			}
		} else if (s[i] === '"') {
			return result
		} else {
			result += s[i]
			i++
		}
	}
	throw new Error(`Unterminated string: ${s}`)
}

function parseArray(s: string): any[] {
	const inner = s.slice(1, -1).trim()
	if (inner === '') return []
	return splitTopLevel(inner, ',').map(parseLiteral)
}

function parseMap(s: string): Record<string, any> {
	const inner = s.slice(1, -1).trim()
	if (inner === '') return {}
	const result: Record<string, any> = {}
	const entries = splitTopLevel(inner, ',')
	for (const entry of entries) {
		const colonIdx = findTopLevel(entry, ':')
		if (colonIdx === -1) throw new Error(`Invalid map entry: ${entry}`)
		const key = parseLiteral(entry.slice(0, colonIdx))
		const value = parseLiteral(entry.slice(colonIdx + 1))
		result[String(key)] = value
	}
	return result
}

/** Split by separator, respecting nested brackets/braces/quotes */
function splitTopLevel(s: string, sep: string): string[] {
	const parts: string[] = []
	let depth = 0
	let inString = false
	let start = 0
	for (let i = 0; i < s.length; i++) {
		const c = s[i]
		if (c === '"' && (i === 0 || s[i - 1] !== '\\')) inString = !inString
		if (inString) continue
		if (c === '[' || c === '{') depth++
		else if (c === ']' || c === '}') depth--
		else if (c === sep && depth === 0) {
			parts.push(s.slice(start, i).trim())
			start = i + 1
		}
	}
	parts.push(s.slice(start).trim())
	return parts.filter((p) => p !== '')
}

function findTopLevel(s: string, char: string): number {
	let depth = 0
	let inString = false
	for (let i = 0; i < s.length; i++) {
		const c = s[i]
		if (c === '"' && (i === 0 || s[i - 1] !== '\\')) inString = !inString
		if (inString) continue
		if (c === '[' || c === '{') depth++
		else if (c === ']' || c === '}') depth--
		else if (c === char && depth === 0) return i
	}
	return -1
}

// ── Pragma block extraction ─────────────────────────────────────────

/**
 * Extract the pragma block content from a .test.npcs source.
 * Returns the text between the first `/*` and `*​/`, or null if none found.
 */
export function extractPragmaBlock(source: string): string | null {
	const start = source.indexOf('/*')
	if (start === -1) return null
	// Allow whitespace before the comment
	if (source.slice(0, start).trim() !== '') return null
	const end = source.indexOf('*/', start + 2)
	if (end === -1) return null
	return source.slice(start + 2, end)
}

// ── Directive parsing ───────────────────────────────────────────────

const DIRECTIVE_PATTERNS: Record<string, RegExp> = {
	'npcs-test': /^@npcs-test\s*$/,
	global: /^@global\s+(\w+)\s+(.+)$/,
	output: /^@output\s+"((?:[^"\\]|\\.)*)"\s*$/,
	yield: /^@yield(?:\s+(.+))?\s*$/,
	return: /^@return(?:\s+(.+))?\s*$/,
	error: /^@error(?:\s+(.+))?\s*$/,
	timeout: /^@timeout\s+(\d+)\s*$/,
}

function parseDirectiveLine(line: string, step: ParsedStep, test: ParsedTest): void {
	for (const [name, pattern] of Object.entries(DIRECTIVE_PATTERNS)) {
		const m = line.match(pattern)
		if (!m) continue

		switch (name) {
			case 'npcs-test':
				// Sentinel — just validates presence
				break
			case 'global':
				step.globals[m[1]] = parseLiteral(m[2])
				break
			case 'output':
				step.outputs.push(unescapeString(m[1]))
				break
			case 'yield':
				step.resultType = 'yield'
				if (m[1] !== undefined) {
					step.resultValue = parseLiteral(m[1])
					step.resultValueSpecified = true
				}
				break
			case 'return':
				step.resultType = 'return'
				if (m[1] !== undefined) {
					step.resultValue = parseLiteral(m[1])
					step.resultValueSpecified = true
				}
				break
			case 'error':
				step.resultType = 'error'
				if (m[1] !== undefined) {
					step.errorSubstring = unescapeString(m[1])
				}
				break
			case 'timeout':
				step.timeoutMs = parseInt(m[1], 10)
				break
		}
		return
	}
	throw new Error(`Unknown pragma directive: ${line.trim()}`)
}

function unescapeString(s: string): string {
	return s.replace(/\\(["\\/bfnrt])/g, (_, c: string) => {
		switch (c) {
			case '"':
				return '"'
			case '\\':
				return '\\'
			case 'n':
				return '\n'
			case 't':
				return '\t'
			default:
				return c
		}
	})
}

// ── Main parse function ─────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 5000

/**
 * Parse a pragma block into a ParsedTest.
 * @param block - the inner text of the `/* ... *​/` comment
 */
export function parsePragmas(block: string): ParsedTest {
	const lines = block.split('\n')
	const test: ParsedTest = {
		steps: [],
		globalGlobals: {},
		defaultTimeoutMs: DEFAULT_TIMEOUT_MS,
	}

	// Create initial step
	let currentStep: ParsedStep = {
		outputs: [],
		resultType: 'return', // default, will be overridden
		resultValue: undefined,
		resultValueSpecified: false,
		timeoutMs: test.defaultTimeoutMs,
		globals: {},
	}
	let seenSteps = false
	let seenSentinel = false

	for (const rawLine of lines) {
		// Strip leading asterisks and whitespace (from block comment formatting)
		const line = rawLine.replace(/^\s*\*?\s?/, '').trim()
		if (line === '') continue

		// Step separator
		if (line === '---') {
			seenSteps = true
			test.steps.push(currentStep)
			// Inherit global globals into step globals
			currentStep = {
				outputs: [],
				resultType: 'return',
				resultValue: undefined,
				resultValueSpecified: false,
				timeoutMs: test.defaultTimeoutMs,
				globals: { ...test.globalGlobals },
			}
			continue
		}

		if (!line.startsWith('@')) continue

		// Sentinel check
		if (line.startsWith('@npcs-test')) {
			seenSentinel = true
			continue
		}

		if (!seenSentinel) {
			throw new Error('Missing @npcs-test sentinel — must be the first directive')
		}

		// Parse directives that are step-scoped vs global-scoped
		if (line.startsWith('@global') && !seenSteps) {
			// Global globals (before first separator) — accumulate in globalGlobals
			const m = line.match(DIRECTIVE_PATTERNS.global)
			if (m) {
				test.globalGlobals[m[1]] = parseLiteral(m[2])
				currentStep.globals[m[1]] = test.globalGlobals[m[1]]
			}
			continue
		}

		if (line.startsWith('@timeout') && !seenSteps) {
			const m = line.match(DIRECTIVE_PATTERNS.timeout)
			if (m) {
				test.defaultTimeoutMs = parseInt(m[1], 10)
				currentStep.timeoutMs = test.defaultTimeoutMs
			}
			continue
		}

		// Step-scoped directive
		parseDirectiveLine(line, currentStep, test)
	}

	// Push final step
	test.steps.push(currentStep)

	// Apply inherited globals to all steps
	for (const step of test.steps) {
		step.globals = { ...test.globalGlobals, ...step.globals }
	}

	return test
}

/**
 * Full parse: extract pragma block + parse it.
 * Returns null if no pragma block is found.
 */
export function parseTestFile(source: string): ParsedTest | null {
	const block = extractPragmaBlock(source)
	if (!block) return null
	return parsePragmas(block)
}

/**
 * Extract the script body (everything after the pragma block comment).
 */
export function extractScriptBody(source: string): string {
	const start = source.indexOf('/*')
	if (start === -1) return source
	const end = source.indexOf('*/', start + 2)
	if (end === -1) return source
	// Allow whitespace before the comment
	if (source.slice(0, start).trim() !== '') return source
	return source.slice(end + 2)
}
