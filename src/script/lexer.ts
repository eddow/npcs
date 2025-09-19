import { type BaseToken, LiteralToken, Token, TokenType } from './lexer/token'
import Validator from './lexer/validator'
import { CharacterCode } from './types/codes'
import { LexerException } from './types/errors'
import { Keyword } from './types/keywords'
import { Literal } from './types/literals'
import { Operator } from './types/operators'
import { Position } from './types/position'
import { Range } from './types/range'
import Queue from './utils/queue'


function defaultScanHandler(this: Lexer, afterSpace: boolean) {
	const value = this.content[this.index]
	this.index += value.length
	return this.createPunctuator(value, afterSpace)
}

export default class Lexer {
	content: string
	length: number
	index: number
	tokenStart?: number
	line: number
	lineStart: number
	offset: number
	tabWidth: number

	validator: Validator
	unsafe: boolean
	errors: Error[]

	backlog: Queue<Token>
	snapshot: Queue<Token>

	constructor(content: string, { tabWidth = 1, validator = new Validator(), unsafe = false } = {}) {
		this.content = content
		this.length = content.length
		this.index = 0
		this.tabWidth = tabWidth
		this.line = 1
		this.lineStart = 0
		this.offset = 0
		this.validator = validator
		this.unsafe = unsafe
		this.errors = []
		this.backlog = new Queue()
		this.snapshot = new Queue()
	}

	private static scanHandlers: Record<
		string,
		(this: Lexer, afterSpace: boolean) => BaseToken<any> | null
	> = {
		[CharacterCode.QUOTE]: function quoteHandler(this, afterSpace) {
			return this.scanStringLiteral(afterSpace)
		},
		[CharacterCode.DOT]: function dotHandler(this, afterSpace) {
			if (this.validator.isDecDigit(this.codeAt(1))) return this.scanNumericLiteral(afterSpace)
			this.index++
			return this.createPunctuator(Operator.Member, afterSpace)
		},
		[CharacterCode.EQUAL]: function equalHandler(this, afterSpace) {
			if (CharacterCode.EQUAL === this.codeAt(1)) {
				return this.scanPunctuator(Operator.Equal, afterSpace)
			}
			return this.scanPunctuator(Operator.Assign, afterSpace)
		},
		[CharacterCode.ARROW_LEFT]: function arrowLeftHandler(this, afterSpace) {
			if (CharacterCode.EQUAL === this.codeAt(1))
				return this.scanPunctuator(Operator.LessThanOrEqual, afterSpace)
			return this.scanPunctuator(Operator.LessThan, afterSpace)
		},
		[CharacterCode.ARROW_RIGHT]: function arrowRightHandler(this, afterSpace) {
			if (CharacterCode.EQUAL === this.codeAt(1))
				return this.scanPunctuator(Operator.GreaterThanOrEqual, afterSpace)
			return this.scanPunctuator(Operator.GreaterThan, afterSpace)
		},
		[CharacterCode.EXCLAMATION_MARK]: function exclamationMarkHandler(this, afterSpace) {
			if (CharacterCode.EQUAL === this.codeAt(1))
				return this.scanPunctuator(Operator.NotEqual, afterSpace)
			this.index++
			return null
		},
		[CharacterCode.MINUS]: function minusHandler(this, afterSpace) {
			if (CharacterCode.EQUAL === this.codeAt(1))
				return this.scanPunctuator(Operator.SubtractShorthand, afterSpace)
			return this.scanPunctuator(Operator.Minus, afterSpace)
		},
		[CharacterCode.PLUS]: function plusHandler(this, afterSpace) {
			if (CharacterCode.EQUAL === this.codeAt(1))
				return this.scanPunctuator(Operator.AddShorthand, afterSpace)
			return this.scanPunctuator(Operator.Plus, afterSpace)
		},
		[CharacterCode.ASTERISK]: function asteriskHandler(this, afterSpace) {
			if (CharacterCode.EQUAL === this.codeAt(1))
				return this.scanPunctuator(Operator.MultiplyShorthand, afterSpace)
			return this.scanPunctuator(Operator.Asterisk, afterSpace)
		},
		[CharacterCode.SLASH]: function slashHandler(this, afterSpace) {
			if (CharacterCode.EQUAL === this.codeAt(1))
				return this.scanPunctuator(Operator.DivideShorthand, afterSpace)
			return this.scanPunctuator(Operator.Slash, afterSpace)
		},
		[CharacterCode.COLON]: function colonHandler(this, afterSpace) {
			this.index++
			return this.createSlice(afterSpace)
		},
		[CharacterCode.CARET]: function caretHandler(this, afterSpace) {
			if (CharacterCode.EQUAL === this.codeAt(1))
				return this.scanPunctuator(Operator.PowerShorthand, afterSpace)
			return this.scanPunctuator(Operator.Power, afterSpace)
		},
		[CharacterCode.PERCENT]: function percentHandler(this, afterSpace) {
			if (CharacterCode.EQUAL === this.codeAt(1))
				return this.scanPunctuator(Operator.ModuloShorthand, afterSpace)
			return this.scanPunctuator(Operator.Modulo, afterSpace)
		},
		[CharacterCode.SEMICOLON]: function semicolonHandler(this, afterSpace) {
			this.index++
			return this.createEOL(afterSpace)
		},
		[CharacterCode.COMMA]: defaultScanHandler,
		[CharacterCode.CURLY_BRACKET_LEFT]: defaultScanHandler,
		[CharacterCode.CURLY_BRACKET_RIGHT]: defaultScanHandler,
		[CharacterCode.SQUARE_BRACKETS_LEFT]: defaultScanHandler,
		[CharacterCode.SQUARE_BRACKETS_RIGHT]: defaultScanHandler,
		[CharacterCode.PARENTHESIS_LEFT]: defaultScanHandler,
		[CharacterCode.PARENTHESIS_RIGHT]: defaultScanHandler,
		[CharacterCode.AT_SIGN]: defaultScanHandler,
	}

