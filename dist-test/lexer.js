"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
var token_1 = require("./lexer/token");
var validator_1 = require("./lexer/validator");
var codes_1 = require("./types/codes");
var errors_1 = require("./types/errors");
var keywords_1 = require("./types/keywords");
var literals_1 = require("./types/literals");
var operators_1 = require("./types/operators");
var position_1 = require("./types/position");
var range_1 = require("./types/range");
var queue_1 = require("./utils/queue");
function defaultScanHandler(afterSpace) {
    var value = this.content[this.index];
    this.index += value.length;
    return this.createPunctuator(value, afterSpace);
}
var Lexer = /** @class */ (function () {
    function Lexer(content, _a) {
        var _b = _a === void 0 ? {} : _a, _c = _b.tabWidth, tabWidth = _c === void 0 ? 1 : _c, _d = _b.validator, validator = _d === void 0 ? new validator_1.default() : _d, _e = _b.unsafe, unsafe = _e === void 0 ? false : _e;
        this.content = content;
        this.length = content.length;
        this.index = 0;
        this.tokenStart = null;
        this.tabWidth = tabWidth;
        this.line = 1;
        this.lineStart = 0;
        this.offset = 0;
        this.validator = validator;
        this.unsafe = unsafe;
        this.errors = [];
        this.backlog = new queue_1.default();
        this.snapshot = new queue_1.default();
    }
    Lexer.prototype.scan = function (code, afterSpace) {
        var handler = Lexer.scanHandlers[code];
        if (handler)
            return handler.call(this, afterSpace);
        if (this.validator.isDecDigit(code))
            return this.scanNumericLiteral(afterSpace);
        this.index++;
        return null;
    };
    Lexer.prototype.isAtWhitespace = function () {
        return this.validator.isWhitespace(this.codeAt());
    };
    Lexer.prototype.codeAt = function (offset) {
        if (offset === void 0) { offset = 0; }
        var index = this.index + offset;
        if (index < this.length)
            return this.content.charCodeAt(index);
        return 0;
    };
    Lexer.prototype.createEOL = function (afterSpace) {
        var token = new token_1.Token({
            type: token_1.TokenType.EOL,
            value: operators_1.Operator.EndOfLine,
            line: this.line,
            lineStart: this.lineStart,
            range: [this.tokenStart, this.index],
            offsetRange: [this.offset, this.offset],
            afterSpace: afterSpace,
        });
        this.snapshot.enqueue(token);
        return token;
    };
    Lexer.prototype.createIdentifier = function (value, afterSpace) {
        var token = new token_1.Token({
            type: token_1.TokenType.Identifier,
            value: value,
            line: this.line,
            lineStart: this.lineStart,
            range: [this.tokenStart, this.index],
            offsetRange: [this.offset, this.offset],
            afterSpace: afterSpace,
        });
        this.snapshot.enqueue(token);
        return token;
    };
    Lexer.prototype.createEOF = function (afterSpace) {
        var token = new token_1.Token({
            type: token_1.TokenType.EOF,
            value: operators_1.Operator.EndOfFile,
            line: this.line,
            lineStart: this.lineStart,
            range: [this.index, this.index],
            offsetRange: [this.offset, this.offset],
            afterSpace: afterSpace,
        });
        this.snapshot.enqueue(token);
        return token;
    };
    Lexer.prototype.createBoolean = function (value, afterSpace) {
        var literalToken = new token_1.LiteralToken({
            type: token_1.TokenType.BooleanLiteral,
            value: value === literals_1.Literal.True,
            raw: value,
            line: this.line,
            lineStart: this.lineStart,
            range: [this.tokenStart, this.index],
            offsetRange: [this.offset, this.offset],
            afterSpace: afterSpace,
        });
        this.snapshot.enqueue(literalToken);
        return literalToken;
    };
    Lexer.prototype.createNull = function (afterSpace) {
        var literalToken = new token_1.LiteralToken({
            type: token_1.TokenType.NilLiteral,
            value: null,
            raw: literals_1.Literal.Null,
            line: this.line,
            lineStart: this.lineStart,
            range: [this.tokenStart, this.index],
            offsetRange: [this.offset, this.offset],
            afterSpace: afterSpace,
        });
        this.snapshot.enqueue(literalToken);
        return literalToken;
    };
    Lexer.prototype.createSlice = function (afterSpace) {
        var token = new token_1.Token({
            type: token_1.TokenType.SliceOperator,
            value: operators_1.Operator.SliceSeparator,
            line: this.line,
            lineStart: this.lineStart,
            range: [this.tokenStart, this.index],
            offsetRange: [this.offset, this.offset],
            afterSpace: afterSpace,
        });
        this.snapshot.enqueue(token);
        return token;
    };
    Lexer.prototype.createPunctuator = function (value, afterSpace) {
        var token = new token_1.Token({
            type: token_1.TokenType.Punctuator,
            value: value,
            line: this.line,
            lineStart: this.lineStart,
            range: [this.tokenStart, this.index],
            offsetRange: [this.offset, this.offset],
            afterSpace: afterSpace,
        });
        this.snapshot.enqueue(token);
        return token;
    };
    Lexer.prototype.createNumericLiteral = function (value, raw, afterSpace) {
        var literalToken = new token_1.LiteralToken({
            type: token_1.TokenType.NumericLiteral,
            value: value,
            raw: raw,
            line: this.line,
            lineStart: this.lineStart,
            range: [this.tokenStart, this.index],
            offsetRange: [this.offset, this.offset],
            afterSpace: afterSpace,
        });
        this.snapshot.enqueue(literalToken);
        return literalToken;
    };
    Lexer.prototype.scanStringLiteral = function (afterSpace) {
        var validator = this.validator;
        var beginLine = this.line;
        var beginLineStart = this.lineStart;
        var strStart = this.index;
        var strStartOffset = this.offset;
        var endOffset = this.offset;
        var closed = false;
        while (this.index < this.length) {
            this.index++;
            var code = this.codeAt();
            if (this.validator.isEndOfLine(code)) {
                if (validator.isWinNewline(code, this.codeAt(1)))
                    this.index++;
                this.line++;
                endOffset = this.index + 1;
            }
            else if (codes_1.CharacterCode.QUOTE === code) {
                if (codes_1.CharacterCode.QUOTE !== this.codeAt(1)) {
                    closed = true;
                    break;
                }
                this.index++;
            }
        }
        if (!closed) {
            return this.raise("Unexpected string end of file.", new range_1.Range(new position_1.Position(beginLine, strStart - strStartOffset + 1), new position_1.Position(this.line, this.index - endOffset + 2)));
        }
        this.index++;
        var rawString = this.content.slice(this.tokenStart, this.index);
        var string = rawString.slice(1, -1).replace(/""/g, operators_1.Operator.Escape);
        var literalToken = new token_1.LiteralToken({
            type: token_1.TokenType.StringLiteral,
            value: string,
            raw: rawString,
            line: beginLine,
            lineStart: beginLineStart,
            range: [this.tokenStart, this.index],
            offsetRange: [strStartOffset, endOffset],
            afterSpace: afterSpace,
            lastLine: this.line,
            lastLineStart: this.lineStart,
        });
        this.offset = endOffset;
        this.snapshot.enqueue(literalToken);
        return literalToken;
    };
    Lexer.prototype.scanComment = function (afterSpace) {
        var validator = this.validator;
        var beginLine = this.line;
        var beginLineStart = this.lineStart;
        for (; this.index < this.length && !validator.isEndOfLine(this.codeAt()); this.index++)
            ;
        if (validator.isWinNewline(this.codeAt(), this.codeAt(1)))
            this.index++;
        var value = this.content.slice(this.tokenStart + 2, this.index);
        var token = new token_1.Token({
            type: token_1.TokenType.Comment,
            value: value,
            line: beginLine,
            lineStart: beginLineStart,
            range: [this.tokenStart, this.index],
            offsetRange: [this.offset, this.offset],
            afterSpace: afterSpace,
        });
        this.snapshot.enqueue(token);
        return token;
    };
    Lexer.prototype.scanNumericLiteral = function (afterSpace) {
        var validator = this.validator;
        var previous;
        var current;
        while (this.index < this.length) {
            previous = current;
            current = this.codeAt();
            if (validator.isDecDigit(current) ||
                codes_1.CharacterCode.DOT === current ||
                codes_1.CharacterCode.LETTER_E === current ||
                codes_1.CharacterCode.LETTER_e === current ||
                ((codes_1.CharacterCode.MINUS === current || codes_1.CharacterCode.PLUS === current) &&
                    (codes_1.CharacterCode.LETTER_E === previous || codes_1.CharacterCode.LETTER_e === previous))) {
                this.index++;
            }
            else {
                break;
            }
        }
        var raw = this.content.slice(this.tokenStart, this.index);
        var value = Number(raw);
        if (isNaN(value)) {
            return this.raise("Invalid numeric literal: ".concat(raw), new range_1.Range(new position_1.Position(this.line, this.tokenStart - this.offset + 1), new position_1.Position(this.line, this.index - this.offset + 1)));
        }
        return this.createNumericLiteral(value, raw, afterSpace);
    };
    Lexer.prototype.scanPunctuator = function (value, afterSpace) {
        this.index += value.length;
        return this.createPunctuator(value, afterSpace);
    };
    Lexer.prototype.skipWhiteSpace = function () {
        for (; this.index < this.length; this.index++) {
            var code = this.content[this.index];
            if (code === '\t') {
                this.offset -= this.tabWidth - 1;
            }
            else if (code !== ' ') {
                return;
            }
        }
    };
    Lexer.prototype.scanKeyword = function (keyword, afterSpace) {
        var validator = this.validator;
        var value = keyword;
        switch (keyword) {
            case keywords_1.Keyword.End: {
                this.index++;
                for (; validator.isIdentifierPart(this.codeAt()); this.index++)
                    ;
                value = this.content.slice(this.tokenStart, this.index);
                break;
            }
            case keywords_1.Keyword.Else: {
                var elseIfStatement = this.content.slice(this.tokenStart, this.index + 3);
                if (elseIfStatement === keywords_1.Keyword.ElseIf) {
                    this.index += 3;
                    value = elseIfStatement;
                }
                break;
            }
        }
        var token = new token_1.Token({
            type: token_1.TokenType.Keyword,
            value: value,
            line: this.line,
            lineStart: this.lineStart,
            range: [this.tokenStart, this.index],
            offsetRange: [this.offset, this.offset],
            afterSpace: afterSpace,
        });
        this.snapshot.enqueue(token);
        return token;
    };
    Lexer.prototype.scanBlockComment = function (afterSpace) {
        var beginLine = this.line;
        var beginLineStart = this.lineStart;
        var strStart = this.index;
        var strStartOffset = this.offset;
        var endOffset = this.offset;
        var closed = false;
        // advance past "/*"
        this.index += 2;
        while (this.index < this.length) {
            var ch = this.content.charCodeAt(this.index);
            if (this.validator.isEndOfLine(ch)) {
                if (this.validator.isWinNewline(ch, this.content.charCodeAt(this.index + 1)))
                    this.index++;
                this.line++;
                endOffset = this.index + 1;
            }
            else if (ch === codes_1.CharacterCode.ASTERISK &&
                this.content.charCodeAt(this.index + 1) === codes_1.CharacterCode.SLASH) {
                this.index += 2;
                closed = true;
                break;
            }
            this.index++;
        }
        if (!closed) {
            return this.raise("Unexpected block comment end of file.", new range_1.Range(new position_1.Position(beginLine, strStart - strStartOffset + 1), new position_1.Position(this.line, this.index - endOffset + 2)));
        }
        var rawValue = this.content.slice(this.tokenStart + 2, this.index - 2);
        var token = new token_1.Token({
            type: token_1.TokenType.Comment,
            value: rawValue,
            line: beginLine,
            lineStart: beginLineStart,
            range: [this.tokenStart, this.index],
            offsetRange: [strStartOffset, endOffset],
            afterSpace: afterSpace,
        });
        this.offset = endOffset;
        this.snapshot.enqueue(token);
        return token;
    };
    Lexer.prototype.scanIdentifierOrKeyword = function (afterSpace) {
        var validator = this.validator;
        this.index++;
        for (; validator.isIdentifierPart(this.codeAt()); this.index++)
            ;
        var value = this.content.slice(this.tokenStart, this.index);
        if (validator.isKeyword(value))
            return this.scanKeyword(value, afterSpace);
        switch (value) {
            case literals_1.Literal.True:
            case literals_1.Literal.False: {
                return this.createBoolean(value, afterSpace);
            }
            case literals_1.Literal.Null: {
                return this.createNull(afterSpace);
            }
        }
        return this.createIdentifier(value, afterSpace);
    };
    Lexer.prototype.next = function () {
        if (this.backlog.size) {
            return this.backlog.dequeue();
        }
        var oldPosition = this.index;
        this.skipWhiteSpace();
        var afterSpace = oldPosition < this.index;
        var code = this.codeAt();
        // handle /* ... */ comments first
        if (code === codes_1.CharacterCode.SLASH && this.codeAt(1) === codes_1.CharacterCode.ASTERISK) {
            this.tokenStart = this.index;
            return this.scanBlockComment(afterSpace);
        }
        if (this.validator.isComment(code, this.codeAt(1))) {
            this.tokenStart = this.index;
            return this.scanComment(afterSpace);
        }
        if (this.index >= this.length) {
            return this.createEOF(afterSpace);
        }
        this.tokenStart = this.index;
        if (this.validator.isEndOfLine(code)) {
            if (this.validator.isWinNewline(code, this.codeAt(1)))
                this.index++;
            var token = this.createEOL(afterSpace);
            this.line++;
            this.offset = this.index + 1;
            this.lineStart = ++this.index;
            return token;
        }
        if (this.validator.isIdentifierStart(code))
            return this.scanIdentifierOrKeyword(afterSpace);
        var beginLine = this.line;
        var item = this.scan(code, afterSpace);
        if (item)
            return item;
        return this.raise("Invalid character ".concat(code, " (Code: ").concat(String.fromCharCode(code), ")"), new range_1.Range(new position_1.Position(beginLine, this.tokenStart - this.offset + 1), new position_1.Position(this.line, this.index - this.offset + 1)));
    };
    Lexer.prototype.recordSnapshot = function () {
        this.snapshot.clear();
    };
    Lexer.prototype.recoverFromSnapshot = function () {
        this.backlog.copyInto(this.snapshot);
    };
    Lexer.prototype.raise = function (message, range) {
        var err = new errors_1.LexerException(message, range);
        this.errors.push(err);
        if (this.unsafe) {
            return new token_1.Token({
                type: token_1.TokenType.Invalid,
                value: '',
                line: this.line,
                lineStart: this.lineStart,
                range: [this.tokenStart, this.index],
                offsetRange: [this.offset, this.offset],
            });
        }
        throw err;
    };
    Lexer.scanHandlers = (_a = {},
        _a[codes_1.CharacterCode.QUOTE] = function quoteHandler(afterSpace) {
            return this.scanStringLiteral(afterSpace);
        },
        _a[codes_1.CharacterCode.DOT] = function dotHandler(afterSpace) {
            if (this.validator.isDecDigit(this.codeAt(1)))
                return this.scanNumericLiteral(afterSpace);
            this.index++;
            return this.createPunctuator(operators_1.Operator.Member, afterSpace);
        },
        _a[codes_1.CharacterCode.EQUAL] = function equalHandler(afterSpace) {
            if (codes_1.CharacterCode.EQUAL === this.codeAt(1)) {
                return this.scanPunctuator(operators_1.Operator.Equal, afterSpace);
            }
            return this.scanPunctuator(operators_1.Operator.Assign, afterSpace);
        },
        _a[codes_1.CharacterCode.ARROW_LEFT] = function arrowLeftHandler(afterSpace) {
            if (codes_1.CharacterCode.EQUAL === this.codeAt(1))
                return this.scanPunctuator(operators_1.Operator.LessThanOrEqual, afterSpace);
            return this.scanPunctuator(operators_1.Operator.LessThan, afterSpace);
        },
        _a[codes_1.CharacterCode.ARROW_RIGHT] = function arrowRightHandler(afterSpace) {
            if (codes_1.CharacterCode.EQUAL === this.codeAt(1))
                return this.scanPunctuator(operators_1.Operator.GreaterThanOrEqual, afterSpace);
            return this.scanPunctuator(operators_1.Operator.GreaterThan, afterSpace);
        },
        _a[codes_1.CharacterCode.EXCLAMATION_MARK] = function exclamationMarkHandler(afterSpace) {
            if (codes_1.CharacterCode.EQUAL === this.codeAt(1))
                return this.scanPunctuator(operators_1.Operator.NotEqual, afterSpace);
            this.index++;
            return null;
        },
        _a[codes_1.CharacterCode.MINUS] = function minusHandler(afterSpace) {
            if (codes_1.CharacterCode.EQUAL === this.codeAt(1))
                return this.scanPunctuator(operators_1.Operator.SubtractShorthand, afterSpace);
            return this.scanPunctuator(operators_1.Operator.Minus, afterSpace);
        },
        _a[codes_1.CharacterCode.PLUS] = function plusHandler(afterSpace) {
            if (codes_1.CharacterCode.EQUAL === this.codeAt(1))
                return this.scanPunctuator(operators_1.Operator.AddShorthand, afterSpace);
            return this.scanPunctuator(operators_1.Operator.Plus, afterSpace);
        },
        _a[codes_1.CharacterCode.ASTERISK] = function asteriskHandler(afterSpace) {
            if (codes_1.CharacterCode.EQUAL === this.codeAt(1))
                return this.scanPunctuator(operators_1.Operator.MultiplyShorthand, afterSpace);
            return this.scanPunctuator(operators_1.Operator.Asterisk, afterSpace);
        },
        _a[codes_1.CharacterCode.SLASH] = function slashHandler(afterSpace) {
            if (codes_1.CharacterCode.EQUAL === this.codeAt(1))
                return this.scanPunctuator(operators_1.Operator.DivideShorthand, afterSpace);
            return this.scanPunctuator(operators_1.Operator.Slash, afterSpace);
        },
        _a[codes_1.CharacterCode.COLON] = function colonHandler(afterSpace) {
            this.index++;
            return this.createSlice(afterSpace);
        },
        _a[codes_1.CharacterCode.CARET] = function caretHandler(afterSpace) {
            if (codes_1.CharacterCode.EQUAL === this.codeAt(1))
                return this.scanPunctuator(operators_1.Operator.PowerShorthand, afterSpace);
            return this.scanPunctuator(operators_1.Operator.Power, afterSpace);
        },
        _a[codes_1.CharacterCode.PERCENT] = function percentHandler(afterSpace) {
            if (codes_1.CharacterCode.EQUAL === this.codeAt(1))
                return this.scanPunctuator(operators_1.Operator.ModuloShorthand, afterSpace);
            return this.scanPunctuator(operators_1.Operator.Modulo, afterSpace);
        },
        _a[codes_1.CharacterCode.SEMICOLON] = function semicolonHandler(afterSpace) {
            this.index++;
            return this.createEOL(afterSpace);
        },
        _a[codes_1.CharacterCode.COMMA] = defaultScanHandler,
        _a[codes_1.CharacterCode.CURLY_BRACKET_LEFT] = defaultScanHandler,
        _a[codes_1.CharacterCode.CURLY_BRACKET_RIGHT] = defaultScanHandler,
        _a[codes_1.CharacterCode.SQUARE_BRACKETS_LEFT] = defaultScanHandler,
        _a[codes_1.CharacterCode.SQUARE_BRACKETS_RIGHT] = defaultScanHandler,
        _a[codes_1.CharacterCode.PARENTHESIS_LEFT] = defaultScanHandler,
        _a[codes_1.CharacterCode.PARENTHESIS_RIGHT] = defaultScanHandler,
        _a[codes_1.CharacterCode.AT_SIGN] = defaultScanHandler,
        _a);
    return Lexer;
}());
exports.default = Lexer;
