"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var codes_1 = require("../types/codes");
var keywords_1 = require("../types/keywords");
var Validator = /** @class */ (function () {
    function Validator() {
        this.isKeyword = Set.prototype.has.bind(new Set(Object.values(keywords_1.Keyword)));
    }
    Validator.prototype.isWhitespace = function (code) {
        return codes_1.CharacterCode.WHITESPACE === code || codes_1.CharacterCode.TAB === code;
    };
    Validator.prototype.isEndOfLine = function (code) {
        return codes_1.CharacterCode.NEW_LINE === code || codes_1.CharacterCode.RETURN_LINE === code;
    };
    Validator.prototype.isComment = function (code, nextCode) {
        return codes_1.CharacterCode.SLASH === code && codes_1.CharacterCode.SLASH === nextCode;
    };
    Validator.prototype.isIdentifierStart = function (code) {
        return (((code | 32) >= 97 && (code | 32) <= 122) || // a-z or A-Z
            code >= 128 || // extended ASCII
            code === 95 // _
        );
    };
    Validator.prototype.isIdentifierPart = function (code) {
        return (((code | 32) >= 97 && (code | 32) <= 122) || // a-z or A-Z
            (code >= 48 && code <= 57) || // 0-9
            code >= 128 || // extended ASCII
            code === 95 // _
        );
    };
    Validator.prototype.isDecDigit = function (code) {
        return code >= codes_1.CharacterCode.NUMBER_0 && code <= codes_1.CharacterCode.NUMBER_9;
    };
    Validator.prototype.isWinNewline = function (code, nextCode) {
        switch (code) {
            case codes_1.CharacterCode.RETURN_LINE:
                return codes_1.CharacterCode.NEW_LINE === nextCode;
            case codes_1.CharacterCode.NEW_LINE:
                return codes_1.CharacterCode.RETURN_LINE === nextCode;
        }
        return false;
    };
    return Validator;
}());
exports.default = Validator;