	scan(code: number, afterSpace: boolean): BaseToken<any> | null {
		const handler = Lexer.scanHandlers[code]

		if (handler) return handler.call(this, afterSpace)
		if (this.validator.isDecDigit(code)) return this.scanNumericLiteral(afterSpace)

		this.index++
		return null
	}

	isAtWhitespace(): boolean {
		return this.validator.isWhitespace(this.codeAt())
	}

	codeAt(offset: number = 0): number {
		const index = this.index + offset
		if (index < this.length) return <CharacterCode>this.content.charCodeAt(index)
		return 0
	}

	createEOL(afterSpace: boolean): Token {
		const token = new Token({
			type: TokenType.EOL,
			value: Operator.EndOfLine,
			line: this.line,
			lineStart: this.lineStart,
			range: [this.tokenStart!, this.index],
			offsetRange: [this.offset, this.offset],
			afterSpace,
		})

		this.snapshot.enqueue(token)

		return token
	}

	createIdentifier(value: string, afterSpace: boolean) {
		const token = new Token({
			type: TokenType.Identifier,
			value,
			line: this.line,
			lineStart: this.lineStart,
			range: [this.tokenStart!, this.index],
			offsetRange: [this.offset, this.offset],
			afterSpace,
		})

		this.snapshot.enqueue(token)

		return token
	}

	createEOF(afterSpace: boolean) {
		const token = new Token({
			type: TokenType.EOF,
			value: Operator.EndOfFile,
			line: this.line,
			lineStart: this.lineStart,
			range: [this.index, this.index],
			offsetRange: [this.offset, this.offset],
			afterSpace,
		})

		this.snapshot.enqueue(token)

		return token
	}

	createBoolean(value: string, afterSpace: boolean) {
		const literalToken = new LiteralToken({
			type: TokenType.BooleanLiteral,
			value: value === Literal.True,
			raw: value,
			line: this.line,
			lineStart: this.lineStart,
			range: [this.tokenStart!, this.index],
			offsetRange: [this.offset, this.offset],
			afterSpace,
		})

		this.snapshot.enqueue(literalToken as Token)

		return literalToken
	}

	createNull(afterSpace: boolean) {
		const literalToken = new LiteralToken({
			type: TokenType.NilLiteral,
			raw: Literal.Null,
			line: this.line,
			lineStart: this.lineStart,
			range: [this.tokenStart!, this.index],
			offsetRange: [this.offset, this.offset],
			afterSpace,
		})

		this.snapshot.enqueue(literalToken as Token)

		return literalToken
	}

	createSlice(afterSpace: boolean) {
		const token = new Token({
			type: TokenType.SliceOperator,
			value: Operator.SliceSeparator,
			line: this.line,
			lineStart: this.lineStart,
			range: [this.tokenStart!, this.index],
			offsetRange: [this.offset, this.offset],
			afterSpace,
		})

		this.snapshot.enqueue(token)

		return token
	}

	createPunctuator(value: string, afterSpace: boolean) {
		const token = new Token({
			type: TokenType.Punctuator,
			value,
			line: this.line,
			lineStart: this.lineStart,
			range: [this.tokenStart!, this.index],
			offsetRange: [this.offset, this.offset],
			afterSpace,
		})

		this.snapshot.enqueue(token)

		return token
	}

