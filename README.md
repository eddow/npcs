Source: https://github.com/ayecue/miniscript-core

# MiniScript Executor

A comprehensive MiniScript executor with linear stateful execution.

## Use case

TL;DR: Programmable Behavioral Trees

Your NPC is executing a complex async script - go to that room, open a chest, kill an apple, ...
Of course, these are full of async/await as each step takes a certain time.

When your goblin is about to open a door, your mom comes home, you save, install a windows update, reboot...

In the evening, you load your game again - and your goblin finishes opening the door and the remaining of his script.

### MiniScript

It's basically quick-basic on steroids (functional and with iterations)

### Main feature

Give it a scope, with values and callbacks, and execute it. The script will return
- `{type: 'return', value?: any}` = the script just returned something (and you have the value)
- `{type: 'yield', value: any, state: string}` = the script yielded something, use that value and store the state to be able to "`next()`" (basically, all `execute` functions take an optional `state`)


### Yielding in MiniScript

Functions can be *evaluated* with `a(x, y, z)` or *stated* - like in `print "Hello"`.

When a function is *stated*, if it returns a value, this value is yielded.

This will yield "Hello!":

```
say = function(text)
	return text + "!"
end function

say "Hello"
```

### Hard-coded function

Of course, a context with "global" values is provided by JS, and the context can provide functions - who can return stuff (who will be yielded if these functions are stated)

## Features

- ✅ **Complete MiniScript Support**: Variables, functions, objects, arrays, control flow
- ✅ **Object Creation & Access**: `{name: "John", age: 39}` with property access
- ✅ **Array Support**: `["apple", "banana"]` with index access
- ✅ **Function Definitions**: `function(param) ... end function`
- ✅ **Control Flow**: `if/else`, `while` and `for ... in ...` loops, `break` statements
- ✅ **Pause/Resume Execution**: `yield()` function pauses execution and serializes state
- ✅ **State Serialization**: Complete execution state can be saved and restored
- ✅ **Cross-Executor Restoration**: Resume execution in a completely new executor instance
- ✅ **Plan Guards**: `checking` clauses can guard a `plan` on entry and on resume
- ✅ **Comprehensive Testing**: 26+ test cases covering all features

## Guarded plans with `checking`

`plan` is the long-lived behavior block. `checking` lets you attach one or more invariants to that plan.

```miniscript
plan goToWork
	checking "Not hungry": hunger < 10
	checking has_job
	walk_to office
	work
end plan
```

Semantics:

- `checking` clauses belong to the `plan`, not to the executable body
- all checks must pass to enter the plan body
- checks are reevaluated when execution resumes after a `yield`
- v1 does **not** reevaluate checks on ordinary variable writes between yields
- v1 does **not** reevaluate checks just before outbound `yield` or `return`

Optional debug payload:

- `checking condition`
- `checking payload: condition`

The optional payload is any MiniScript expression. NPCS stores its value on plan entry and again when a check fails, so cancellation/debug layers can compare both snapshots.
