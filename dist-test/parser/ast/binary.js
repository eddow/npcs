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
exports.ASTBinaryExpression = void 0;
var base_1 = require("./base");
var ASTBinaryExpression = /** @class */ (function (_super) {
    __extends(ASTBinaryExpression, _super);
    function ASTBinaryExpression(options) {
        var _this = _super.call(this, base_1.ASTType.BinaryExpression, options) || this;
        _this.operator = options.operator;
        _this.left = options.left;
        _this.right = options.right;
        return _this;
    }
    ASTBinaryExpression.prototype.toString = function () {
        return "".concat(this.type, "[").concat(this.start, "-").concat(this.end, "][").concat(this.left, " ").concat(this.operator, " ").concat(this.right, "]");
    };
    ASTBinaryExpression.prototype.clone = function () {
        return new ASTBinaryExpression({
            operator: this.operator,
            left: this.left.clone(),
            right: this.right.clone(),
            start: this.start,
            end: this.end,
            range: this.range,
            scope: this.scope,
        });
    };
    return ASTBinaryExpression;
}(base_1.ASTBase));
exports.ASTBinaryExpression = ASTBinaryExpression;
