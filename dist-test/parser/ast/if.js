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
exports.ASTElseClause = exports.ASTIfClause = exports.ASTIfStatement = exports.ASTClause = void 0;
var base_1 = require("./base");
var ASTClause = /** @class */ (function (_super) {
    __extends(ASTClause, _super);
    function ASTClause() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return ASTClause;
}(base_1.ASTBaseBlock));
exports.ASTClause = ASTClause;
var ASTIfStatement = /** @class */ (function (_super) {
    __extends(ASTIfStatement, _super);
    function ASTIfStatement(type, options) {
        var _this = _super.call(this, type, options) || this;
        _this.clauses = options.clauses || [];
        return _this;
    }
    ASTIfStatement.prototype.toString = function () {
        if (this.clauses.length === 0) {
            return "IfStatement[".concat(this.start, "-").concat(this.end, "][]");
        }
        var clauses = this.clauses
            .map(function (item) { return "".concat(item); })
            .join('\n')
            .split('\n')
            .map(function (item) { return "\t".concat(item); })
            .join('\n');
        return "IfStatement[".concat(this.start, "-").concat(this.end, "][\n").concat(clauses, "\n]");
    };
    ASTIfStatement.prototype.clone = function () {
        return new ASTIfStatement(this.type, {
            clauses: this.clauses.map(function (it) { return it.clone(); }),
            start: this.start,
            end: this.end,
            range: this.range,
            scope: this.scope,
        });
    };
    return ASTIfStatement;
}(base_1.ASTBase));
exports.ASTIfStatement = ASTIfStatement;
var ASTIfClause = /** @class */ (function (_super) {
    __extends(ASTIfClause, _super);
    function ASTIfClause(type, options) {
        var _this = _super.call(this, type, options) || this;
        _this.condition = options.condition;
        return _this;
    }
    ASTIfClause.prototype.toString = function () {
        if (this.body.length === 0) {
            return "".concat(this.type, "[").concat(this.start, "-").concat(this.end, "][").concat(this.condition, "]");
        }
        var body = this.body
            .map(function (item) { return "".concat(item); })
            .join('\n')
            .split('\n')
            .map(function (item) { return "\t".concat(item); })
            .join('\n');
        return "".concat(this.type, "[").concat(this.start, "-").concat(this.end, "][").concat(this.condition, "\n").concat(body, "\n]");
    };
    ASTIfClause.prototype.clone = function () {
        return new ASTIfClause(this.type, {
            condition: this.condition.clone(),
            start: this.start,
            end: this.end,
            range: this.range,
            scope: this.scope,
        });
    };
    return ASTIfClause;
}(ASTClause));
exports.ASTIfClause = ASTIfClause;
var ASTElseClause = /** @class */ (function (_super) {
    __extends(ASTElseClause, _super);
    function ASTElseClause(type, options) {
        return _super.call(this, type, options) || this;
    }
    ASTElseClause.prototype.toString = function () {
        if (this.body.length === 0) {
            return "".concat(this.type, "[]");
        }
        var body = this.body
            .map(function (item) { return "".concat(item); })
            .join('\n')
            .split('\n')
            .map(function (item) { return "\t".concat(item); })
            .join('\n');
        return "".concat(this.type, "[").concat(this.start, "-").concat(this.end, "][\n").concat(body, "\n}]");
    };
    ASTElseClause.prototype.clone = function () {
        return new ASTElseClause(this.type, {
            start: this.start,
            end: this.end,
            range: this.range,
            scope: this.scope,
        });
    };
    return ASTElseClause;
}(ASTClause));
exports.ASTElseClause = ASTElseClause;
