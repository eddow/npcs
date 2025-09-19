"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Range = void 0;
var Range = /** @class */ (function () {
    function Range(start, end) {
        this.start = start;
        this.end = end;
    }
    Range.prototype.toString = function () {
        return "".concat(this.start, " - ").concat(this.end);
    };
    return Range;
}());
exports.Range = Range;
