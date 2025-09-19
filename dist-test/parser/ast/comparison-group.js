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
exports.ASTComparisonGroupExpression = void 0;
var base_1 = require("./base");
var ASTComparisonGroupExpression = /** @class */ (function (_super) {
    __extends(ASTComparisonGroupExpression, _super);
    function ASTComparisonGroupExpression(options) {
        var _this = _super.call(this, base_1.ASTType.ComparisonGroupExpression, options) || this;
        _this.operators = options.operators;
        _this.expressions = options.expressions;
        return _this;
    }
    ASTComparisonGroupExpression.prototype.toString = function () {
        var group = [this.expressions[0].toString()];
        for (var index = 1; index < this.expressions.length; index++) {
            group.push(this.operators[index - 1], this.expressions[index].toString());
        }
        return "".concat(this.type, "[").concat(this.start, "-").concat(this.end, "][").concat(group.join(' '), "]");
    };
    ASTComparisonGroupExpression.prototype.clone = function () {
        return new ASTComparisonGroupExpression({
            operators: this.operators,
            expressions: this.expressions,
            start: this.start,
            end: this.end,
            range: this.range,
            scope: this.scope,
        });
    };
    return ASTComparisonGroupExpression;
}(base_1.ASTBase));
exports.ASTComparisonGroupExpression = ASTComparisonGroupExpression;
