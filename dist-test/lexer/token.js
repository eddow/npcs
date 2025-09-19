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
exports.LiteralToken = exports.Token = exports.BaseToken = exports.BaseTokenOptions = exports.TokenType = void 0;
var position_1 = require("../types/position");
var TokenType;
(function (TokenType) {
    TokenType["EOF"] = "EOF";
    TokenType["StringLiteral"] = "StringLiteral";
    TokenType["Keyword"] = "Keyword";
    TokenType["Identifier"] = "Identifier";
    TokenType["NumericLiteral"] = "NumericLiteral";
    TokenType["Punctuator"] = "Punctuator";
    TokenType["BooleanLiteral"] = "BooleanLiteral";
    TokenType["NilLiteral"] = "NilLiteral";
    TokenType["EOL"] = "EOL";
    TokenType["SliceOperator"] = "SliceOperator";
    TokenType["Comment"] = "Comment";
    TokenType["Invalid"] = "Invalid";
})(TokenType || (exports.TokenType = TokenType = {}));
var BaseTokenOptions = /** @class */ (function () {
    function BaseTokenOptions() {
    }
    return BaseTokenOptions;
}());
exports.BaseTokenOptions = BaseTokenOptions;
var BaseToken = /** @class */ (function () {
    function BaseToken(options) {
        this.type = options.type;
        this.value = options.value;
        this.line = options.line;
        this.lineStart = options.lineStart;
        this.range = options.range;
        this.lastLine = options.lastLine;
        this.lastLineStart = options.lastLineStart;
        this.afterSpace = options.afterSpace;
        var offsetRange = options.offsetRange;
        var range = options.range;
        this.start = new position_1.Position(this.line, range[0] - offsetRange[0] + 1);
        this.end = new position_1.Position(this.lastLine || this.line, range[1] - offsetRange[1] + 1);
    }
    BaseToken.prototype.toString = function () {
        var startLine = this.line;
        var endLine = this.lastLine !== undefined ? this.lastLine : this.line;
        var columLeft = this.start.character;
        var columRight = this.end.character;
        var location = "".concat(startLine, ":").concat(columLeft, " - ").concat(endLine, ":").concat(columRight);
        return "".concat(this.type, "[").concat(location, ": value = '").concat(this.value, "']");
    };
    return BaseToken;
}());
exports.BaseToken = BaseToken;
var Token = /** @class */ (function (_super) {
    __extends(Token, _super);
    function Token() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return Token;
}(BaseToken));
exports.Token = Token;
var LiteralToken = /** @class */ (function (_super) {
    __extends(LiteralToken, _super);
    function LiteralToken(options) {
        var _this = _super.call(this, options) || this;
        _this.raw = options.raw;
        return _this;
    }
    LiteralToken.prototype.toString = function () {
        var startLine = this.line;
        var endLine = this.lastLine !== undefined ? this.lastLine : this.line;
        var columLeft = this.start.character;
        var columRight = this.end.character;
        var location = "".concat(startLine, ":").concat(columLeft, " - ").concat(endLine, ":").concat(columRight);
        return "".concat(this.type, "[").concat(location, ": value = ").concat(this.raw, "]");
    };
    return LiteralToken;
}(BaseToken));
exports.LiteralToken = LiteralToken;
