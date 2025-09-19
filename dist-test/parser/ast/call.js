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
exports.ASTCallExpression = exports.ASTCallStatement = void 0;
var base_1 = require("./base");
var ASTCallStatement = /** @class */ (function (_super) {
    __extends(ASTCallStatement, _super);
    function ASTCallStatement(options) {
        var _this = _super.call(this, base_1.ASTType.CallStatement, options) || this;
        _this.expression = options.expression;
        return _this;
    }
    ASTCallStatement.prototype.toString = function () {
        return "CallStatement[".concat(this.start, "-").concat(this.end, "][").concat(this.expression, "]");
    };
    ASTCallStatement.prototype.clone = function () {
        return new ASTCallStatement({
            expression: this.expression,
            start: this.start,
            end: this.end,
            range: this.range,
            scope: this.scope,
        });
    };
    return ASTCallStatement;
}(base_1.ASTBase));
exports.ASTCallStatement = ASTCallStatement;
var ASTCallExpression = /** @class */ (function (_super) {
    __extends(ASTCallExpression, _super);
    function ASTCallExpression(options) {
        var _this = _super.call(this, base_1.ASTType.CallExpression, options) || this;
        _this.base = options.base;
        _this.arguments = options.arguments || [];
        return _this;
    }
    ASTCallExpression.prototype.toString = function () {
        return "CallExpression[".concat(this.start, "-").concat(this.end, "][").concat(this.base, "(").concat(this.arguments.map(function (item) { return item.toString(); }).join(', '), ")]");
    };
    ASTCallExpression.prototype.clone = function () {
        return new ASTCallExpression({
            base: this.base.clone(),
            arguments: this.arguments.map(function (it) { return it.clone(); }),
            start: this.start,
            end: this.end,
            range: this.range,
            scope: this.scope,
        });
    };
    return ASTCallExpression;
}(base_1.ASTBase));
exports.ASTCallExpression = ASTCallExpression;
