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
exports.ASTIndexExpression = exports.ASTMemberExpression = exports.ASTIdentifier = exports.ASTIdentifierKind = void 0;
var base_1 = require("./base");
var ASTIdentifierKind;
(function (ASTIdentifierKind) {
    ASTIdentifierKind["Variable"] = "variable";
    ASTIdentifierKind["Argument"] = "argument";
    ASTIdentifierKind["ForInVariable"] = "for-in-variable";
    ASTIdentifierKind["Property"] = "property";
})(ASTIdentifierKind || (exports.ASTIdentifierKind = ASTIdentifierKind = {}));
var ASTIdentifier = /** @class */ (function (_super) {
    __extends(ASTIdentifier, _super);
    function ASTIdentifier(options) {
        var _this = _super.call(this, base_1.ASTType.Identifier, options) || this;
        _this.name = options.name;
        _this.kind = options.kind;
        return _this;
    }
    ASTIdentifier.prototype.toString = function () {
        return "Identifier[".concat(this.start, "-").concat(this.end, "][").concat(this.name, "]");
    };
    ASTIdentifier.prototype.clone = function () {
        return new ASTIdentifier({
            name: this.name,
            kind: this.kind,
            start: this.start,
            end: this.end,
            range: this.range,
            scope: this.scope,
        });
    };
    return ASTIdentifier;
}(base_1.ASTBase));
exports.ASTIdentifier = ASTIdentifier;
var ASTMemberExpression = /** @class */ (function (_super) {
    __extends(ASTMemberExpression, _super);
    function ASTMemberExpression(options) {
        var _this = _super.call(this, base_1.ASTType.MemberExpression, options) || this;
        _this.indexer = options.indexer;
        _this.identifier = options.identifier;
        _this.base = options.base;
        return _this;
    }
    ASTMemberExpression.prototype.toString = function () {
        return "MemberExpression[".concat(this.start, "-").concat(this.end, "][").concat(this.base, ".").concat(this.identifier, "]");
    };
    ASTMemberExpression.prototype.clone = function () {
        return new ASTMemberExpression({
            indexer: this.indexer,
            identifier: this.identifier.clone(),
            base: this.base,
            start: this.start,
            end: this.end,
            range: this.range,
            scope: this.scope,
        });
    };
    return ASTMemberExpression;
}(base_1.ASTBase));
exports.ASTMemberExpression = ASTMemberExpression;
var ASTIndexExpression = /** @class */ (function (_super) {
    __extends(ASTIndexExpression, _super);
    function ASTIndexExpression(options) {
        var _this = _super.call(this, base_1.ASTType.IndexExpression, options) || this;
        _this.base = options.base;
        _this.index = options.index;
        _this.isStatementStart = options.isStatementStart;
        return _this;
    }
    ASTIndexExpression.prototype.toString = function () {
        return "IndexExpression[".concat(this.start, "-").concat(this.end, "]").concat(this.isStatementStart ? '[isStatementStart]' : '', "[").concat(this.base, "[").concat(this.index, "]]");
    };
    ASTIndexExpression.prototype.clone = function () {
        return new ASTIndexExpression({
            base: this.base.clone(),
            index: this.index.clone(),
            isStatementStart: this.isStatementStart,
            start: this.start,
            end: this.end,
            range: this.range,
            scope: this.scope,
        });
    };
    return ASTIndexExpression;
}(base_1.ASTBase));
exports.ASTIndexExpression = ASTIndexExpression;
