"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASTWhileStatement = exports.ASTUnaryExpression = exports.ASTSliceExpression = exports.ASTReturnStatement = exports.ASTParenthesisExpression = exports.ASTMapKeyString = exports.ASTMapConstructorExpression = exports.ASTLogicalExpression = exports.ASTStringLiteral = exports.ASTNumericLiteral = exports.ASTNilLiteral = exports.ASTLiteral = exports.ASTBooleanLiteral = exports.ASTListValue = exports.ASTListConstructorExpression = exports.ASTIsaExpression = exports.ASTIfStatement = exports.ASTIfClause = exports.ASTElseClause = exports.ASTClause = exports.ASTMemberExpression = exports.ASTIndexExpression = exports.ASTIdentifierKind = exports.ASTIdentifier = exports.ASTFunctionStatement = exports.ASTForGenericStatement = exports.ASTContinueStatement = exports.ASTComparisonGroupExpression = exports.ASTChunk = exports.ASTCallStatement = exports.ASTCallExpression = exports.ASTBreakStatement = exports.ASTBinaryExpression = exports.ASTType = exports.ASTComment = exports.ASTBaseBlockWithScope = exports.ASTBaseBlock = exports.ASTBase = exports.ASTAssignmentStatement = exports.ASTProviderWithCallback = exports.ASTProvider = void 0;
var token_1 = require("../lexer/token");
var ast_1 = require("./ast");
var assignment_1 = require("./ast/assignment");
var base_1 = require("./ast/base");
var binary_1 = require("./ast/binary");
var call_1 = require("./ast/call");
var chunk_1 = require("./ast/chunk");
var comparison_group_1 = require("./ast/comparison-group");
var for_1 = require("./ast/for");
var function_1 = require("./ast/function");
var identifier_1 = require("./ast/identifier");
var if_1 = require("./ast/if");
var isa_1 = require("./ast/isa");
var list_1 = require("./ast/list");
var literal_1 = require("./ast/literal");
var logical_1 = require("./ast/logical");
var map_1 = require("./ast/map");
var parenthesis_1 = require("./ast/parenthesis");
var return_1 = require("./ast/return");
var slice_1 = require("./ast/slice");
var unary_1 = require("./ast/unary");
var while_1 = require("./ast/while");
var ASTProvider = /** @class */ (function () {
    function ASTProvider() {
    }
    ASTProvider.prototype.returnStatement = function (options) {
        return new return_1.ASTReturnStatement(options);
    };
    ASTProvider.prototype.ifShortcutStatement = function (options) {
        return new if_1.ASTIfStatement(base_1.ASTType.IfShortcutStatement, options);
    };
    ASTProvider.prototype.ifShortcutClause = function (options) {
        return new if_1.ASTIfClause(base_1.ASTType.IfShortcutClause, options);
    };
    ASTProvider.prototype.elseifShortcutClause = function (options) {
        return new if_1.ASTIfClause(base_1.ASTType.ElseifShortcutClause, options);
    };
    ASTProvider.prototype.elseShortcutClause = function (options) {
        return new if_1.ASTElseClause(base_1.ASTType.ElseShortcutClause, options);
    };
    ASTProvider.prototype.ifStatement = function (options) {
        return new if_1.ASTIfStatement(base_1.ASTType.IfStatement, options);
    };
    ASTProvider.prototype.ifClause = function (options) {
        return new if_1.ASTIfClause(base_1.ASTType.IfClause, options);
    };
    ASTProvider.prototype.elseifClause = function (options) {
        return new if_1.ASTIfClause(base_1.ASTType.ElseifClause, options);
    };
    ASTProvider.prototype.elseClause = function (options) {
        return new if_1.ASTElseClause(base_1.ASTType.ElseClause, options);
    };
    ASTProvider.prototype.whileStatement = function (options) {
        return new while_1.ASTWhileStatement(options);
    };
    ASTProvider.prototype.assignmentStatement = function (options) {
        return new assignment_1.ASTAssignmentStatement(options);
    };
    ASTProvider.prototype.callStatement = function (options) {
        return new call_1.ASTCallStatement(options);
    };
    ASTProvider.prototype.functionStatement = function (options) {
        return new function_1.ASTFunctionStatement(options);
    };
    ASTProvider.prototype.forGenericStatement = function (options) {
        return new for_1.ASTForGenericStatement(options);
    };
    ASTProvider.prototype.chunk = function (options) {
        return new chunk_1.ASTChunk(options);
    };
    ASTProvider.prototype.identifier = function (options) {
        return new identifier_1.ASTIdentifier(options);
    };
    ASTProvider.prototype.literal = function (type, options) {
        switch (type) {
            case token_1.TokenType.StringLiteral:
                return new literal_1.ASTStringLiteral(options);
            case token_1.TokenType.NumericLiteral:
                return new literal_1.ASTNumericLiteral(options);
            case token_1.TokenType.BooleanLiteral:
                return new literal_1.ASTBooleanLiteral(options);
            case token_1.TokenType.NilLiteral:
                return new literal_1.ASTNilLiteral(options);
        }
    };
    ASTProvider.prototype.memberExpression = function (options) {
        return new identifier_1.ASTMemberExpression(options);
    };
    ASTProvider.prototype.callExpression = function (options) {
        return new call_1.ASTCallExpression(options);
    };
    ASTProvider.prototype.comment = function (options) {
        return new base_1.ASTComment(options);
    };
    ASTProvider.prototype.unaryExpression = function (options) {
        return new unary_1.ASTUnaryExpression(options);
    };
    ASTProvider.prototype.mapKeyString = function (options) {
        return new map_1.ASTMapKeyString(options);
    };
    ASTProvider.prototype.mapConstructorExpression = function (options) {
        return new map_1.ASTMapConstructorExpression(options);
    };
    ASTProvider.prototype.listValue = function (options) {
        return new list_1.ASTListValue(options);
    };
    ASTProvider.prototype.listConstructorExpression = function (options) {
        return new list_1.ASTListConstructorExpression(options);
    };
    ASTProvider.prototype.unknown = function (options) {
        return new base_1.ASTBase(base_1.ASTType.Unknown, options);
    };
    ASTProvider.prototype.emptyExpression = function (options) {
        return new base_1.ASTBase(base_1.ASTType.EmptyExpression, options);
    };
    ASTProvider.prototype.invalidCodeExpression = function (options) {
        return new base_1.ASTBase(base_1.ASTType.InvalidCodeExpression, options);
    };
    ASTProvider.prototype.indexExpression = function (options) {
        return new identifier_1.ASTIndexExpression(options);
    };
    ASTProvider.prototype.logicalExpression = function (options) {
        return new logical_1.ASTLogicalExpression(options);
    };
    ASTProvider.prototype.isaExpression = function (options) {
        return new isa_1.ASTIsaExpression(options);
    };
    ASTProvider.prototype.binaryExpression = function (options) {
        return new binary_1.ASTBinaryExpression(options);
    };
    ASTProvider.prototype.sliceExpression = function (options) {
        return new slice_1.ASTSliceExpression(options);
    };
    ASTProvider.prototype.parenthesisExpression = function (options) {
        return new parenthesis_1.ASTParenthesisExpression(options);
    };
    ASTProvider.prototype.comparisonGroupExpression = function (options) {
        return new comparison_group_1.ASTComparisonGroupExpression(options);
    };
    ASTProvider.prototype.breakStatement = function (options) {
        return new ast_1.ASTBreakStatement(options);
    };
    ASTProvider.prototype.continueStatement = function (options) {
        return new ast_1.ASTContinueStatement(options);
    };
    return ASTProvider;
}());
exports.ASTProvider = ASTProvider;
/**
 * Custom ASTProvider that calls a callback whenever an ASTFunctionStatement is created
 */