	createNumericLiteral(value: number, raw: string, afterSpace: boolean) {
		const literalToken = new LiteralToken({
			type: TokenType.NumericLiteral,
			value: value,
			raw: raw,
			line: this.line,
			lineStart: this.lineStart,
			range: [this.tokenStart!, this.index],
			offsetRange: [this.offset, this.offset],
			afterSpace,
		})

		this.snapshot.enqueue(literalToken as Token)

		return literalToken
	}

	scanStringLiteral(afterSpace: boolean): LiteralToken {
		const validator = this.validator
		const beginLine = this.line
		const beginLineStart = this.lineStart
		const strStart = this.index
		const strStartOffset = this.offset
		let endOffset = this.offset
		let closed = false

		while (this.index < this.length) {
			this.index++

			const code = this.codeAt()

			if (this.validator.isEndOfLine(code)) {
				if (validator.isWinNewline(code, this.codeAt(1))) this.index++
				this.line++
				endOffset = this.index + 1
			} else if (CharacterCode.QUOTE === code) {
				if (CharacterCode.QUOTE !== this.codeAt(1)) {
					closed = true
					break
				}
				this.index++
			}
		}

		if (!closed) {
			return this.raise(
				`Unexpected string end of file.`,
				new Range(
					new Position(beginLine, strStart - strStartOffset + 1),
					new Position(this.line, this.index - endOffset + 2),
				),
			)
		}

		this.index++
		const rawString = this.content.slice(this.tokenStart, this.index)
		const string = rawString.slice(1, -1).replace(/""/g, Operator.Escape)

		const literalToken = new LiteralToken({
			type: TokenType.StringLiteral,
			value: string,
			raw: rawString,
			line: beginLine,
			lineStart: beginLineStart,
			range: [this.tokenStart!, this.index],
			offsetRange: [strStartOffset, endOffset],
			afterSpace,
			lastLine: this.line,
			lastLineStart: this.lineStart,
		})

		this.offset = endOffset
		this.snapshot.enqueue(literalToken as Token)

		return literalToken
	}

	scanComment(afterSpace: boolean): Token {
		const validator = this.validator
		const beginLine = this.line
		const beginLineStart = this.lineStart

		for (; this.index < this.length && !validator.isEndOfLine(this.codeAt()); this.index++);

		if (validator.isWinNewline(this.codeAt(), this.codeAt(1))) this.index++

		const value = this.content.slice(this.tokenStart! + 2, this.index)
		const token = new Token({
			type: TokenType.Comment,
			value,
			line: beginLine,
			lineStart: beginLineStart,
			range: [this.tokenStart!, this.index],
			offsetRange: [this.offset, this.offset],
			afterSpace,
		})

		this.snapshot.enqueue(token)

		return token
	}

	scanNumericLiteral(afterSpace: boolean): Token {
		const validator = this.validator
		let previous
		let current

		while (this.index < this.length) {
			previous = current
			current = this.codeAt()

			if (
				validator.isDecDigit(current) ||
				CharacterCode.DOT === current ||
				CharacterCode.LETTER_E === current ||
				CharacterCode.LETTER_e === current ||
				((CharacterCode.MINUS === current || CharacterCode.PLUS === current) &&
					(CharacterCode.LETTER_E === previous || CharacterCode.LETTER_e === previous))
			) {
				this.index++
			} else {
				break
			}
		}

		const raw = this.content.slice(this.tokenStart, this.index)
		const value = Number(raw)

		if (isNaN(value)) {
			return this.raise(
				`Invalid numeric literal: ${raw}`,
				new Range(
					new Position(this.line, this.tokenStart! - this.offset + 1),
					new Position(this.line, this.index - this.offset + 1),
				),
			)
		}

		return this.createNumericLiteral(value, raw, afterSpace) as Token
	}

	scanPunctuator(value: string, afterSpace: boolean) {
		this.index += value.length
		return this.createPunctuator(value, afterSpace)
	}

	skipWhiteSpace() {
		for (; this.index < this.length; this.index++) {
			const code = this.content[this.index]
			if (code === '\t') {
				this.offset -= this.tabWidth - 1
			} else if (code !== ' ') {
				return
			}
		}
	}

