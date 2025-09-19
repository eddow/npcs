"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Position = void 0;
var Position = /** @class */ (function () {
    function Position(line, character) {
        this.line = line;
        this.character = character;
    }
    Position.prototype.toString = function () {
        return "".concat(this.line, ":").concat(this.character);
    };
    return Position;
}());
exports.Position = Position;