var ASTProviderWithCallback = /** @class */ (function (_super) {
    __extends(ASTProviderWithCallback, _super);
    function ASTProviderWithCallback(onFunctionStatement) {
        var _this = _super.call(this) || this;
        _this.onFunctionStatement = onFunctionStatement;
        return _this;
    }
    /**
     * Override the functionStatement method to call our callback
     */
    ASTProviderWithCallback.prototype.functionStatement = function (options) {
        var func = _super.prototype.functionStatement.call(this, options);
        // Call the callback if provided
        if (this.onFunctionStatement) {
            this.onFunctionStatement(func);
        }
        return func;
    };
    return ASTProviderWithCallback;
}(ASTProvider));
exports.ASTProviderWithCallback = ASTProviderWithCallback;
var assignment_2 = require("./ast/assignment");
Object.defineProperty(exports, "ASTAssignmentStatement", { enumerable: true, get: function () { return assignment_2.ASTAssignmentStatement; } });
var base_2 = require("./ast/base");
Object.defineProperty(exports, "ASTBase", { enumerable: true, get: function () { return base_2.ASTBase; } });
Object.defineProperty(exports, "ASTBaseBlock", { enumerable: true, get: function () { return base_2.ASTBaseBlock; } });
Object.defineProperty(exports, "ASTBaseBlockWithScope", { enumerable: true, get: function () { return base_2.ASTBaseBlockWithScope; } });
Object.defineProperty(exports, "ASTComment", { enumerable: true, get: function () { return base_2.ASTComment; } });
Object.defineProperty(exports, "ASTType", { enumerable: true, get: function () { return base_2.ASTType; } });
var binary_2 = require("./ast/binary");
Object.defineProperty(exports, "ASTBinaryExpression", { enumerable: true, get: function () { return binary_2.ASTBinaryExpression; } });
var break_1 = require("./ast/break");
Object.defineProperty(exports, "ASTBreakStatement", { enumerable: true, get: function () { return break_1.ASTBreakStatement; } });
var call_2 = require("./ast/call");
Object.defineProperty(exports, "ASTCallExpression", { enumerable: true, get: function () { return call_2.ASTCallExpression; } });
Object.defineProperty(exports, "ASTCallStatement", { enumerable: true, get: function () { return call_2.ASTCallStatement; } });
var chunk_2 = require("./ast/chunk");
Object.defineProperty(exports, "ASTChunk", { enumerable: true, get: function () { return chunk_2.ASTChunk; } });
var comparison_group_2 = require("./ast/comparison-group");
Object.defineProperty(exports, "ASTComparisonGroupExpression", { enumerable: true, get: function () { return comparison_group_2.ASTComparisonGroupExpression; } });
var continue_1 = require("./ast/continue");
Object.defineProperty(exports, "ASTContinueStatement", { enumerable: true, get: function () { return continue_1.ASTContinueStatement; } });
var for_2 = require("./ast/for");
Object.defineProperty(exports, "ASTForGenericStatement", { enumerable: true, get: function () { return for_2.ASTForGenericStatement; } });
var function_2 = require("./ast/function");
Object.defineProperty(exports, "ASTFunctionStatement", { enumerable: true, get: function () { return function_2.ASTFunctionStatement; } });
var identifier_2 = require("./ast/identifier");
Object.defineProperty(exports, "ASTIdentifier", { enumerable: true, get: function () { return identifier_2.ASTIdentifier; } });
Object.defineProperty(exports, "ASTIdentifierKind", { enumerable: true, get: function () { return identifier_2.ASTIdentifierKind; } });
Object.defineProperty(exports, "ASTIndexExpression", { enumerable: true, get: function () { return identifier_2.ASTIndexExpression; } });
Object.defineProperty(exports, "ASTMemberExpression", { enumerable: true, get: function () { return identifier_2.ASTMemberExpression; } });
var if_2 = require("./ast/if");
Object.defineProperty(exports, "ASTClause", { enumerable: true, get: function () { return if_2.ASTClause; } });
Object.defineProperty(exports, "ASTElseClause", { enumerable: true, get: function () { return if_2.ASTElseClause; } });
Object.defineProperty(exports, "ASTIfClause", { enumerable: true, get: function () { return if_2.ASTIfClause; } });
Object.defineProperty(exports, "ASTIfStatement", { enumerable: true, get: function () { return if_2.ASTIfStatement; } });
var isa_2 = require("./ast/isa");
Object.defineProperty(exports, "ASTIsaExpression", { enumerable: true, get: function () { return isa_2.ASTIsaExpression; } });
var list_2 = require("./ast/list");
Object.defineProperty(exports, "ASTListConstructorExpression", { enumerable: true, get: function () { return list_2.ASTListConstructorExpression; } });
Object.defineProperty(exports, "ASTListValue", { enumerable: true, get: function () { return list_2.ASTListValue; } });
var literal_2 = require("./ast/literal");
Object.defineProperty(exports, "ASTBooleanLiteral", { enumerable: true, get: function () { return literal_2.ASTBooleanLiteral; } });
Object.defineProperty(exports, "ASTLiteral", { enumerable: true, get: function () { return literal_2.ASTLiteral; } });
Object.defineProperty(exports, "ASTNilLiteral", { enumerable: true, get: function () { return literal_2.ASTNilLiteral; } });
Object.defineProperty(exports, "ASTNumericLiteral", { enumerable: true, get: function () { return literal_2.ASTNumericLiteral; } });
Object.defineProperty(exports, "ASTStringLiteral", { enumerable: true, get: function () { return literal_2.ASTStringLiteral; } });
var logical_2 = require("./ast/logical");
Object.defineProperty(exports, "ASTLogicalExpression", { enumerable: true, get: function () { return logical_2.ASTLogicalExpression; } });
var map_2 = require("./ast/map");
Object.defineProperty(exports, "ASTMapConstructorExpression", { enumerable: true, get: function () { return map_2.ASTMapConstructorExpression; } });
Object.defineProperty(exports, "ASTMapKeyString", { enumerable: true, get: function () { return map_2.ASTMapKeyString; } });
var parenthesis_2 = require("./ast/parenthesis");
Object.defineProperty(exports, "ASTParenthesisExpression", { enumerable: true, get: function () { return parenthesis_2.ASTParenthesisExpression; } });
var return_2 = require("./ast/return");
Object.defineProperty(exports, "ASTReturnStatement", { enumerable: true, get: function () { return return_2.ASTReturnStatement; } });
var slice_2 = require("./ast/slice");
Object.defineProperty(exports, "ASTSliceExpression", { enumerable: true, get: function () { return slice_2.ASTSliceExpression; } });
var unary_2 = require("./ast/unary");
Object.defineProperty(exports, "ASTUnaryExpression", { enumerable: true, get: function () { return unary_2.ASTUnaryExpression; } });
var while_2 = require("./ast/while");
Object.defineProperty(exports, "ASTWhileStatement", { enumerable: true, get: function () { return while_2.ASTWhileStatement; } });
