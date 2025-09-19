"use strict";
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var Queue = /** @class */ (function () {
    function Queue() {
        this._head = null;
        this._tail = null;
        this._size = 0;
    }
    Queue.prototype.enqueue = function (value) {
        var node = { value: value };
        if (this._head)
            this._tail.next = node;
        else
            this._head = node;
        this._tail = node;
        this._size++;
    };
    Queue.prototype.dequeue = function () {
        var current = this._head.value;
        if (!current) {
            return;
        }
        this._head = this._head.next;
        this._size--;
        return current;
    };
    Queue.prototype.peek = function () {
        var _a;
        return ((_a = this._head) === null || _a === void 0 ? void 0 : _a.value) || null;
    };
    Queue.prototype.clear = function () {
        this._head = null;
        this._tail = null;
        this._size = 0;
    };
    Queue.prototype.copyInto = function (queue) {
        this._head = queue._head;
        this._tail = queue._tail;
        this._size = queue._size;
    };
    Object.defineProperty(Queue.prototype, "size", {
        get: function () {
            return this._size;
        },
        enumerable: false,
        configurable: true
    });
    Queue.prototype[Symbol.iterator] = function () {
        var current;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    current = this._head;
                    _a.label = 1;
                case 1:
                    if (!current) return [3 /*break*/, 3];
                    return [4 /*yield*/, current];
                case 2:
                    _a.sent();
                    current = current.next;
                    return [3 /*break*/, 1];
                case 3: return [2 /*return*/];
            }
        });
    };
    return Queue;
}());
exports.default = Queue;
