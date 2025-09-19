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
exports.ASTForGenericStatement = void 0;
var base_1 = require("./base");
var ASTForGenericStatement = /** @class */ (function (_super) {
    __extends(ASTForGenericStatement, _super);
    function ASTForGenericStatement(options) {
        var _this = _super.call(this, base_1.ASTType.ForGenericStatement, options) || this;
        _this.variable = options.variable;
        _this.iterator = options.iterator;
        return _this;
    }
    ASTForGenericStatement.prototype.toString = function () {
        if (this.body.length === 0) {
            return "".concat(this.type, "[").concat(this.start, "-").concat(this.end, "][").concat(this.variable, " in ").concat(this.iterator, "]");
        }
        var body = this.body
            .map(function (item) { return "".concat(item); })
            .join('\n')
            .split('\n')
            .map(function (item) { return "\t".concat(item); })
            .join('\n');
        return "For[".concat(this.start, "-").concat(this.end, "][").concat(this.variable, " in ").concat(this.iterator, "\n").concat(body, "\n]");
    };
    ASTForGenericStatement.prototype.clone = function () {
        return new ASTForGenericStatement({
            variable: this.variable.clone(),
            iterator: this.iterator.clone(),
            start: this.start,
            end: this.end,
            range: this.range,
            scope: this.scope,
        });
    };
    return ASTForGenericStatement;
}(base_1.ASTBaseBlock));
exports.ASTForGenericStatement = ASTForGenericStatement;
