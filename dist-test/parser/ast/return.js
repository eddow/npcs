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
exports.ASTReturnStatement = void 0;
var base_1 = require("./base");
var ASTReturnStatement = /** @class */ (function (_super) {
    __extends(ASTReturnStatement, _super);
    function ASTReturnStatement(options) {
        var _this = _super.call(this, base_1.ASTType.ReturnStatement, options) || this;
        _this.argument = options.argument;
        return _this;
    }
    ASTReturnStatement.prototype.toString = function () {
        return "ReturnStatement[".concat(this.start, "-").concat(this.end, "][").concat(this.argument, "]");
    };
    ASTReturnStatement.prototype.clone = function () {
        return new ASTReturnStatement({
            argument: this.argument.clone(),
            start: this.start,
            end: this.end,
            range: this.range,
            scope: this.scope,
        });
    };
    return ASTReturnStatement;
}(base_1.ASTBase));
exports.ASTReturnStatement = ASTReturnStatement;
