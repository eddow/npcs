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
exports.ASTNilLiteral = exports.ASTStringLiteral = exports.ASTBooleanLiteral = exports.ASTNumericLiteral = exports.ASTLiteral = void 0;
var token_1 = require("../../lexer/token");
var base_1 = require("./base");
var ASTLiteral = /** @class */ (function (_super) {
    __extends(ASTLiteral, _super);
    function ASTLiteral() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return ASTLiteral;
}(base_1.ASTBase));
exports.ASTLiteral = ASTLiteral;
var ASTNumericLiteral = /** @class */ (function (_super) {
    __extends(ASTNumericLiteral, _super);
    function ASTNumericLiteral(options) {
        var _this = _super.call(this, token_1.TokenType.NumericLiteral, options) || this;
        _this.value = options.value;
        _this.raw = options.raw;
        _this.negated = false;
        return _this;
    }
    ASTNumericLiteral.prototype.toString = function () {
        return "Literal[".concat(this.start, "-").concat(this.end, "][").concat(this.negated ? '-' : '').concat(this.value, "]");
    };
    ASTNumericLiteral.prototype.clone = function () {
        var cloned = new ASTNumericLiteral({
            value: this.value,
            raw: this.raw,
            start: this.start,
            end: this.end,
            range: this.range,
            scope: this.scope,
        });
        cloned.negated = this.negated;
        return cloned;
    };
    return ASTNumericLiteral;
}(ASTLiteral));
exports.ASTNumericLiteral = ASTNumericLiteral;
var ASTBooleanLiteral = /** @class */ (function (_super) {
    __extends(ASTBooleanLiteral, _super);
    function ASTBooleanLiteral(options) {
        var _this = _super.call(this, token_1.TokenType.BooleanLiteral, options) || this;
        _this.value = options.value;
        _this.raw = options.raw;
        _this.negated = false;
        return _this;
    }
    ASTBooleanLiteral.prototype.toString = function () {
        return "Literal[".concat(this.start, "-").concat(this.end, "][").concat(this.negated ? '-' : '').concat(this.value, "]");
    };
    ASTBooleanLiteral.prototype.clone = function () {
        var cloned = new ASTBooleanLiteral({
            value: this.value,
            raw: this.raw,
            start: this.start,
            end: this.end,
            range: this.range,
            scope: this.scope,
        });
        cloned.negated = this.negated;
        return cloned;
    };
    return ASTBooleanLiteral;
}(ASTLiteral));
exports.ASTBooleanLiteral = ASTBooleanLiteral;
var ASTStringLiteral = /** @class */ (function (_super) {
    __extends(ASTStringLiteral, _super);
    function ASTStringLiteral(options) {
        var _this = _super.call(this, base_1.ASTType.StringLiteral, options) || this;
        _this.value = options.value;
        _this.raw = options.raw;
        return _this;
    }
    ASTStringLiteral.prototype.toString = function () {
        return "Literal[".concat(this.start, "-").concat(this.end, "][").concat(this.value, "]");
    };
    ASTStringLiteral.prototype.clone = function () {
        return new ASTStringLiteral({
            value: this.value,
            raw: this.raw,
            start: this.start,
            end: this.end,
            range: this.range,
            scope: this.scope,
        });
    };
    return ASTStringLiteral;
}(ASTLiteral));
exports.ASTStringLiteral = ASTStringLiteral;
var ASTNilLiteral = /** @class */ (function (_super) {
    __extends(ASTNilLiteral, _super);
    function ASTNilLiteral(options) {
        var _this = _super.call(this, base_1.ASTType.NilLiteral, options) || this;
        _this.value = options.value;
        _this.raw = options.raw;
        return _this;
    }
    ASTNilLiteral.prototype.toString = function () {
        return "Literal[".concat(this.start, "-").concat(this.end, "][").concat(this.value, "]");
    };
    ASTNilLiteral.prototype.clone = function () {
        return new ASTNilLiteral({
            value: this.value,
            raw: this.raw,
            start: this.start,
            end: this.end,
            range: this.range,
            scope: this.scope,
        });
    };
    return ASTNilLiteral;
}(ASTLiteral));
exports.ASTNilLiteral = ASTNilLiteral;
