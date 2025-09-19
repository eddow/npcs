"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Stack = void 0;
var Stack = /** @class */ (function () {
    function Stack() {
        this._items = [];
        this._last = null;
        this._default = null;
    }
    Stack.prototype.setDefault = function (item) {
        this._default = item;
    };
    Stack.prototype.push = function (value) {
        return this._items.push((this._last = value));
    };
    Stack.prototype.pop = function () {
        switch (this._items.length) {
            case 0:
                return this._default;
            case 1: {
                this._last = null;
                return this._items.pop();
            }
        }
        var ret = this._items.pop();
        this._last = this._items[this._items.length - 1];
        return ret;
    };
    Stack.prototype.peek = function () {
        return this._last || this._default;
    };
    return Stack;
}());
exports.Stack = Stack;
