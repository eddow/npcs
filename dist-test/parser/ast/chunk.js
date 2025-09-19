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
exports.ASTChunk = void 0;
var base_1 = require("./base");
var ASTChunk = /** @class */ (function (_super) {
    __extends(ASTChunk, _super);
    function ASTChunk(options) {
        var _this = _super.call(this, base_1.ASTType.Chunk, options) || this;
        _this.literals = options.literals || [];
        _this.comments = options.comments || [];
        _this.scopes = options.scopes || [];
        _this.lines = options.lines || {};
        return _this;
    }
    ASTChunk.prototype.toString = function () {
        if (this.body.length === 0) {
            return "Chunk[".concat(this.start, "-").concat(this.end, "][]");
        }
        var body = this.body
            .map(function (item) { return "".concat(item); })
            .join('\n')
            .split('\n')
            .map(function (item) { return "\t".concat(item); })
            .join('\n');
        return "Chunk[".concat(this.start, "-").concat(this.end, "][\n").concat(body, "\n]");
    };
    ASTChunk.prototype.clone = function () {
        return new ASTChunk({
            literals: this.literals.map(function (it) { return it.clone(); }),
            comments: this.comments.map(function (it) { return it.clone(); }),
            scopes: this.scopes.map(function (it) { return it.clone(); }),
            lines: this.lines,
            start: this.start,
            end: this.end,
            range: this.range,
            scope: this.scope,
        });
    };
    return ASTChunk;
}(base_1.ASTBaseBlockWithScope));
exports.ASTChunk = ASTChunk;
