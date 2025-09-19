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
exports.ASTUnaryExpression = void 0;
var operators_1 = require("../../types/operators");
var base_1 = require("./base");
var ASTUnaryExpression = /** @class */ (function (_super) {
    __extends(ASTUnaryExpression, _super);
    function ASTUnaryExpression(options) {
        var _this = _super.call(this, ASTUnaryExpression.getUnaryType(options.operator), options) || this;
        _this.argument = options.argument;
        _this.operator = options.operator;
        return _this;
    }
    ASTUnaryExpression.getUnaryType = function (operator) {
        switch (operator) {
            case operators_1.Operator.Not: {
                return base_1.ASTType.NegationExpression;
            }
            case operators_1.Operator.Plus:
            case operators_1.Operator.Minus: {
                return base_1.ASTType.BinaryNegatedExpression;
            }
            default: {
                return base_1.ASTType.UnaryExpression;
            }
        }
    };
    ASTUnaryExpression.prototype.toString = function () {
        return "".concat(this.type, "[").concat(this.start, "-").concat(this.end, "][").concat(this.operator, " ").concat(this.argument, "]");
    };
    ASTUnaryExpression.prototype.clone = function () {
        return new ASTUnaryExpression({
            argument: this.argument.clone(),
            operator: this.operator,
            start: this.start,
            end: this.end,
            range: this.range,
            scope: this.scope,
        });
    };
    return ASTUnaryExpression;
}(base_1.ASTBase));
exports.ASTUnaryExpression = ASTUnaryExpression;
