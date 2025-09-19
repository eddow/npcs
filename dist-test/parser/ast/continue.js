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
exports.ASTContinueStatement = void 0;
var base_1 = require("./base");
var ASTContinueStatement = /** @class */ (function (_super) {
    __extends(ASTContinueStatement, _super);
    function ASTContinueStatement(options) {
        var _this = _super.call(this, base_1.ASTType.ContinueStatement, options) || this;
        _this.iterator = options.iterator;
        return _this;
    }
    ASTContinueStatement.prototype.toString = function () {
        return "ContinueStatement[".concat(this.start, "-").concat(this.end, "]");
    };
    ASTContinueStatement.prototype.clone = function () {
        var _a;
        return new ASTContinueStatement({
            iterator: (_a = this.iterator) === null || _a === void 0 ? void 0 : _a.clone(),
            start: this.start,
            end: this.end,
            range: this.range,
            scope: this.scope,
        });
    };
    return ASTContinueStatement;
}(base_1.ASTBase));
exports.ASTContinueStatement = ASTContinueStatement;
