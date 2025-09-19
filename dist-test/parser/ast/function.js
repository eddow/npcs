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
exports.ASTFunctionStatement = void 0;
var base_1 = require("./base");
var ASTFunctionStatement = /** @class */ (function (_super) {
    __extends(ASTFunctionStatement, _super);
    function ASTFunctionStatement(options) {
        var _this = _super.call(this, base_1.ASTType.FunctionDeclaration, options) || this;
        _this.parameters = options.parameters || [];
        _this.assignment = options.assignment;
        return _this;
    }
    ASTFunctionStatement.prototype.toString = function () {
        var args = this.parameters.map(function (item) { return item; }).join(', ');
        if (this.body.length === 0) {
            return "".concat(this.type, "[").concat(this.start, "-").concat(this.end, "][").concat(args, "]");
        }
        var body = this.body
            .map(function (item) { return "".concat(item); })
            .join('\n')
            .split('\n')
            .map(function (item) { return "\t".concat(item); })
            .join('\n');
        return "Function[".concat(this.start, "-").concat(this.end, "][").concat(args, " =>\n").concat(body, "\n]");
    };
    ASTFunctionStatement.prototype.clone = function () {
        return new ASTFunctionStatement({
            parameters: this.parameters.map(function (it) { return it.clone(); }),
            assignment: this.assignment.clone(),
            start: this.start,
            end: this.end,
            range: this.range,
            scope: this.scope,
        });
    };
    return ASTFunctionStatement;
}(base_1.ASTBaseBlockWithScope));
exports.ASTFunctionStatement = ASTFunctionStatement;
