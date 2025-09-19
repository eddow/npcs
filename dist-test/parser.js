"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var lexer_1 = require("./lexer");
var token_1 = require("./lexer/token");
var ast_1 = require("./parser/ast");
var line_registry_1 = require("./parser/line-registry");
var pending_block_1 = require("./parser/pending-block");
var validator_1 = require("./parser/validator");
var errors_1 = require("./types/errors");
var keywords_1 = require("./types/keywords");
var operators_1 = require("./types/operators");
var range_1 = require("./types/range");
var selector_1 = require("./types/selector");
var stack_1 = require("./utils/stack");
var Parser = /** @class */ (function () {
    function Parser(content, _a) {
        var _b = _a === void 0 ? {} : _a, _c = _b.validator, validator = _c === void 0 ? new validator_1.default() : _c, _d = _b.astProvider, astProvider = _d === void 0 ? new ast_1.ASTProvider() : _d, lexer = _b.lexer, _e = _b.unsafe, unsafe = _e === void 0 ? false : _e, _f = _b.tabWidth, tabWidth = _f === void 0 ? 1 : _f;
        this.content = content;
        this.backPatches = new stack_1.Stack();
        this.statementErrors = [];
        this.lexer = lexer || new lexer_1.default(content, { unsafe: unsafe, tabWidth: tabWidth });
        this.token = null;
        this.previousToken = null;
        this.lineRegistry = new line_registry_1.LineRegistry();
        this.scopes = [];
        this.currentScope = null;
        this.currentAssignment = null;
        this.outerScopes = [];
        this.iteratorStack = [];
        this.literals = [];
        this.comments = [];
        this.validator = validator;
        this.astProvider = astProvider;
        this.unsafe = unsafe;
        this.errors = [];
    }
    Parser.prototype.next = function () {
        this.previousToken = this.token;
        this.token = this.lexer.next();
    };
    Parser.prototype.isType = function (type) {
        return this.token !== null && type === this.token.type;
    };
    Parser.prototype.consume = function (selector) {
        if (this.token && selector(this.token)) {
            this.next();
            return true;
        }
        return false;
    };
    Parser.prototype.consumeMany = function (selectorGroup) {
        if (this.token && selectorGroup(this.token)) {
            this.next();
            return true;
        }
        return false;
    };
    Parser.prototype.requireType = function (type, from) {
        var token = this.token;
        if (!token || token.type !== type) {
            this.raise("got ".concat(token || 'undefined', " where ").concat(type, " is required"), new range_1.Range(from || (token === null || token === void 0 ? void 0 : token.start), token === null || token === void 0 ? void 0 : token.end));
            return null;
        }
        this.next();
        return token;
    };
    Parser.prototype.requireToken = function (selector, from) {
        var token = this.token;
        if (!token || !selector(token)) {
            this.raise("got ".concat(token || 'undefined', " where \"").concat((0, selector_1.getSelectorValue)(selector), "\" is required"), new range_1.Range(from || (token === null || token === void 0 ? void 0 : token.start), token === null || token === void 0 ? void 0 : token.end));
            return null;
        }
        this.next();
        return token;
    };
    Parser.prototype.requireTokenOfAny = function (selectorGroup, from) {
        var token = this.token;
        if (token && selectorGroup(token)) {
            this.next();
            return token;
        }
        this.raise("got ".concat(token || 'undefined', " where any of ").concat((0, selector_1.getSelectorsFromGroup)(selectorGroup)
            .map(function (selector) { return "\"".concat((0, selector_1.getSelectorValue)(selector), "\""); })
            .join(', '), " is required"), new range_1.Range(from || (token === null || token === void 0 ? void 0 : token.start), token === null || token === void 0 ? void 0 : token.end));
        return undefined;
    };
    Parser.prototype.skipNewlines = function () {
        var _a;
        var lines = 0;
        while (true) {
            if (this.token && selector_1.Selectors.Comment(this.token)) {
                var isStatement = ((_a = this.previousToken) === null || _a === void 0 ? void 0 : _a.line) !== this.token.line;
                var comment = this.astProvider.comment({
                    value: this.token.value,
                    start: this.token.start,
                    end: this.token.end,
                    range: this.token.range,
                    scope: this.currentScope,
                    isStatement: isStatement,
                });
                this.comments.push(comment);
                this.lineRegistry.addItemToLines(comment);
            }
            else if (this.token && selector_1.Selectors.EndOfLine(this.token)) {
                lines++;
            }
            else {
                break;
            }
            this.next();
        }
        return lines;
    };
    Parser.prototype.pushScope = function (scope) {
        if (this.currentScope !== null) {
            this.scopes.push(scope);
            this.outerScopes.push(this.currentScope);
        }
        this.currentScope = scope;
    };
    Parser.prototype.popScope = function () {
        this.currentScope = this.outerScopes.pop();
    };
    Parser.prototype.tryToRecover = function () {
        var firstPointOfFailure = this.statementErrors[0];
        this.errors.push(firstPointOfFailure);
        if (!this.unsafe) {
            throw firstPointOfFailure;
        }
        this.lexer.recoverFromSnapshot();
        this.next();
        for (; this.token && this.token.type !== token_1.TokenType.EOL && this.token.type !== token_1.TokenType.EOF; this.next())
            ;
    };
    Parser.prototype.finishRemainingScopes = function () {
        var last = this.backPatches.pop();
        while (!(0, pending_block_1.isPendingChunk)(last)) {
            var exception = this.raise("found open block ".concat(last.block.type), new range_1.Range(last.block.start, last.block.start));
            last.complete(this.previousToken);
            this.errors.push(exception);
            if (!this.unsafe) {
                throw exception;
            }
            last = this.backPatches.pop();
        }
    };
    Parser.prototype.parseChunk = function () {
        this.next();
        var start = this.token.start;
        var chunk = this.astProvider.chunk({
            start: start,
            end: undefined,
            range: [this.token.range[0], undefined],
        });
        var pending = new pending_block_1.PendingChunk(chunk, this.lineRegistry);
        this.backPatches.setDefault(pending);
        this.pushScope(chunk);
        while (this.token && !selector_1.Selectors.EndOfFile(this.token)) {
            this.skipNewlines();
            if (!this.token || selector_1.Selectors.EndOfFile(this.token))
                break;
            this.lexer.recordSnapshot();
            this.statementErrors = [];
            this.parseStatement();
            if (this.statementErrors.length > 0) {
                this.tryToRecover();
            }
        }
        this.finishRemainingScopes();
        this.popScope();
        pending.complete(this.token);
        chunk.literals = this.literals;
        chunk.comments = this.comments;
        chunk.scopes = this.scopes;
        chunk.lines = this.lineRegistry.lines;
        return chunk;
    };
    Parser.prototype.parseStatement = function () {
        if (this.token && token_1.TokenType.Keyword === this.token.type && keywords_1.Keyword.Not !== this.token.value) {
            this.parseKeyword();
            return;
        }
        var pendingBlock = this.backPatches.peek();
        var item = this.parseAssignment();
        if (item.end !== null)
            this.lineRegistry.addItemToLines(item);
        pendingBlock.body.push(item);
    };
    Parser.prototype.parseContinueStatement = function () {
        var pendingBlock = this.backPatches.peek();
        if (this.iteratorStack.length === 0) {
            this.raise("'continue' without open loop block", new range_1.Range(this.previousToken.start, this.previousToken.end));
        }
        var item = this.astProvider.continueStatement({
            iterator: this.iteratorStack[this.iteratorStack.length - 1],
            start: this.previousToken.start,
            end: this.previousToken.end,
            range: this.previousToken.range,
            scope: this.currentScope,
        });
        this.lineRegistry.addItemToLines(item);
        pendingBlock.body.push(item);
    };
    Parser.prototype.parseBreakStatement = function () {
        var pendingBlock = this.backPatches.peek();
        if (this.iteratorStack.length === 0) {
            this.raise("'break' without open loop block", new range_1.Range(this.previousToken.start, this.previousToken.end));
        }
        var item = this.astProvider.breakStatement({
            iterator: this.iteratorStack[this.iteratorStack.length - 1],
            start: this.previousToken.start,
            end: this.previousToken.end,
            range: this.previousToken.range,
            scope: this.currentScope,
        });
        this.lineRegistry.addItemToLines(item);
        pendingBlock.body.push(item);
    };
    Parser.prototype.parseKeyword = function () {
        var value = this.token.value;
        switch (value) {
            case keywords_1.Keyword.Return: {
                var pendingBlock = this.backPatches.peek();
                this.next();
                var item = this.parseReturnStatement();
                if (item.end !== null) {
                    this.lineRegistry.addItemToLines(item);
                }
                pendingBlock.body.push(item);
                return;
            }
            case keywords_1.Keyword.If: {
                this.next();
                this.parseIfStatement();
                return;
            }
            case keywords_1.Keyword.ElseIf: {
                this.next();
                this.nextIfClause(ast_1.ASTType.ElseifClause);
                return;
            }
            case keywords_1.Keyword.Else: {
                this.next();
                this.nextIfClause(ast_1.ASTType.ElseClause);
                return;
            }
            case keywords_1.Keyword.While: {
                this.next();
                this.parseWhileStatement();
                return;
            }
            case keywords_1.Keyword.For: {
                this.next();
                this.parseForStatement();
                return;
            }
            case keywords_1.Keyword.EndFunction: {
                this.next();
                this.finalizeFunction();
                return;
            }
            case keywords_1.Keyword.EndFor: {
                this.next();
                this.finalizeForStatement();
                return;
            }
            case keywords_1.Keyword.EndWhile: {
                this.next();
                this.finalizeWhileStatement();
                return;
            }
            case keywords_1.Keyword.EndIf: {
                this.next();
                this.nextIfClause(null);
                return;
            }
            case keywords_1.Keyword.Continue: {
                this.next();
                this.parseContinueStatement();
                return;
            }
            case keywords_1.Keyword.Break: {
                this.next();
                this.parseBreakStatement();
                return;
            }
            case keywords_1.Keyword.Function: {
                var pendingBlock = this.backPatches.peek();
                var item = this.parseFunctionDeclaration(null, false, true);
                if (item.end !== null) {
                    this.lineRegistry.addItemToLines(item);
                }
                pendingBlock.body.push(item);
                return;
            }
        }
        this.raise("unexpected keyword ".concat(this.token, " at start of line"), new range_1.Range(this.token.start, this.token.end));
    };
    Parser.prototype.parseShortcutContinueStatement = function () {
        if (this.iteratorStack.length === 0) {
            this.raise("'continue' without open loop block", new range_1.Range(this.previousToken.start, this.previousToken.end));
        }
        return this.astProvider.continueStatement({
            iterator: this.iteratorStack[this.iteratorStack.length - 1],
            start: this.previousToken.start,
            end: this.previousToken.end,
            range: this.previousToken.range,
            scope: this.currentScope,
        });
    };
    Parser.prototype.parseShortcutBreakStatement = function () {
        if (this.iteratorStack.length === 0) {
            this.raise("'break' without open loop block", new range_1.Range(this.previousToken.start, this.previousToken.end));
        }
        return this.astProvider.breakStatement({
            iterator: this.iteratorStack[this.iteratorStack.length - 1],
            start: this.previousToken.start,
            end: this.previousToken.end,
            range: this.previousToken.range,
            scope: this.currentScope,
        });
    };
    Parser.prototype.parseShortcutStatement = function () {
        if (this.token && token_1.TokenType.Keyword === this.token.type && keywords_1.Keyword.Not !== this.token.value) {
            var value = this.token.value;
            switch (value) {
                case keywords_1.Keyword.Return: {
                    this.next();
                    return this.parseReturnStatement();
                }
                case keywords_1.Keyword.Continue: {
                    this.next();
                    return this.parseShortcutContinueStatement();
                }
                case keywords_1.Keyword.Break: {
                    this.next();
                    return this.parseShortcutBreakStatement();
                }
                default: {
                    this.raise("unexpected keyword ".concat(this.token, " in shorthand statement"), new range_1.Range(this.token.start, this.token.end));
                    return this.parseInvalidCode();
                }
            }
        }
        return this.parseAssignment();
    };
    Parser.prototype.parseAssignment = function () {
        var scope = this.currentScope;
        var startToken = this.token;
        var expr = this.parseExpr(null, true, true);
        if (this.token && selector_1.SelectorGroups.AssignmentEndOfExpr(this.token)) {
            return expr;
        }
        if (this.token && selector_1.Selectors.Assign(this.token)) {
            this.next();
            var assignmentStatement = this.astProvider.assignmentStatement({
                variable: expr,
                init: null,
                start: startToken.start,
                range: [startToken.range[0], null],
                end: null,
                scope: scope,
            });
            var previousAssignment = this.currentAssignment;
            this.currentAssignment = assignmentStatement;
            assignmentStatement.init = this.parseExpr(assignmentStatement);
            assignmentStatement.end = this.previousToken.end;
            assignmentStatement.range[1] = this.previousToken.range[1];
            this.currentAssignment = previousAssignment;
            scope.definitions.push(assignmentStatement);
            return assignmentStatement;
        }
        else if (this.token && selector_1.SelectorGroups.AssignmentShorthand(this.token)) {
            var op = this.token;
            this.next();
            var assignmentStatement = this.astProvider.assignmentStatement({
                variable: expr,
                init: null,
                start: startToken.start,
                range: [startToken.range[0], null],
                end: null,
                scope: scope,
            });
            var previousAssignment = this.currentAssignment;
            this.currentAssignment = assignmentStatement;
            var binaryExpressionTokenStart = this.token;
            var operator = op.value.charAt(0);
            var rightExpr = this.parseExpr(assignmentStatement);
            var right = this.astProvider.parenthesisExpression({
                start: rightExpr.start,
                end: rightExpr.end,
                range: rightExpr.range,
                expression: rightExpr,
            });
            assignmentStatement.init = this.astProvider.binaryExpression({
                operator: operator,
                left: expr.clone(),
                right: right,
                start: binaryExpressionTokenStart.start,
                end: this.previousToken.end,
                range: [binaryExpressionTokenStart.range[0], this.previousToken.range[1]],
                scope: scope,
            });
            assignmentStatement.end = this.previousToken.end;
            assignmentStatement.range[1] = this.previousToken.range[1];
            this.currentAssignment = previousAssignment;
            scope.definitions.push(assignmentStatement);
            return assignmentStatement;
        }
        var expressions = [];
        while (this.token && !selector_1.Selectors.EndOfFile(this.token)) {
            var arg = this.parseExpr(null);
            expressions.push(arg);
            if (this.token && selector_1.SelectorGroups.BlockEndOfLine(this.token))
                break;
            if (this.token && selector_1.Selectors.Else(this.token))
                break;
            if (this.token && selector_1.Selectors.ArgumentSeparator(this.token)) {
                this.next();
                this.skipNewlines();
                continue;
            }
            var requiredToken = this.requireTokenOfAny(selector_1.SelectorGroups.AssignmentCommandArgs, startToken.start);
            if (selector_1.Selectors.EndOfLine(requiredToken) || selector_1.Selectors.EndOfFile(requiredToken))
                break;
        }
        if (expressions.length === 0) {
            return this.astProvider.callStatement({
                expression: expr,
                start: startToken.start,
                end: this.previousToken.end,
                range: [startToken.range[0], this.previousToken.range[1]],
                scope: scope,
            });
        }
        return this.astProvider.callStatement({
            expression: this.astProvider.callExpression({
                base: expr,
                arguments: expressions,
                start: startToken.start,
                end: this.previousToken.end,
                range: [startToken.range[0], this.previousToken.range[1]],
                scope: scope,
            }),
            start: startToken.start,
            end: this.previousToken.end,
            range: [startToken.range[0], this.previousToken.range[1]],
            scope: scope,
        });
    };
    Parser.prototype.parseReturnStatement = function () {
        var scope = this.currentScope;
        var startToken = this.previousToken;
        var expression = null;
        var returnStatement = this.astProvider.returnStatement({
            argument: null,
            start: startToken.start,
            end: null,
            range: [startToken.range[0], null],
            scope: scope,
        });
        if (selector_1.SelectorGroups.ReturnStatementEnd(this.token)) {
            returnStatement.end = this.previousToken.end;
            returnStatement.range[1] = this.previousToken.range[1];
        }
        else {
            expression = this.parseExpr(returnStatement);
            returnStatement.end = this.previousToken.end;
            returnStatement.range[1] = this.previousToken.range[1];
            returnStatement.argument = expression;
        }
        scope.returns.push(returnStatement);
        return returnStatement;
    };
    Parser.prototype.parseIfStatement = function () {
        var startToken = this.previousToken;
        var ifCondition = this.parseExpr(null);
        this.lineRegistry.addItemToLines(ifCondition);
        this.requireToken(selector_1.Selectors.Then, startToken.start);
        if (!selector_1.SelectorGroups.BlockEndOfLine(this.token)) {
            this.parseIfShortcutStatement(ifCondition, startToken);
            return;
        }
        var ifStatement = this.astProvider.ifStatement({
            clauses: [],
            start: startToken.start,
            end: null,
            range: [startToken.range[0], null],
            scope: this.currentScope,
        });
        var clause = this.astProvider.ifClause({
            condition: ifCondition,
            start: startToken.start,
            end: this.token.end,
            range: [startToken.range[0], this.token.range[1]],
            scope: this.currentScope,
        });
        var pendingBlock = new pending_block_1.PendingIf(ifStatement, clause, this.lineRegistry);
        this.backPatches.push(pendingBlock);
    };
    Parser.prototype.nextIfClause = function (type) {
        var pendingBlock = this.backPatches.peek();
        if (!(0, pending_block_1.isPendingIf)(pendingBlock)) {
            this.raise('no matching open if block', new range_1.Range(this.token.start, this.token.end));
            return;
        }
        pendingBlock.next(this.previousToken);
        switch (type) {
            case ast_1.ASTType.ElseifClause: {
                var ifStatementStartToken = this.token;
                var ifCondition = this.parseExpr(null);
                this.requireToken(selector_1.Selectors.Then, ifStatementStartToken.start);
                pendingBlock.currentClause = this.astProvider.elseifClause({
                    condition: ifCondition,
                    start: ifStatementStartToken.start,
                    end: null,
                    range: [ifStatementStartToken.range[0], null],
                    scope: this.currentScope,
                });
                break;
            }
            case ast_1.ASTType.ElseClause: {
                var elseStatementStartToken = this.token;
                pendingBlock.currentClause = this.astProvider.elseClause({
                    start: elseStatementStartToken.start,
                    end: null,
                    range: [elseStatementStartToken.range[0], null],
                    scope: this.currentScope,
                });
                break;
            }
        }
        if (type === null) {
            pendingBlock.complete(this.previousToken);
            this.backPatches.pop();
            this.backPatches.peek().body.push(pendingBlock.block);
        }
    };
    Parser.prototype.parseIfShortcutStatement = function (condition, startToken) {
        var clauses = [];
        var block = this.backPatches.peek();
        var ifStatement = this.astProvider.ifShortcutStatement({
            clauses: clauses,
            start: startToken.start,
            end: null,
            range: [startToken.range[0], null],
            scope: this.currentScope,
        });
        var item = this.parseShortcutStatement();
        clauses.push(this.astProvider.ifShortcutClause({
            condition: condition,
            body: [item],
            start: startToken.start,
            end: this.token.end,
            range: [startToken.range[0], this.token.range[1]],
            scope: this.currentScope,
        }));
        if (selector_1.Selectors.Else(this.token)) {
            this.next();
            var elseItemStartToken = this.token;
            var elseItem = this.parseShortcutStatement();
            clauses.push(this.astProvider.elseShortcutClause({
                body: [elseItem],
                start: elseItemStartToken.start,
                end: this.token.end,
                range: [elseItemStartToken.range[0], this.token.range[1]],
                scope: this.currentScope,
            }));
        }
        ifStatement.end = this.token.end;
        ifStatement.range[1] = this.token.range[1];
        this.lineRegistry.addItemToLines(ifStatement);
        block.body.push(ifStatement);
    };
    Parser.prototype.parseWhileStatement = function () {
        var startToken = this.previousToken;
        var condition = this.parseExpr(null);
        if (!condition) {
            this.raise("while requires a condition", new range_1.Range(startToken.start, this.token.end));
            return;
        }
        if (!selector_1.SelectorGroups.BlockEndOfLine(this.token)) {
            return this.parseWhileShortcutStatement(condition, startToken);
        }
        var whileStatement = this.astProvider.whileStatement({
            condition: condition,
            start: startToken.start,
            end: null,
            range: [startToken.range[0], null],
            scope: this.currentScope,
        });
        var pendingBlock = new pending_block_1.PendingWhile(whileStatement, this.lineRegistry);
        this.backPatches.push(pendingBlock);
        this.iteratorStack.push(whileStatement);
    };
    Parser.prototype.finalizeWhileStatement = function () {
        var pendingBlock = this.backPatches.peek();
        if (!(0, pending_block_1.isPendingWhile)(pendingBlock)) {
            this.raise('no matching open while block', new range_1.Range(this.token.start, this.token.end));
            return;
        }
        pendingBlock.complete(this.previousToken);
        this.iteratorStack.pop();
        this.backPatches.pop();
        this.backPatches.peek().body.push(pendingBlock.block);
    };
    Parser.prototype.parseWhileShortcutStatement = function (condition, startToken) {
        var block = this.backPatches.peek();
        var item = this.parseShortcutStatement();
        var whileStatement = this.astProvider.whileStatement({
            condition: condition,
            body: [item],
            start: startToken.start,
            end: this.previousToken.end,
            range: [startToken.range[0], this.previousToken.range[1]],
            scope: this.currentScope,
        });
        this.lineRegistry.addItemToLines(whileStatement);
        block.body.push(whileStatement);
    };
    Parser.prototype.parseForStatement = function () {
        var scope = this.currentScope;
        var startToken = this.previousToken;
        var variable = this.parseIdentifier(ast_1.ASTIdentifierKind.ForInVariable);
        this.requireToken(selector_1.Selectors.In, startToken.start);
        var iterator = this.parseExpr(null);
        if (!iterator) {
            this.raise("sequence expression expected for 'for' loop", new range_1.Range(startToken.start, this.token.end));
            return;
        }
        if (!selector_1.SelectorGroups.BlockEndOfLine(this.token)) {
            return this.parseForShortcutStatement(variable, iterator, startToken);
        }
        var forStatement = this.astProvider.forGenericStatement({
            variable: variable,
            iterator: iterator,
            start: startToken.start,
            end: this.previousToken.end,
            range: [startToken.range[0], this.previousToken.range[1]],
            scope: scope,
        });
        scope.definitions.push(forStatement);
        var pendingBlock = new pending_block_1.PendingFor(forStatement, this.lineRegistry);
        this.backPatches.push(pendingBlock);
        this.iteratorStack.push(forStatement);
    };
    Parser.prototype.finalizeForStatement = function () {
        var pendingBlock = this.backPatches.peek();
        if (!(0, pending_block_1.isPendingFor)(pendingBlock)) {
            this.raise('no matching open for block', new range_1.Range(this.token.start, this.token.end));
            return;
        }
        pendingBlock.complete(this.previousToken);
        this.iteratorStack.pop();
        this.backPatches.pop();
        this.backPatches.peek().body.push(pendingBlock.block);
    };
    Parser.prototype.parseForShortcutStatement = function (variable, iterator, startToken) {
        var scope = this.currentScope;
        var block = this.backPatches.peek();
        var item = this.parseShortcutStatement();
        var forStatement = this.astProvider.forGenericStatement({
            variable: variable,
            iterator: iterator,
            body: [item],
            start: startToken.start,
            end: this.previousToken.end,
            range: [startToken.range[0], this.previousToken.range[1]],
            scope: this.currentScope,
        });
        scope.definitions.push(forStatement);
        this.lineRegistry.addItemToLines(forStatement);
        block.body.push(forStatement);
    };
    Parser.prototype.parseExpr = function (base, asLVal, statementStart) {
        if (asLVal === void 0) { asLVal = false; }
        if (statementStart === void 0) { statementStart = false; }
        return this.parseFunctionDeclaration(base, asLVal, statementStart);
    };
    Parser.prototype.parseFunctionDeclaration = function (base, asLVal, statementStart) {
        if (asLVal === void 0) { asLVal = false; }
        if (statementStart === void 0) { statementStart = false; }
        if (!selector_1.Selectors.Function(this.token))
            return this.parseOr(asLVal, statementStart);
        this.next();
        var functionStartToken = this.previousToken;
        // Check if this is a named function: function X(...)
        var functionName = null;
        if (statementStart && this.isType(token_1.TokenType.Identifier)) {
            // This is a named function declaration
            var parsed = this.parseIdentifier(ast_1.ASTIdentifierKind.Variable);
            if (parsed instanceof ast_1.ASTIdentifier) {
                functionName = parsed;
            }
        }
        var functionStatement = this.astProvider.functionStatement({
            start: functionStartToken.start,
            end: null,
            range: [functionStartToken.range[0], null],
            scope: this.currentScope,
            parent: this.outerScopes[this.outerScopes.length - 1],
            assignment: this.currentAssignment,
        });
        var parameters = [];
        this.pushScope(functionStatement);
        if (!selector_1.SelectorGroups.BlockEndOfLine(this.token)) {
            this.requireToken(selector_1.Selectors.LParenthesis, functionStartToken.start);
            while (!selector_1.SelectorGroups.FunctionDeclarationArgEnd(this.token)) {
                var parameter = this.parseIdentifier(ast_1.ASTIdentifierKind.Argument);
                var parameterStartToken = parameter;
                if (this.consume(selector_1.Selectors.Assign)) {
                    var defaultValue = this.parseExpr(null);
                    if (defaultValue instanceof ast_1.ASTLiteral) {
                        var assign = this.astProvider.assignmentStatement({
                            variable: parameter,
                            init: defaultValue,
                            start: parameterStartToken.start,
                            end: this.previousToken.end,
                            range: [parameterStartToken.range[0], this.previousToken.range[1]],
                            scope: this.currentScope,
                        });
                        this.currentScope.definitions.push(assign);
                        parameters.push(assign);
                    }
                    else {
                        this.raise("parameter default value must be a literal value", new range_1.Range(parameterStartToken.start, this.token.end));
                        parameters.push(this.astProvider.invalidCodeExpression({
                            start: parameterStartToken.start,
                            end: this.previousToken.end,
                            range: [parameterStartToken.range[0], this.previousToken.range[1]],
                        }));
                    }
                }
                else {
                    var assign = this.astProvider.assignmentStatement({
                        variable: parameter,
                        init: this.astProvider.unknown({
                            start: parameterStartToken.start,
                            end: this.previousToken.end,
                            range: [parameterStartToken.range[0], this.previousToken.range[1]],
                            scope: this.currentScope,
                        }),
                        start: parameterStartToken.start,
                        end: this.previousToken.end,
                        range: [parameterStartToken.range[0], this.previousToken.range[1]],
                        scope: this.currentScope,
                    });
                    this.currentScope.definitions.push(assign);
                    parameters.push(parameter);
                }
                if (selector_1.Selectors.RParenthesis(this.token))
                    break;
                this.requireToken(selector_1.Selectors.ArgumentSeparator, functionStartToken.start);
                if (selector_1.Selectors.RParenthesis(this.token)) {
                    this.raise('expected argument instead received right parenthesis', new range_1.Range(this.previousToken.end, this.previousToken.end));
                    break;
                }
            }
            this.requireToken(selector_1.Selectors.RParenthesis, functionStartToken.start);
        }
        functionStatement.parameters = parameters;
        var pendingBlock = new pending_block_1.PendingFunction(functionStatement, base, this.lineRegistry);
        this.backPatches.push(pendingBlock);
        // If this is a named function, create an assignment statement
        if (functionName) {
            var assignmentStatement = this.astProvider.assignmentStatement({
                variable: functionName,
                init: functionStatement,
                start: functionStartToken.start,
                end: null, // Will be set when function is finalized
                range: [functionStartToken.range[0], null],
                scope: this.currentScope,
            });
            // Store the assignment in the pending block so we can finalize it later
            pendingBlock.namedFunctionAssignment = assignmentStatement;
            return assignmentStatement;
        }
        return functionStatement;
    };
    Parser.prototype.finalizeFunction = function () {
        var pendingBlock = this.backPatches.peek();
        if (!(0, pending_block_1.isPendingFunction)(pendingBlock)) {
            this.raise('no matching open function block', new range_1.Range(this.token.start, this.token.end));
            return;
        }
        this.popScope();
        pendingBlock.complete(this.previousToken);
        this.backPatches.pop();
    };
    Parser.prototype.parseOr = function (asLVal, statementStart) {
        if (asLVal === void 0) { asLVal = false; }
        if (statementStart === void 0) { statementStart = false; }
        var startToken = this.token;
        var val = this.parseAnd(asLVal, statementStart);
        var base = val;
        while (selector_1.Selectors.Or(this.token)) {
            this.next();
            this.skipNewlines();
            var opB = this.parseAnd();
            base = this.astProvider.logicalExpression({
                operator: operators_1.Operator.Or,
                left: base,
                right: opB,
                start: startToken.start,
                end: this.previousToken.end,
                range: [startToken.range[0], this.previousToken.range[1]],
                scope: this.currentScope,
            });
        }
        return base;
    };
    Parser.prototype.parseAnd = function (asLVal, statementStart) {
        if (asLVal === void 0) { asLVal = false; }
        if (statementStart === void 0) { statementStart = false; }
        var startToken = this.token;
        var val = this.parseNot(asLVal, statementStart);
        var base = val;
        while (selector_1.Selectors.And(this.token)) {
            this.next();
            this.skipNewlines();
            var opB = this.parseNot();
            base = this.astProvider.logicalExpression({
                operator: operators_1.Operator.And,
                left: base,
                right: opB,
                start: startToken.start,
                end: this.previousToken.end,
                range: [startToken.range[0], this.previousToken.range[1]],
                scope: this.currentScope,
            });
        }
        return base;
    };
    Parser.prototype.parseNot = function (asLVal, statementStart) {
        if (asLVal === void 0) { asLVal = false; }
        if (statementStart === void 0) { statementStart = false; }
        var startToken = this.token;
        if (selector_1.Selectors.Not(this.token)) {
            this.next();
            this.skipNewlines();
            var val = this.parseIsa();
            return this.astProvider.unaryExpression({
                operator: operators_1.Operator.Not,
                argument: val,
                start: startToken.start,
                end: this.previousToken.end,
                range: [startToken.range[0], this.previousToken.range[1]],
                scope: this.currentScope,
            });
        }
        return this.parseIsa(asLVal, statementStart);
    };
    Parser.prototype.parseIsa = function (asLVal, statementStart) {
        if (asLVal === void 0) { asLVal = false; }
        if (statementStart === void 0) { statementStart = false; }
        var startToken = this.token;
        var val = this.parseComparisons(asLVal, statementStart);
        if (selector_1.Selectors.Isa(this.token)) {
            this.next();
            this.skipNewlines();
            var opB = this.parseComparisons();
            return this.astProvider.isaExpression({
                operator: operators_1.Operator.Isa,
                left: val,
                right: opB,
                start: startToken.start,
                end: this.previousToken.end,
                range: [startToken.range[0], this.previousToken.range[1]],
                scope: this.currentScope,
            });
        }
        return val;
    };
    Parser.prototype.parseComparisons = function (asLVal, statementStart) {
        if (asLVal === void 0) { asLVal = false; }
        if (statementStart === void 0) { statementStart = false; }
        var startToken = this.token;
        var val = this.parseAddSub(asLVal, statementStart);
        if (!selector_1.SelectorGroups.ComparisonOperators(this.token))
            return val;
        var expressions = [val];
        var operators = [];
        do {
            var token = this.token;
            this.next();
            this.skipNewlines();
            var right = this.parseAddSub();
            operators.push(token.value);
            expressions.push(right);
        } while (selector_1.SelectorGroups.ComparisonOperators(this.token));
        if (operators.length === 1) {
            return this.astProvider.binaryExpression({
                operator: operators[0],
                left: expressions[0],
                right: expressions[1],
                start: startToken.start,
                end: this.previousToken.end,
                range: [startToken.range[0], this.previousToken.range[1]],
                scope: this.currentScope,
            });
        }
        return this.astProvider.comparisonGroupExpression({
            operators: operators,
            expressions: expressions,
            start: startToken.start,
            end: this.previousToken.end,
            range: [startToken.range[0], this.previousToken.range[1]],
            scope: this.currentScope,
        });
    };
    Parser.prototype.parseAddSub = function (asLVal, statementStart) {
        if (asLVal === void 0) { asLVal = false; }
        if (statementStart === void 0) { statementStart = false; }
        var startToken = this.token;
        var val = this.parseMulDiv(asLVal, statementStart);
        var base = val;
        while (selector_1.Selectors.Plus(this.token) ||
            (selector_1.Selectors.Minus(this.token) &&
                (!statementStart || !this.token.afterSpace || this.lexer.isAtWhitespace()))) {
            var token = this.token;
            this.next();
            this.skipNewlines();
            var opB = this.parseMulDiv();
            base = this.astProvider.binaryExpression({
                operator: token.value,
                left: base,
                right: opB,
                start: startToken.start,
                end: this.previousToken.end,
                range: [startToken.range[0], this.previousToken.range[1]],
                scope: this.currentScope,
            });
        }
        return base;
    };
    Parser.prototype.parseMulDiv = function (asLVal, statementStart) {
        if (asLVal === void 0) { asLVal = false; }
        if (statementStart === void 0) { statementStart = false; }
        var startToken = this.token;
        var val = this.parseUnaryMinus(asLVal, statementStart);
        var base = val;
        while (selector_1.SelectorGroups.MultiDivOperators(this.token)) {
            var token = this.token;
            this.next();
            this.skipNewlines();
            var opB = this.parseUnaryMinus();
            base = this.astProvider.binaryExpression({
                operator: token.value,
                left: base,
                right: opB,
                start: startToken.start,
                end: this.previousToken.end,
                range: [startToken.range[0], this.previousToken.range[1]],
                scope: this.currentScope,
            });
        }
        return base;
    };
    Parser.prototype.parseUnaryMinus = function (asLVal, statementStart) {
        if (asLVal === void 0) { asLVal = false; }
        if (statementStart === void 0) { statementStart = false; }
        if (!selector_1.Selectors.Minus(this.token)) {
            return this.parseNew(asLVal, statementStart);
        }
        var startToken = this.token;
        this.next();
        this.skipNewlines();
        var val = this.parseNew();
        if (val instanceof ast_1.ASTNumericLiteral || val instanceof ast_1.ASTBooleanLiteral) {
            val.negated = true;
            return val;
        }
        return this.astProvider.unaryExpression({
            operator: operators_1.Operator.Minus,
            argument: val,
            start: startToken.start,
            end: this.previousToken.end,
            range: [startToken.range[0], this.previousToken.range[1]],
            scope: this.currentScope,
        });
    };
    Parser.prototype.parseNew = function (asLVal, statementStart) {
        if (asLVal === void 0) { asLVal = false; }
        if (statementStart === void 0) { statementStart = false; }
        if (!selector_1.Selectors.New(this.token)) {
            return this.parseAddressOf(asLVal, statementStart);
        }
        var startToken = this.token;
        this.next();
        this.skipNewlines();
        var val = this.parseNew();
        return this.astProvider.unaryExpression({
            operator: operators_1.Operator.New,
            argument: val,
            start: startToken.start,
            end: this.previousToken.end,
            range: [startToken.range[0], this.previousToken.range[1]],
            scope: this.currentScope,
        });
    };
    Parser.prototype.parseAddressOf = function (asLVal, statementStart) {
        if (asLVal === void 0) { asLVal = false; }
        if (statementStart === void 0) { statementStart = false; }
        if (!selector_1.Selectors.Reference(this.token)) {
            return this.parsePower(asLVal, statementStart);
        }
        var startToken = this.token;
        this.next();
        this.skipNewlines();
        var val = this.parsePower(true, statementStart);
        return this.astProvider.unaryExpression({
            operator: operators_1.Operator.Reference,
            argument: val,
            start: startToken.start,
            end: this.previousToken.end,
            range: [startToken.range[0], this.previousToken.range[1]],
            scope: this.currentScope,
        });
    };
    Parser.prototype.parsePower = function (asLVal, statementStart) {
        if (asLVal === void 0) { asLVal = false; }
        if (statementStart === void 0) { statementStart = false; }
        var startToken = this.token;
        var val = this.parseCallExpr(asLVal, statementStart);
        if (selector_1.Selectors.Power(this.token)) {
            this.next();
            this.skipNewlines();
            var opB = this.parseCallExpr();
            return this.astProvider.binaryExpression({
                operator: operators_1.Operator.Power,
                left: val,
                right: opB,
                start: startToken.start,
                end: this.previousToken.end,
                range: [startToken.range[0], this.previousToken.range[1]],
                scope: this.currentScope,
            });
        }
        return val;
    };
    Parser.prototype.parseCallExpr = function (asLVal, statementStart) {
        if (asLVal === void 0) { asLVal = false; }
        if (statementStart === void 0) { statementStart = false; }
        var startToken = this.token;
        var base = this.parseMap(asLVal, statementStart);
        while (!selector_1.Selectors.EndOfFile(this.token)) {
            if (selector_1.Selectors.MemberSeparator(this.token)) {
                this.next();
                this.skipNewlines();
                var identifier = this.parseIdentifier(ast_1.ASTIdentifierKind.Property);
                var memberExpr = this.astProvider.memberExpression({
                    base: base,
                    indexer: operators_1.Operator.Member,
                    identifier: identifier,
                    start: startToken.start,
                    end: this.previousToken.end,
                    range: [startToken.range[0], this.previousToken.range[1]],
                    scope: this.currentScope,
                });
                this.currentScope.namespaces.push(memberExpr);
                base = memberExpr;
            }
            else if (selector_1.Selectors.SLBracket(this.token) && !this.token.afterSpace) {
                this.next();
                this.skipNewlines();
                if (selector_1.Selectors.SliceSeparator(this.token)) {
                    var left = this.astProvider.emptyExpression({
                        start: this.previousToken.start,
                        end: this.previousToken.end,
                        range: this.previousToken.range,
                        scope: this.currentScope,
                    });
                    this.next();
                    this.skipNewlines();
                    var right = selector_1.Selectors.SRBracket(this.token)
                        ? this.astProvider.emptyExpression({
                            start: this.previousToken.start,
                            end: this.previousToken.end,
                            range: this.previousToken.range,
                            scope: this.currentScope,
                        })
                        : this.parseExpr(null);
                    base = this.astProvider.sliceExpression({
                        base: base,
                        left: left,
                        right: right,
                        start: startToken.start,
                        end: this.token.end,
                        range: [startToken.range[0], this.token.range[1]],
                        scope: this.currentScope,
                    });
                }
                else {
                    var index = this.parseExpr(null);
                    if (selector_1.Selectors.SliceSeparator(this.token)) {
                        this.next();
                        this.skipNewlines();
                        var right = selector_1.Selectors.SRBracket(this.token)
                            ? this.astProvider.emptyExpression({
                                start: this.previousToken.start,
                                end: this.previousToken.end,
                                range: this.previousToken.range,
                                scope: this.currentScope,
                            })
                            : this.parseExpr(null);
                        base = this.astProvider.sliceExpression({
                            base: base,
                            left: index,
                            right: right,
                            start: startToken.start,
                            end: this.token.end,
                            range: [startToken.range[0], this.token.range[1]],
                            scope: this.currentScope,
                        });
                    }
                    else {
                        base = this.astProvider.indexExpression({
                            base: base,
                            index: index,
                            isStatementStart: statementStart,
                            start: startToken.start,
                            end: this.token.end,
                            range: [startToken.range[0], this.token.range[1]],
                            scope: this.currentScope,
                        });
                    }
                }
                this.requireToken(selector_1.Selectors.SRBracket, startToken.start);
            }
            else if (selector_1.Selectors.LParenthesis(this.token) && (!asLVal || !this.token.afterSpace)) {
                var expressions = this.parseCallArgs();
                base = this.astProvider.callExpression({
                    base: base,
                    arguments: expressions,
                    start: startToken.start,
                    end: this.previousToken.end,
                    range: [startToken.range[0], this.previousToken.range[1]],
                    scope: this.currentScope,
                });
            }
            else {
                break;
            }
        }
        return base;
    };
    Parser.prototype.parseCallArgs = function () {
        var expressions = [];
        if (selector_1.Selectors.LParenthesis(this.token)) {
            this.next();
            if (selector_1.Selectors.RParenthesis(this.token)) {
                this.next();
            }
            else {
                while (!selector_1.Selectors.EndOfFile(this.token)) {
                    this.skipNewlines();
                    var arg = this.parseExpr(null);
                    expressions.push(arg);
                    this.skipNewlines();
                    if (selector_1.Selectors.RParenthesis(this.requireTokenOfAny(selector_1.SelectorGroups.CallArgsEnd, arg.start)))
                        break;
                }
            }
        }
        return expressions;
    };
    Parser.prototype.parseMap = function (asLVal, statementStart) {
        if (asLVal === void 0) { asLVal = false; }
        if (statementStart === void 0) { statementStart = false; }
        if (!selector_1.Selectors.CLBracket(this.token)) {
            return this.parseList(asLVal, statementStart);
        }
        var scope = this.currentScope;
        var startToken = this.token;
        var fields = [];
        var mapConstructorExpr = this.astProvider.mapConstructorExpression({
            fields: fields,
            start: startToken.start,
            end: null,
            range: [startToken.range[0], null],
            scope: scope,
        });
        this.next();
        if (selector_1.Selectors.CRBracket(this.token)) {
            this.next();
        }
        else {
            this.skipNewlines();
            while (!selector_1.Selectors.EndOfFile(this.token)) {
                if (selector_1.Selectors.CRBracket(this.token)) {
                    this.next();
                    break;
                }
                var keyValueItem = this.astProvider.mapKeyString({
                    key: null,
                    value: null,
                    start: this.token.start,
                    end: null,
                    range: [this.token.range[0], null],
                    scope: scope,
                });
                keyValueItem.key = this.parseExpr(null);
                if (this.consume(selector_1.Selectors.MapKeyValueSeparator)) {
                    this.skipNewlines();
                    keyValueItem.value = this.parseExpr(keyValueItem);
                }
                else {
                    keyValueItem.value = keyValueItem.key;
                }
                keyValueItem.end = this.previousToken.end;
                keyValueItem.range[1] = this.previousToken.range[1];
                fields.push(keyValueItem);
                if (selector_1.Selectors.MapSeparator(this.token)) {
                    this.next();
                    this.skipNewlines();
                }
                if (selector_1.Selectors.CRBracket(this.token)) {
                    this.next();
                    break;
                }
            }
        }
        mapConstructorExpr.end = this.token.start;
        mapConstructorExpr.range[1] = this.token.range[1];
        return mapConstructorExpr;
    };
    Parser.prototype.parseList = function (asLVal, statementStart) {
        if (asLVal === void 0) { asLVal = false; }
        if (statementStart === void 0) { statementStart = false; }
        if (!selector_1.Selectors.SLBracket(this.token)) {
            return this.parseQuantity(asLVal, statementStart);
        }
        var scope = this.currentScope;
        var startToken = this.token;
        var fields = [];
        var listConstructorExpr = this.astProvider.listConstructorExpression({
            fields: fields,
            start: startToken.start,
            end: null,
            range: [startToken.range[0], null],
            scope: scope,
        });
        this.next();
        if (selector_1.Selectors.SRBracket(this.token)) {
            this.next();
        }
        else {
            this.skipNewlines();
            while (!selector_1.Selectors.EndOfFile(this.token)) {
                if (selector_1.Selectors.SRBracket(this.token)) {
                    this.next();
                    break;
                }
                var listValue = this.astProvider.listValue({
                    value: null,
                    start: this.token.start,
                    end: null,
                    range: [this.token.range[0], null],
                    scope: scope,
                });
                listValue.value = this.parseExpr(listValue);
                listValue.end = this.previousToken.end;
                listValue.range[1] = this.previousToken.range[1];
                fields.push(listValue);
                if (selector_1.Selectors.MapSeparator(this.token)) {
                    this.next();
                    this.skipNewlines();
                }
                if (selector_1.Selectors.SRBracket(this.token)) {
                    this.next();
                    break;
                }
            }
        }
        listConstructorExpr.end = this.token.start;
        listConstructorExpr.range[1] = this.token.range[1];
        return listConstructorExpr;
    };
    Parser.prototype.parseQuantity = function (asLVal, statementStart) {
        if (asLVal === void 0) { asLVal = false; }
        if (statementStart === void 0) { statementStart = false; }
        if (!selector_1.Selectors.LParenthesis(this.token)) {
            return this.parseAtom(asLVal, statementStart);
        }
        var startToken = this.token;
        this.next();
        this.skipNewlines();
        var val = this.parseExpr(null);
        this.requireToken(selector_1.Selectors.RParenthesis, startToken.start);
        return this.astProvider.parenthesisExpression({
            expression: val,
            start: startToken.start,
            end: this.previousToken.end,
            range: [startToken.range[0], this.previousToken.range[1]],
            scope: this.currentScope,
        });
    };
    Parser.prototype.parseAtom = function (_asLval, _statementStart) {
        if (_asLval === void 0) { _asLval = false; }
        if (_statementStart === void 0) { _statementStart = false; }
        if (this.validator.isLiteral(this.token.type)) {
            return this.parseLiteral();
        }
        else if (this.isType(token_1.TokenType.Identifier)) {
            return this.parseIdentifier(ast_1.ASTIdentifierKind.Variable);
        }
        this.raise("got ".concat(this.token, " where number, string, or identifier is required"), new range_1.Range(this.token.start, this.token.end));
        return this.parseInvalidCode();
    };
    Parser.prototype.parseLiteral = function () {
        var startToken = this.token;
        var type = this.token.type;
        var base = this.astProvider.literal(type, {
            value: this.token.value,
            raw: this.token.raw,
            start: startToken.start,
            end: this.token.end,
            range: [startToken.range[0], this.token.range[1]],
            scope: this.currentScope,
        });
        this.literals.push(base);
        this.next();
        return base;
    };
    Parser.prototype.parseIdentifier = function (kind) {
        var identifierToken = this.requireType(token_1.TokenType.Identifier);
        if (identifierToken === null) {
            return this.parseInvalidCode();
        }
        var identifier = this.astProvider.identifier({
            kind: kind,
            name: identifierToken.value,
            start: identifierToken.start,
            end: identifierToken.end,
            range: identifierToken.range,
            scope: this.currentScope,
        });
        if (kind !== ast_1.ASTIdentifierKind.Property) {
            this.currentScope.namespaces.push(identifier);
        }
        return identifier;
    };
    Parser.prototype.parseInvalidCode = function () {
        var invalidToken = this.token;
        var base = this.astProvider.invalidCodeExpression({
            start: invalidToken.start,
            end: invalidToken.end,
            range: invalidToken.range,
        });
        this.next();
        return base;
    };
    Parser.prototype.raise = function (message, range) {
        var err = new errors_1.ParserException(message, range);
        this.statementErrors.push(err);
        return err;
    };
    return Parser;
}());
exports.default = Parser;
