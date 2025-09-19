export class Stack<T> {
	private _items: T[] = []
	private _default?: T

	setDefault(item: T) {
		this._default = item
	}

	push(value: T): number {
		return this._items.unshift(value)
	}

	pop(): T {
		return (this._items.length === 0) ? this._default! : this._items.shift()!
	}

	peek(): T {
		return (this._items.length === 0) ? this._default! : this._items[0]
	}
}
