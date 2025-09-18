import { ASTMapKeyString, Parser, Selectors, Lexer, Token, TokenType, CharacterCode, ASTRange, ASTPosition } from "miniscript-core"

export class ExtParser extends Parser {
    constructor(content: string, options: any = {}) {
        const lexer = new ExtLexer(content, options)
        super(content, { ...options, lexer })
    }

    parseMap(asLVal = false, statementStart = false) {
        const me = this;
		if (!me.token) throw new Error("Token is null")
        if (!Selectors.CLBracket(me.token)) {
            return me.parseList(asLVal, statementStart);
        }
        const scope = me.currentScope;
        const startToken = me.token;
        const fields: ASTMapKeyString[] = [];
        const mapConstructorExpr = me.astProvider.mapConstructorExpression({
            fields,
            start: startToken.start,
            end: null,
            range: [startToken.range[0], null!],
            scope
        });
        me.next();
        if (Selectors.CRBracket(me.token)) {
            me.next();
        }
        else {
            me.skipNewlines();
            while (!Selectors.EndOfFile(me.token)) {
                if (Selectors.CRBracket(me.token)) {
                    me.next();
                    break;
                }
                const keyValueItem = me.astProvider.mapKeyString({
                    key: null!,
                    value: null!,
                    start: me.token.start,
                    end: null!,
                    range: [me.token.range[0], null!],
                    scope
                });
                keyValueItem.key = me.parseExpr(null!);
				if(me.consume(Selectors.MapKeyValueSeperator)) {
                //me.requireToken(Selectors.MapKeyValueSeperator);
					me.skipNewlines();
					keyValueItem.value = me.parseExpr(keyValueItem);
				} else {
					keyValueItem.value = keyValueItem.key;
				}
				if (!me.previousToken) throw new Error("Token is null")
                keyValueItem.end = me.previousToken.end;
                keyValueItem.range[1] = me.previousToken.range[1];
                fields.push(keyValueItem);
                if (Selectors.MapSeperator(me.token)) {
                    me.next();
                    me.skipNewlines();
                }
                if (Selectors.CRBracket(me.token)) {
                    me.next();
                    break;
                }
            }
        }
        mapConstructorExpr.end = me.token.start;
        mapConstructorExpr.range[1] = me.token.range[1];
        return mapConstructorExpr;
    }
}

export class ExtLexer extends Lexer {
    private scanBlockComment(afterSpace: boolean) {
        const me = this as any;
        const beginLine = me.line;
        const beginLineStart = me.lineStart;
        const strStart = me.index;
        const strStartOffset = me.offset;
        let endOffset = me.offset;
        let closed = false;
        // advance past "/*"
        me.index += 2;
        while (me.index < me.length) {
            const ch = me.content.charCodeAt(me.index);
            if (me.validator.isEndOfLine(ch)) {
                if (me.validator.isWinNewline(ch, me.content.charCodeAt(me.index + 1))) me.index++;
                me.line++;
                endOffset = me.index + 1;
            } else if (ch === CharacterCode.ASTERISK && me.content.charCodeAt(me.index + 1) === CharacterCode.SLASH) {
                me.index += 2;
                closed = true;
                break;
            }
            me.index++;
        }
        if (!closed) {
            return me.raise(
                `Unexpected block comment end of file.`,
                new ASTRange(
                    new ASTPosition(beginLine, strStart - strStartOffset + 1),
                    new ASTPosition(me.line, me.index - endOffset + 2),
                ),
            );
        }
        const rawValue = me.content.slice(me.tokenStart + 2, me.index - 2);
        const token = new Token({
            type: TokenType.Comment,
            value: rawValue,
            line: beginLine,
            lineStart: beginLineStart,
            range: [me.tokenStart, me.index],
            offsetRange: [strStartOffset, endOffset],
            afterSpace
        });
        me.offset = endOffset;
        me.snapshot.enqueue(token);
        return token;
    }

    next() {
        const me = this as any;
        if (me.backlog.size) {
            return me.backlog.dequeue();
        }
        const oldPosition = me.index;
        me.skipWhiteSpace();
        const afterSpace = oldPosition < me.index;
        const code = me.codeAt();
        // handle /* ... */ comments first
        if (code === CharacterCode.SLASH && me.codeAt(1) === CharacterCode.ASTERISK) {
            me.tokenStart = me.index;
            return this.scanBlockComment(afterSpace);
        }
        if (me.validator.isComment(code, me.codeAt(1))) {
            me.tokenStart = me.index;
            return me.scanComment(afterSpace);
        }
        if (me.index >= me.length) {
            return me.createEOF(afterSpace);
        }
        me.tokenStart = me.index;
        if (me.validator.isEndOfLine(code)) {
            if (me.validator.isWinNewline(code, me.codeAt(1))) me.index++;
            const token = me.createEOL(afterSpace);
            me.line++;
            me.offset = me.index + 1;
            me.lineStart = ++me.index;
            return token;
        }
        if (me.validator.isIdentifierStart(code)) return me.scanIdentifierOrKeyword(afterSpace);
        const beginLine = me.line;
        const item = me.scan(code, afterSpace);
        if (item) return item;
        return me.raise(
            `Invalid character ${code} (Code: ${String.fromCharCode(code)})`,
            new ASTRange(
                new ASTPosition(beginLine, me.tokenStart - me.offset + 1),
                new ASTPosition(me.line, me.index - me.offset + 1),
            ),
        );
    }
}