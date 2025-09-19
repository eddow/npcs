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
exports.ASTAssignmentStatement = void 0;
var base_1 = require("./base");
var ASTAssignmentStatement = /** @class */ (function (_super) {
    __extends(ASTAssignmentStatement, _super);
    function ASTAssignmentStatement(options) {
        var _this = _super.call(this, base_1.ASTType.AssignmentStatement, options) || this;
        _this.variable = options.variable;
        _this.init = options.init;
        return _this;
    }
    ASTAssignmentStatement.prototype.toString = function () {
        return "AssignmentStatement[".concat(this.start, "-").concat(this.end, "][").concat(this.variable, " = ").concat(this.init, "]");
    };
    ASTAssignmentStatement.prototype.clone = function () {
        return new ASTAssignmentStatement({
            variable: this.variable.clone(),
            init: this.init.clone(),
            start: this.start,
            end: this.end,
            range: this.range,
            scope: this.scope,
        });
    };
    return ASTAssignmentStatement;
}(base_1.ASTBase));
exports.ASTAssignmentStatement = ASTAssignmentStatement;
