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
exports.ParserException = exports.LexerException = void 0;
var LexerException = /** @class */ (function (_super) {
    __extends(LexerException, _super);
    function LexerException(message, range) {
        var _this = _super.call(this, message) || this;
        _this.range = range;
        return _this;
    }
    return LexerException;
}(Error));
exports.LexerException = LexerException;
var ParserException = /** @class */ (function (_super) {
    __extends(ParserException, _super);
    function ParserException(message, range) {
        var _this = _super.call(this, message) || this;
        _this.range = range;
        return _this;
    }
    return ParserException;
}(Error));
exports.ParserException = ParserException;
