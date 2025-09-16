import { ASTMapKeyString, Parser, Selectors } from "miniscript-core"

export class ExtParser extends Parser {
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