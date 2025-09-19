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
exports.PendingWhile = exports.PendingIf = exports.PendingFunction = exports.PendingFor = exports.PendingChunk = exports.PendingBlockType = void 0;
exports.isPendingChunk = isPendingChunk;
exports.isPendingFor = isPendingFor;
exports.isPendingFunction = isPendingFunction;
exports.isPendingIf = isPendingIf;
exports.isPendingWhile = isPendingWhile;
var PendingBlockType;
(function (PendingBlockType) {
    PendingBlockType[PendingBlockType["Chunk"] = 0] = "Chunk";
    PendingBlockType[PendingBlockType["For"] = 1] = "For";
    PendingBlockType[PendingBlockType["Function"] = 2] = "Function";
    PendingBlockType[PendingBlockType["If"] = 3] = "If";
    PendingBlockType[PendingBlockType["While"] = 4] = "While";
})(PendingBlockType || (exports.PendingBlockType = PendingBlockType = {}));
var PendingBlockBase = /** @class */ (function () {
    function PendingBlockBase(block, type, lineRegistry) {
        this.lineRegistry = lineRegistry;
        this.block = block;
        this.body = [];
        this.type = type;
        this.onComplete = null;
    }
    PendingBlockBase.prototype.complete = function (_endToken) {
        var _a;
        (_a = this.onComplete) === null || _a === void 0 ? void 0 : _a.call(this, this);
    };
    return PendingBlockBase;
}());
function isPendingChunk(pendingBlock) {
    return pendingBlock.type === PendingBlockType.Chunk;
}
var PendingChunk = /** @class */ (function (_super) {
    __extends(PendingChunk, _super);
    function PendingChunk(block, lineRegistry) {
        return _super.call(this, block, PendingBlockType.Chunk, lineRegistry) || this;
    }
    PendingChunk.prototype.complete = function (endToken) {
        this.block.body = this.body;
        this.block.end = endToken.end;
        this.block.range = [this.block.range[0], endToken.range[1]];
        _super.prototype.complete.call(this, endToken);
    };
    return PendingChunk;
}(PendingBlockBase));
exports.PendingChunk = PendingChunk;
function isPendingFor(pendingBlock) {
    return pendingBlock.type === PendingBlockType.For;
}
var PendingFor = /** @class */ (function (_super) {
    __extends(PendingFor, _super);
    function PendingFor(block, lineRegistry) {
        var _this = _super.call(this, block, PendingBlockType.For, lineRegistry) || this;
        _this.lineRegistry.addItemToLine(_this.block.start.line, _this.block);
        return _this;
    }
    PendingFor.prototype.complete = function (endToken) {
        this.block.body = this.body;
        this.block.end = endToken.end;
        this.block.range = [this.block.range[0], endToken.range[1]];
        this.lineRegistry.addItemToLine(endToken.end.line, this.block);
        _super.prototype.complete.call(this, endToken);
    };
    return PendingFor;
}(PendingBlockBase));
exports.PendingFor = PendingFor;
function isPendingFunction(pendingBlock) {
    return pendingBlock.type === PendingBlockType.Function;
}
var PendingFunction = /** @class */ (function (_super) {
    __extends(PendingFunction, _super);
    function PendingFunction(block, base, lineRegistry) {
        var _this = _super.call(this, block, PendingBlockType.Function, lineRegistry) || this;
        _this.namedFunctionAssignment = null;
        _this.base = base;
        _this.lineRegistry.addItemToLine(_this.block.start.line, _this.block);
        return _this;
    }
    PendingFunction.prototype.complete = function (endToken) {
        this.block.body = this.body;
        this.block.end = endToken.end;
        this.block.range = [this.block.range[0], endToken.range[1]];
        // If this is a named function, finalize the assignment statement
        if (this.namedFunctionAssignment) {
            this.namedFunctionAssignment.end = endToken.end;
            this.namedFunctionAssignment.range[1] = endToken.range[1];
            this.lineRegistry.addItemToLine(this.namedFunctionAssignment.end.line, this.namedFunctionAssignment);
        }
        else if (this.base !== null) {
            this.base.end = this.block.end;
            this.base.range[1] = this.block.range[1];
            this.lineRegistry.addItemToLine(this.base.end.line, this.base);
        }
        else {
            this.lineRegistry.addItemToLine(this.block.end.line, this.block);
        }
        _super.prototype.complete.call(this, endToken);
    };
    return PendingFunction;
}(PendingBlockBase));
exports.PendingFunction = PendingFunction;
function isPendingIf(pendingBlock) {
    return pendingBlock.type === PendingBlockType.If;
}
var PendingIf = /** @class */ (function (_super) {
    __extends(PendingIf, _super);
    function PendingIf(block, current, lineRegistry) {
        var _this = _super.call(this, block, PendingBlockType.If, lineRegistry) || this;
        _this.lineRegistry.addItemToLine(_this.block.start.line, _this.block);
        _this.currentClause = current;
        return _this;
    }
    PendingIf.prototype.addCurrentClauseToLineRegistry = function () {
        if (this.currentClause.start.line === this.block.start.line) {
            return;
        }
        this.lineRegistry.addItemToLine(this.currentClause.start.line, this.block);
    };
    PendingIf.prototype.next = function (endToken) {
        this.currentClause.body = this.body;
        this.currentClause.end = endToken.end;
        this.currentClause.range = [this.currentClause.range[0], endToken.range[1]];
        this.addCurrentClauseToLineRegistry();
        this.block.clauses.push(this.currentClause);
        _super.prototype.complete.call(this, endToken);
        this.body = [];
    };
    PendingIf.prototype.complete = function (endToken) {
        if (this.body.length > 0)
            this.next(endToken);
        this.block.end = endToken.end;
        this.block.range = [this.block.range[0], endToken.range[1]];
        this.lineRegistry.addItemToLine(this.block.end.line, this.block);
        _super.prototype.complete.call(this, endToken);
    };
    return PendingIf;
}(PendingBlockBase));
exports.PendingIf = PendingIf;
function isPendingWhile(pendingBlock) {
    return pendingBlock.type === PendingBlockType.While;
}
var PendingWhile = /** @class */ (function (_super) {
    __extends(PendingWhile, _super);
    function PendingWhile(block, lineRegistry) {
        var _this = _super.call(this, block, PendingBlockType.While, lineRegistry) || this;
        _this.lineRegistry.addItemToLine(_this.block.start.line, _this.block);
        return _this;
    }
    PendingWhile.prototype.complete = function (endToken) {
        this.block.body = this.body;
        this.block.end = endToken.end;
        this.block.range = [this.block.range[0], endToken.range[1]];
        this.lineRegistry.addItemToLine(endToken.end.line, this.block);
        _super.prototype.complete.call(this, endToken);
    };
    return PendingWhile;
}(PendingBlockBase));
exports.PendingWhile = PendingWhile;
