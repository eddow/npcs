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
exports.ASTParenthesisExpression = void 0;
var base_1 = require("./base");
var ASTParenthesisExpression = /** @class */ (function (_super) {
    __extends(ASTParenthesisExpression, _super);
    function ASTParenthesisExpression(options) {
        var _this = _super.call(this, base_1.ASTType.ParenthesisExpression, options) || this;
        _this.expression = options.expression;
        return _this;
    }
    ASTParenthesisExpression.prototype.toString = function () {
        return this.expression.toString();
    };
    ASTParenthesisExpression.prototype.clone = function () {
        return new ASTParenthesisExpression({
            expression: this.expression.clone(),
            start: this.start,
            end: this.end,
            range: this.range,
            scope: this.scope,
        });
    };
    return ASTParenthesisExpression;
}(base_1.ASTBase));
exports.ASTParenthesisExpression = ASTParenthesisExpression;