	scanKeyword(keyword: string, afterSpace: boolean): Token {
		const validator = this.validator
		let value = keyword

		switch (keyword) {
			case Keyword.End: {
				this.index++

				for (; validator.isIdentifierPart(this.codeAt()); this.index++);
				value = this.content.slice(this.tokenStart, this.index)
				break
			}
			case Keyword.Else: {
				const elseIfStatement = this.content.slice(this.tokenStart, this.index + 3)
				if (elseIfStatement === Keyword.ElseIf) {
					this.index += 3
					value = elseIfStatement
				}
				break
			}
		}

		const token = new Token({
			type: TokenType.Keyword,
			value,
			line: this.line,
			lineStart: this.lineStart,
			range: [this.tokenStart!, this.index],
			offsetRange: [this.offset, this.offset],
			afterSpace,
		})

		this.snapshot.enqueue(token)

		return token
	}

	private scanBlockComment(afterSpace: boolean) {
		const beginLine = this.line
		const beginLineStart = this.lineStart
		const strStart = this.index
		const strStartOffset = this.offset
		let endOffset = this.offset
		let closed = false
		// advance past "/*"
		this.index += 2
		while (this.index < this.length) {
			const ch = this.content.charCodeAt(this.index)
			if (this.validator.isEndOfLine(ch)) {
				if (this.validator.isWinNewline(ch, this.content.charCodeAt(this.index + 1))) this.index++
				this.line++
				endOffset = this.index + 1
			} else if (
				ch === CharacterCode.ASTERISK &&
				this.content.charCodeAt(this.index + 1) === CharacterCode.SLASH
			) {
				this.index += 2
				closed = true
				break
			}
			this.index++
		}
		if (!closed) {
			return this.raise(
				`Unexpected block comment end of file.`,
				new Range(
					new Position(beginLine, strStart - strStartOffset + 1),
					new Position(this.line, this.index - endOffset + 2),
				),
			)
		}
		const rawValue = this.content.slice(this.tokenStart! + 2, this.index - 2)
		const token = new Token({
			type: TokenType.Comment,
			value: rawValue,
			line: beginLine,
			lineStart: beginLineStart,
			range: [this.tokenStart!, this.index],
			offsetRange: [strStartOffset, endOffset],
			afterSpace,
		})
		this.offset = endOffset
		this.snapshot.enqueue(token)
		return token
	}

	scanIdentifierOrKeyword(afterSpace: boolean): BaseToken<any> {
		const validator = this.validator

		this.index++

		for (; validator.isIdentifierPart(this.codeAt()); this.index++);

		const value: string = this.content.slice(this.tokenStart, this.index)

		if (validator.isKeyword(value)) return this.scanKeyword(value, afterSpace)

		switch (value) {
			case Literal.True:
			case Literal.False: {
				return this.createBoolean(value, afterSpace)
			}
			case Literal.Null: {
				return this.createNull(afterSpace)
			}
		}

		return this.createIdentifier(value, afterSpace)
	}

	next(): BaseToken<any> {
		if (this.backlog.size) {
			return this.backlog.dequeue()
		}

		const oldPosition = this.index
		this.skipWhiteSpace()
		const afterSpace = oldPosition < this.index

		const code = this.codeAt()

		// handle /* ... */ comments first
		if (code === CharacterCode.SLASH && this.codeAt(1) === CharacterCode.ASTERISK) {
			this.tokenStart = this.index
			return this.scanBlockComment(afterSpace)
		}

		if (this.validator.isComment(code, this.codeAt(1))) {
			this.tokenStart = this.index
			return this.scanComment(afterSpace)
		}

		if (this.index >= this.length) {
			return this.createEOF(afterSpace)
		}

		this.tokenStart = this.index

		if (this.validator.isEndOfLine(code)) {
			if (this.validator.isWinNewline(code, this.codeAt(1))) this.index++

			const token = this.createEOL(afterSpace)

			this.line++
			this.offset = this.index + 1
			this.lineStart = ++this.index

			return token
		}

		if (this.validator.isIdentifierStart(code)) return this.scanIdentifierOrKeyword(afterSpace)

		const beginLine = this.line
		const item = this.scan(code, afterSpace)

		if (item) return item

		return this.raise(
			`Invalid character ${code} (Code: ${String.fromCharCode(code)})`,
			new Range(
				new Position(beginLine, this.tokenStart - this.offset + 1),
				new Position(this.line, this.index - this.offset + 1),
			),
		)
	}

	recordSnapshot() {
		this.snapshot.clear()
	}

	recoverFromSnapshot() {
		this.backlog.copyInto(this.snapshot)
	}

	raise(message: string, range: Range): Token {
		const err = new LexerException(message, range)

		this.errors.push(err)

		if (this.unsafe) {
			return new Token({
				type: TokenType.Invalid,
				value: '',
				line: this.line,
				lineStart: this.lineStart,
				range: [this.tokenStart!, this.index],
				offsetRange: [this.offset, this.offset],
			})
		}

		throw err
	}
}
