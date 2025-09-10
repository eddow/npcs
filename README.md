# MiniScript Executor with Testing

A comprehensive MiniScript executor with linear stateful execution.

## Use case

Your NPC is executing a complex async script - go to that room, open a chest, kill the apple, ...
Of course, these are full of async/await as each step takes a certain time.

When your goblin is about to open a door, your mom comes home, you save, install a windows update, reboot...

In the evening, you load your game again - and your goblin finishes opening the door and his script.

## Main feature

Give it a scope, with values and callbacks, and execute it. The script will return
- `eob` = End Of Block - it just executed
- `return` = the script just returned something (and you have the value)
- `yield` = the script yielded something, use that value and store the `executor.scopes`


## Features

- ✅ **Complete MiniScript Support**: Variables, functions, objects, arrays, control flow
- ✅ **Object Creation & Access**: `{name: "John", age: 39}` with property access
- ✅ **Array Support**: `["apple", "banana"]` with index access
- ✅ **Function Definitions**: `function(param) ... end function`
- ✅ **Control Flow**: `if/else`, `while` loops, `break` statements
- ✅ **Pause/Resume Execution**: `yield()` function pauses execution and serializes state
- ✅ **State Serialization**: Complete execution state can be saved and restored
- ✅ **Cross-Executor Restoration**: Resume execution in a completely new executor instance
- ✅ **Comprehensive Testing**: 26+ test cases covering all features
