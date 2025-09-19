"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var token_1 = require("../lexer/token");
var Validator = /** @class */ (function () {
    function Validator() {
        this.isNonNilLiteral = Set.prototype.has.bind(new Set([token_1.TokenType.StringLiteral, token_1.TokenType.NumericLiteral, token_1.TokenType.BooleanLiteral]));
        this.isLiteral = Set.prototype.has.bind(new Set([
            token_1.TokenType.StringLiteral,
            token_1.TokenType.NumericLiteral,
            token_1.TokenType.BooleanLiteral,
            token_1.TokenType.NilLiteral,
        ]));
    }
    Validator.prototype.isComment = function (type) {
        return type === token_1.TokenType.Comment;
    };
    return Validator;
}());
exports.default = Validator;
