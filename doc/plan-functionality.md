## Plans: What they are and how to use them

Plans are MiniScript blocks that behave like promises: they have a lifecycle, they can be cancelled from the host, and they standardize completion and cleanup.

### Syntax
```miniscript
plan <expression>
    ...your code...
end plan
```
`<expression>` is any value you choose to identify the plan (string, object, etc.). This exact value is passed to lifecycle callbacks and is used to cancel the plan later.

### Lifecycle and callbacks (order matters)
- begin(plan)
- conclude(plan) or cancel(plan)
- finally(plan)

The engine calls `begin` right when entering the plan, then either `conclude` at `end plan` or `cancel` if the plan is interrupted, and always `finally` afterward.

You provide these callbacks on the execution context as `context.plan`:
```ts
const context = {
  plan: {
    begin(value)    { console.log(value, 'began') },
    conclude(value) { console.log(value, 'concluded') },
    cancel(value)   { console.log(value, 'cancelled') },
    finally(value)  { console.log(value, 'finalized') }
  },
  print: console.log,
}
```

### Cancelling a plan from the host
Use `script.cancel(planValue)` (on the `ScriptExecutor` instance) to cancel:
- If `planValue` is found: that plan and any nested sub-plans are cancelled; the executor’s state rewinds to just after the plan block. The call returns the new `ExecutionState`.
- If `planValue` is not found: all active plans are cancelled; the script is considered fully cancelled and the call returns `undefined`.

Typical flow when you run until yield:
1) Run script → it yields a value and returns `{ type: 'yield', value, state }`
2) Optionally cancel with `executor.cancel(planValue)` using the captured `state`
3) Or continue later by resuming execution with that `state`

### What happens inside a plan
- Yielding works normally; your host receives yields and can resume later with the returned `state`.
- `return` inside a plan cancels the plan before returning from the function.
- `continue` inside a loop cancels the current plan and continues the loop.
- `break` inside a loop cancels the current plan and exits the loop.
- Exiting the function (e.g., natural function return) that contains a plan cancels that plan.

These behaviors ensure plans don’t leak outside their scope.

### Examples

Basic plan with yields:
```miniscript
plan "download-file"
    print "start"
    yield "request-sent"
    print "done"
end plan
```

Nested plans:
```miniscript
plan "parent"
    plan "child"
        yield "child-step"
    end plan
end plan
```
Cancelling "parent" will also cancel "child".

Loop control:
```miniscript
for i in [1, 2, 3]
    plan "iteration-" + i
        if i == 2 then continue  // cancels this plan and continues loop
        if i == 3 then break      // cancels this plan and exits loop
        print i
    end plan
end for
```

### Host-side quick start
```ts
import NpcScript from 'npcs'

const npc = new NpcScript(source)
const context = { print: console.log, plan: { begin(){}, conclude(){}, cancel(){}, finally(){} } }

// First run
let { type, value, state } = npc.execute(context)

// If yielded, you can cancel a plan using an executor created with that state
// const executor = new ScriptExecutor(npc, context, state)
// const newStateOrUndefined = executor.cancel('download-file')

// Or resume later with the saved state
// const next = npc.execute(context, state)
```

### Notes
- Callbacks are optional: missing ones are simply not invoked.
- The plan value is by-reference for objects and by-value for primitives; use the same value to cancel.
- Plans are stack-like: most recent plan cancels first; cancelling a plan also cancels any plans started inside it.
