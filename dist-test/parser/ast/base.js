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
exports.ASTComment = exports.ASTBaseBlockWithScope = exports.ASTBaseBlock = exports.ASTBase = exports.ASTType = void 0;
var ASTType;
(function (ASTType) {
    ASTType["BreakStatement"] = "BreakStatement";
    ASTType["ContinueStatement"] = "ContinueStatement";
    ASTType["ReturnStatement"] = "ReturnStatement";
    ASTType["IfShortcutStatement"] = "IfShortcutStatement";
    ASTType["IfShortcutClause"] = "IfShortcutClause";
    ASTType["ElseifShortcutClause"] = "ElseifShortcutClause";
    ASTType["ElseShortcutClause"] = "ElseShortcutClause";
    ASTType["IfStatement"] = "IfStatement";
    ASTType["IfClause"] = "IfClause";
    ASTType["ElseifClause"] = "ElseifClause";
    ASTType["ElseClause"] = "ElseClause";
    ASTType["WhileStatement"] = "WhileStatement";
    ASTType["AssignmentStatement"] = "AssignmentStatement";
    ASTType["CallStatement"] = "CallStatement";
    ASTType["FunctionDeclaration"] = "FunctionDeclaration";
    ASTType["ForGenericStatement"] = "ForGenericStatement";
    ASTType["Chunk"] = "Chunk";
    ASTType["Identifier"] = "Identifier";
    ASTType["StringLiteral"] = "StringLiteral";
    ASTType["NumericLiteral"] = "NumericLiteral";
    ASTType["BooleanLiteral"] = "BooleanLiteral";
    ASTType["NilLiteral"] = "NilLiteral";
    ASTType["Unknown"] = "Unknown";
    ASTType["MemberExpression"] = "MemberExpression";
    ASTType["CallExpression"] = "CallExpression";
    ASTType["Comment"] = "Comment";
    ASTType["NegationExpression"] = "NegationExpression";
    ASTType["BinaryNegatedExpression"] = "BinaryNegatedExpression";
    ASTType["UnaryExpression"] = "UnaryExpression";
    ASTType["MapKeyString"] = "MapKeyString";
    ASTType["MapValue"] = "MapValue";
    ASTType["MapConstructorExpression"] = "MapConstructorExpression";
    ASTType["MapCallExpression"] = "MapCallExpression";
    ASTType["ListValue"] = "ListValue";
    ASTType["ListConstructorExpression"] = "ListConstructorExpression";
    ASTType["EmptyExpression"] = "EmptyExpression";
    ASTType["IndexExpression"] = "IndexExpression";
    ASTType["BinaryExpression"] = "BinaryExpression";
    ASTType["LogicalExpression"] = "LogicalExpression";
    ASTType["IsaExpression"] = "IsaExpression";
    ASTType["SliceExpression"] = "SliceExpression";
    ASTType["ImportCodeExpression"] = "ImportCodeExpression";
    ASTType["InvalidCodeExpression"] = "InvalidCodeExpression";
    ASTType["ParenthesisExpression"] = "ParenthesisExpression";
    ASTType["ComparisonGroupExpression"] = "ComparisonGroupExpression";
})(ASTType || (exports.ASTType = ASTType = {}));
var ASTBase = /** @class */ (function () {
    function ASTBase(type, options) {
        this.type = type;
        this.start = options.start;
        this.end = options.end;
        this.range = options.range;
        this.scope = options.scope || null;
    }
    ASTBase.prototype.toString = function () {
        return "".concat(this.type, "[").concat(this.start, "-").concat(this.end, "][]");
    };
    ASTBase.prototype.clone = function () {
        return new ASTBase(this.type, {
            start: this.start,
            end: this.end,
            range: this.range,
            scope: this.scope,
        });
    };
    return ASTBase;
}());
exports.ASTBase = ASTBase;
var ASTBaseBlock = /** @class */ (function (_super) {
    __extends(ASTBaseBlock, _super);
    function ASTBaseBlock(type, options) {
        var _this = _super.call(this, type, options) || this;
        _this.body = options.body || [];
        return _this;
    }
    ASTBaseBlock.prototype.toString = function () {
        var body = this.body
            .map(function (item) { return "".concat(item); })
            .join('\n')
            .split('\n')
            .map(function (item) { return "\t".concat(item); })
            .join('\n');
        return "".concat(this.type, "[").concat(this.start, "-").concat(this.end, "][").concat(body.length > 0 ? "\n".concat(body, "\n") : '', "]");
    };
    ASTBaseBlock.prototype.clone = function () {
        return new ASTBaseBlock(this.type, {
            body: this.body.map(function (it) { return it.clone(); }),
            start: this.start,
            end: this.end,
            range: this.range,
            scope: this.scope,
        });
    };
    return ASTBaseBlock;
}(ASTBase));
exports.ASTBaseBlock = ASTBaseBlock;
var ASTBaseBlockWithScope = /** @class */ (function (_super) {
    __extends(ASTBaseBlockWithScope, _super);
    function ASTBaseBlockWithScope(type, options) {
        var _this = _super.call(this, type, options) || this;
        _this.namespaces = options.namespaces || [];
        _this.definitions = options.definitions || [];
        _this.returns = options.returns || [];
        return _this;
    }
    ASTBaseBlockWithScope.prototype.clone = function () {
        return new ASTBaseBlockWithScope(this.type, {
            namespaces: this.namespaces,
            definitions: this.definitions.map(function (it) { return it.clone(); }),
            returns: this.returns.map(function (it) { return it.clone(); }),
            body: this.body.map(function (it) { return it.clone(); }),
            start: this.start,
            end: this.end,
            range: this.range,
            scope: this.scope,
        });
    };
    return ASTBaseBlockWithScope;
}(ASTBaseBlock));
exports.ASTBaseBlockWithScope = ASTBaseBlockWithScope;
var ASTComment = /** @class */ (function (_super) {
    __extends(ASTComment, _super);
    function ASTComment(options) {
        var _this = _super.call(this, ASTType.Comment, options) || this;
        _this.value = options.value;
        _this.isStatement = options.isStatement;
        _this.isMultiline = options.isMultiline || false;
        return _this;
    }
    ASTComment.prototype.toString = function () {
        return "Comment[".concat(this.start, "-").concat(this.end, "][").concat(this.value, "]");
    };
    ASTComment.prototype.clone = function () {
        return new ASTComment({
            value: this.value,
            isMultiline: this.isMultiline,
            isStatement: this.isStatement,
            start: this.start,
            end: this.end,
            range: this.range,
            scope: this.scope,
        });
    };
    return ASTComment;
}(ASTBase));
exports.ASTComment = ASTComment;
