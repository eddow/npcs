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
exports.ASTWhileStatement = void 0;
var base_1 = require("./base");
var ASTWhileStatement = /** @class */ (function (_super) {
    __extends(ASTWhileStatement, _super);
    function ASTWhileStatement(options) {
        var _this = _super.call(this, base_1.ASTType.WhileStatement, options) || this;
        _this.condition = options.condition;
        return _this;
    }
    ASTWhileStatement.prototype.toString = function () {
        if (this.body.length === 0) {
            return "WhileStatement[".concat(this.start, "-").concat(this.end, "][").concat(this.condition, "]");
        }
        var body = this.body
            .map(function (item) { return "".concat(item); })
            .join('\n')
            .split('\n')
            .map(function (item) { return "\t".concat(item); })
            .join('\n');
        return "WhileStatement[".concat(this.start, "-").concat(this.end, "][").concat(this.condition, "\n").concat(body, "\n]");
    };
    ASTWhileStatement.prototype.clone = function () {
        return new ASTWhileStatement({
            condition: this.condition.clone(),
            start: this.start,
            end: this.end,
            range: this.range,
            scope: this.scope,
        });
    };
    return ASTWhileStatement;
}(base_1.ASTBaseBlock));
exports.ASTWhileStatement = ASTWhileStatement;
