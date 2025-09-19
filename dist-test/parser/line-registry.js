"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LineRegistry = void 0;
var LineRegistry = /** @class */ (function () {
    function LineRegistry() {
        this._lines = {};
    }
    Object.defineProperty(LineRegistry.prototype, "lines", {
        get: function () {
            return this._lines;
        },
        enumerable: false,
        configurable: true
    });
    LineRegistry.prototype.addItemToLines = function (item) {
        this.addItemToRange(item.start.line, item.end.line, item);
    };
    LineRegistry.prototype.addItemToLine = function (line, item) {
        this.addItemToRange(line, line, item);
    };
    LineRegistry.prototype.addItemToRange = function (startLine, endLine, item) {
        var lines = this._lines;
        for (var line = startLine; line <= endLine; line++) {
            var statements = lines[line];
            statements ? statements.push(item) : (lines[line] = [item]);
        }
    };
    return LineRegistry;
}());
exports.LineRegistry = LineRegistry;
