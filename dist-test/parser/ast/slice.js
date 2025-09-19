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
exports.ASTSliceExpression = void 0;
var base_1 = require("./base");
var ASTSliceExpression = /** @class */ (function (_super) {
    __extends(ASTSliceExpression, _super);
    function ASTSliceExpression(options) {
        var _this = _super.call(this, base_1.ASTType.SliceExpression, options) || this;
        _this.left = options.left;
        _this.right = options.right;
        _this.base = options.base;
        return _this;
    }
    ASTSliceExpression.prototype.toString = function () {
        return "SliceExpression[".concat(this.start, "-").concat(this.end, "][").concat(this.base, "[").concat(this.left, ":").concat(this.right, "]]");
    };
    ASTSliceExpression.prototype.clone = function () {
        return new ASTSliceExpression({
            base: this.base.clone(),
            left: this.left.clone(),
            right: this.right.clone(),
            start: this.start,
            end: this.end,
            range: this.range,
            scope: this.scope,
        });
    };
    return ASTSliceExpression;
}(base_1.ASTBase));
exports.ASTSliceExpression = ASTSliceExpression;
