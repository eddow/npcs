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
exports.ASTListConstructorExpression = exports.ASTListValue = void 0;
var base_1 = require("./base");
var ASTListValue = /** @class */ (function (_super) {
    __extends(ASTListValue, _super);
    function ASTListValue(options) {
        var _this = _super.call(this, base_1.ASTType.ListValue, options) || this;
        _this.value = options.value;
        return _this;
    }
    ASTListValue.prototype.toString = function () {
        return "ListValue[".concat(this.start, "-").concat(this.end, "][").concat(this.value, "]");
    };
    ASTListValue.prototype.clone = function () {
        return new ASTListValue({
            value: this.value.clone(),
            start: this.start,
            end: this.end,
            range: this.range,
            scope: this.scope,
        });
    };
    return ASTListValue;
}(base_1.ASTBase));
exports.ASTListValue = ASTListValue;
var ASTListConstructorExpression = /** @class */ (function (_super) {
    __extends(ASTListConstructorExpression, _super);
    function ASTListConstructorExpression(options) {
        var _this = _super.call(this, base_1.ASTType.ListConstructorExpression, options) || this;
        _this.fields = options.fields || [];
        return _this;
    }
    ASTListConstructorExpression.prototype.toString = function () {
        if (this.fields.length === 0) {
            return "ListConstructor[".concat(this.start, "-").concat(this.end, "][]");
        }
        var body = this.fields
            .map(function (item) { return "".concat(item); })
            .join('\n')
            .split('\n')
            .map(function (item) { return "\t".concat(item); })
            .join('\n');
        return "ListConstructor[".concat(this.start, "-").concat(this.end, "][\n").concat(body, "\n]");
    };
    ASTListConstructorExpression.prototype.clone = function () {
        return new ASTListConstructorExpression({
            fields: this.fields.map(function (it) { return it.clone(); }),
            start: this.start,
            end: this.end,
            range: this.range,
            scope: this.scope,
        });
    };
    return ASTListConstructorExpression;
}(base_1.ASTBase));
exports.ASTListConstructorExpression = ASTListConstructorExpression;
