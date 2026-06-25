use npcs::executor::{Context, ExecResult};
use npcs::value::Value;
use std::collections::HashMap;

struct TestContext {
    variables: HashMap<String, Value>,
    pub output: Vec<String>,
}

impl TestContext {
    fn new() -> Self {
        let mut variables = HashMap::new();
        variables.insert("yield".into(), Value::NativeFunction("yield".into()));
        variables.insert("print".into(), Value::NativeFunction("print".into()));
        Self {
            variables,
            output: Vec::new(),
        }
    }
}

impl Context for TestContext {
    fn get(&self, name: &str) -> Option<Value> {
        self.variables.get(name).cloned()
    }

    fn call_native(&mut self, name: &str, args: &[Value]) -> Option<Value> {
        match name {
            "print" => {
                let msg = args
                    .iter()
                    .map(|v| v.to_string())
                    .collect::<Vec<_>>()
                    .join(" ");
                self.output.push(msg);
                Some(Value::Nil)
            }
            "yield" => Some(args.first().cloned().unwrap_or(Value::Nil)),
            _ => None,
        }
    }
}

fn run(source: &str) -> Result<(ExecResult, Vec<String>), String> {
    let mut ctx = TestContext::new();
    let result = npcs::run(source, &mut ctx)?;
    Ok((result, ctx.output))
}

#[test]
fn basic_arithmetic() {
    let source = r#"
x = 10
y = 5
sum = x + y
product = x * y
print "Sum: " + sum
print "Product: " + product
"#;
    let (result, output) = run(source).unwrap();
    assert!(matches!(result, ExecResult::Return(None)));
    assert_eq!(output, vec!["Sum: 15", "Product: 50"]);
}

#[test]
fn string_concat() {
    let (_, output) = run(r#"print "Hello, " + "World!""#).unwrap();
    assert_eq!(output, vec!["Hello, World!"]);
}

#[test]
fn if_statement() {
    let (_, output) = run(r#"
x = 10
if x > 5 then
    print "yes"
else
    print "no"
end if
"#)
    .unwrap();
    assert_eq!(output, vec!["yes"]);
}

#[test]
fn if_else_statement() {
    let (_, output) = run(r#"
x = 3
if x > 5 then
    print "yes"
else
    print "no"
end if
"#)
    .unwrap();
    assert_eq!(output, vec!["no"]);
}

#[test]
fn function_call() {
    let (_, output) = run(r#"
function greet(name)
    print "Hello, " + name + "!"
end function

greet "World"
"#)
    .unwrap();
    assert_eq!(output, vec!["Hello, World!"]);
}

#[test]
fn function_return_value() {
    let (_, output) = run(r#"
function add(a, b)
    return a + b
end function

result = add(5, 3)
print "Result: " + result
"#)
    .unwrap();
    assert_eq!(output, vec!["Result: 8"]);
}

#[test]
fn for_loop() {
    let (_, output) = run(r#"
fruits = ["apple", "banana", "orange"]
for fruit in fruits
    print fruit
end for
"#)
    .unwrap();
    assert_eq!(output, vec!["apple", "banana", "orange"]);
}

#[test]
fn boolean_logic() {
    let (_, output) = run(r#"
print true and true
print true and false
print false or true
print false or false
"#)
    .unwrap();
    assert_eq!(output, vec!["true", "false", "true", "false"]);
}

#[test]
fn object_literal() {
    let (_, output) = run(r#"
person = {name: "Alice", age: 30}
print person.name
print person.age
"#)
    .unwrap();
    assert_eq!(output, vec!["Alice", "30"]);
}

#[test]
fn list_indexing() {
    let (_, output) = run(r#"
items = ["a", "b", "c"]
print items[0]
print items[1]
print items.length
"#)
    .unwrap();
    assert_eq!(output, vec!["a", "b", "3"]);
}

#[test]
fn while_loop() {
    let (_, output) = run(r#"
counter = 0
do while counter < 3
    print counter
    counter = counter + 1
loop
"#)
    .unwrap();
    assert_eq!(output, vec!["0", "1", "2"]);
}

#[test]
fn do_while_no_condition() {
    let (_, output) = run(r#"
counter = 0
do
    print counter
    counter = counter + 1
    if counter >= 2 then break
loop
"#)
    .unwrap();
    assert_eq!(output, vec!["0", "1"]);
}

#[test]
fn ternary_expression() {
    let (_, output) = run(r#"
x = 10
result = "yes" if x > 5 else "no"
print result
"#)
    .unwrap();
    assert_eq!(output, vec!["yes"]);
}

#[test]
fn comparison_operators() {
    let (_, output) = run(r#"
print 5 < 10
print 10 == 10
print 3 != 4
print 7 > 2
print 5 <= 5
print 6 >= 5
"#)
    .unwrap();
    assert_eq!(output, vec!["true", "true", "true", "true", "true", "true"]);
}

// ── Tier 2: LValue member assignment ────────────────────────────

#[test]
fn member_assignment() {
    let (_, output) = run(r#"
person = { name: "Alice", age: 30 }
person.age = 31
print person.age
print person.name
"#)
    .unwrap();
    assert_eq!(output, vec!["31", "Alice"]);
}

#[test]
fn index_assignment() {
    let (_, output) = run(r#"
arr = [10, 20, 30]
arr[1] = 25
print arr[0]
print arr[1]
print arr[2]
"#)
    .unwrap();
    assert_eq!(output, vec!["10", "25", "30"]);
}

// ── Tier 2: Compound assignment ──────────────────────────────────

#[test]
fn compound_assignment() {
    let (_, output) = run(r#"
x = 10
x += 5
print x
y = 20
y -= 3
print y
z = 2
z *= 4
print z
"#)
    .unwrap();
    assert_eq!(output, vec!["15", "17", "8"]);
}

// ── Tier 2: Numeric literal edge cases ───────────────────────────

#[test]
fn numeric_edge_cases() {
    let (_, output) = run(r#"
print 0.5
print .5 + .3
"#)
    .unwrap();
    assert_eq!(output, vec!["0.5", "0.8"]);
}

// ── Tier 2: Function parameter defaults ──────────────────────────

#[test]
fn function_param_defaults() {
    let (_, output) = run(r#"
function greet(name = "World")
    print "Hello, " + name
end function

greet()
greet("Alice")
"#)
    .unwrap();
    assert_eq!(output, vec!["Hello, World", "Hello, Alice"]);
}

// ── Tier 2: Nested member assignment ───────────────────────────

#[test]
fn nested_member_assignment() {
    let (_, output) = run(r#"
person = {name: "Alice", address: {city: "OldTown", zip: "12345"}}
person.address.city = "NewTown"
print person.address.city
print person.address.zip
"#)
    .unwrap();
    assert_eq!(output, vec!["NewTown", "12345"]);
}

// ── Tier 2: Continue in do-while ─────────────────────────────────

#[test]
fn continue_in_do_while() {
    let (_, output) = run(r#"
i = 0
do
    i = i + 1
    if i == 2 then continue
    if i > 3 then break
    print i
loop
"#)
    .unwrap();
    assert_eq!(output, vec!["1", "3"]);
}

// ── Tier 2: Scientific notation numbers ──────────────────────────

#[test]
fn scientific_notation() {
    let (_, output) = run(r#"
print 1e3
print 1.5e-2
print 5.
"#)
    .unwrap();
    assert_eq!(output, vec!["1000", "0.015", "5"]);
}

// ── Tier 3: Plan lifecycle ───────────────────────────────────────

struct TestPlanContext {
    variables: HashMap<String, Value>,
    pub output: Vec<String>,
    pub plan_calls: Vec<String>,
}

impl TestPlanContext {
    fn new() -> Self {
        let mut variables = HashMap::new();
        variables.insert("yield".into(), Value::NativeFunction("yield".into()));
        variables.insert("print".into(), Value::NativeFunction("print".into()));
        Self {
            variables,
            output: Vec::new(),
            plan_calls: Vec::new(),
        }
    }
}

impl Context for TestPlanContext {
    fn get(&self, name: &str) -> Option<Value> {
        self.variables.get(name).cloned()
    }

    fn call_native(&mut self, name: &str, args: &[Value]) -> Option<Value> {
        match name {
            "print" => {
                let msg = args
                    .iter()
                    .map(|v| v.to_string())
                    .collect::<Vec<_>>()
                    .join(" ");
                self.output.push(msg);
                Some(Value::Nil)
            }
            "yield" => Some(args.first().cloned().unwrap_or(Value::Nil)),
            _ => None,
        }
    }

    fn plan_begin(&mut self, pv: &Value) {
        self.plan_calls.push(format!("begin({pv})"));
    }
    fn plan_conclude(&mut self, pv: &Value) {
        self.plan_calls.push(format!("conclude({pv})"));
    }
    fn plan_cancel(&mut self, pv: &Value, reason: Option<&str>) {
        let r = reason.unwrap_or("");
        self.plan_calls.push(format!("cancel({pv}, {r})"));
    }
    fn plan_finally(&mut self, pv: &Value) {
        self.plan_calls.push(format!("finally({pv})"));
    }
}

fn run_plan(source: &str) -> Result<(ExecResult, Vec<String>, Vec<String>), String> {
    let mut ctx = TestPlanContext::new();
    let result = npcs::run(source, &mut ctx)?;
    Ok((result, ctx.output, ctx.plan_calls))
}

#[test]
fn plan_basic_lifecycle() {
    let (_, output, calls) = run_plan(
        r#"
plan "test-plan"
    print "inside"
end plan
print "after"
"#,
    )
    .unwrap();
    assert_eq!(output, vec!["inside", "after"]);
    assert_eq!(
        calls,
        vec![
            "begin(test-plan)",
            "conclude(test-plan)",
            "finally(test-plan)"
        ]
    );
}

#[test]
fn plan_checking_pass() {
    let (_, output, calls) = run_plan(
        r#"
x = 10
plan "check-pass"
checking "x is 10": x == 10
    print "inside"
end plan
print "done"
"#,
    )
    .unwrap();
    assert_eq!(output, vec!["inside", "done"]);
    assert_eq!(
        calls,
        vec![
            "begin(check-pass)",
            "conclude(check-pass)",
            "finally(check-pass)"
        ]
    );
}

#[test]
fn plan_checking_fail() {
    let (_, output, calls) = run_plan(
        r#"
x = 5
plan "check-fail"
checking "x is 10": x == 10
    print "inside"
end plan
print "skipped"
"#,
    )
    .unwrap();
    assert_eq!(output, vec!["skipped"]);
    // No plan callbacks since the plan was never entered
    assert!(calls.is_empty());
}

#[test]
fn plan_return_cancels() {
    let (_, output, calls) = run_plan(
        r#"
function foo()
    plan "return-test"
        return 42
    end plan
    print "after-return"
end function
result = foo()
print result
"#,
    )
    .unwrap();
    assert_eq!(output, vec!["42"]);
    // Return inside a plan cancels it
    assert_eq!(
        calls,
        vec![
            "begin(return-test)",
            "cancel(return-test, return)",
            "finally(return-test)"
        ]
    );
}

#[test]
fn plan_break_cancels() {
    let (_, output, calls) = run_plan(
        r#"
for i in [1, 2, 3]
    plan "iter-" + i
        if i == 2 then break
        print i
    end plan
end for
print "done"
"#,
    )
    .unwrap();
    assert_eq!(output, vec!["1", "done"]);
    assert_eq!(calls.len(), 3 * 2); // begin+finally for plan "iter-1", cancel+finally for "iter-2"
    assert!(calls.contains(&"begin(iter-1)".to_string()));
    assert!(calls.contains(&"conclude(iter-1)".to_string()));
    assert!(calls.contains(&"begin(iter-2)".to_string()));
    assert!(calls.contains(&"cancel(iter-2, break)".to_string()));
}

#[test]
fn plan_yield_resume() {
    use npcs::executor::Executor;

    let script = npcs::compile(
        r#"
plan "yield-plan"
    print "step1"
    yield "paused"
    print "step2"
end plan
print "done"
"#,
    )
    .unwrap();

    let mut ctx = TestPlanContext::new();
    let mut exec = Executor::new(&script);
    let result = exec.execute(&mut ctx).unwrap();
    let state = exec.state();

    assert!(matches!(result, ExecResult::Yield(_)));
    assert_eq!(ctx.output, vec!["step1"]);
    assert_eq!(ctx.plan_calls, vec!["begin(yield-plan)"]);

    // Resume from saved state
    let mut ctx2 = TestPlanContext::new();
    let mut exec2 = Executor::from_state(&script, &state);
    let result2 = exec2.execute(&mut ctx2).unwrap();

    assert!(matches!(result2, ExecResult::Return(None)));
    assert_eq!(ctx2.output, vec!["step2", "done"]);
    assert_eq!(
        ctx2.plan_calls,
        vec!["conclude(yield-plan)", "finally(yield-plan)"]
    );
}

// ── Tier 5: isa custom registry ───────────────────────────────────

#[test]
fn isa_custom_type_via_context() {
    use npcs::executor::Context;
    use npcs::value::Value;

    struct CustomIsaContext {
        output: Vec<String>,
    }

    impl Context for CustomIsaContext {
        fn get(&self, _name: &str) -> Option<Value> {
            None
        }
        fn call_native(&mut self, name: &str, args: &[Value]) -> Option<Value> {
            if name == "print" {
                self.output.push(
                    args.iter()
                        .map(|v| v.to_string())
                        .collect::<Vec<_>>()
                        .join(" "),
                );
                Some(Value::Nil)
            } else {
                None
            }
        }
        fn isa_check(&self, type_name: &str, value: &Value) -> Option<bool> {
            match type_name {
                "even" => match value {
                    Value::Number(n) => Some(*n as i64 % 2 == 0),
                    _ => Some(false),
                },
                _ => None,
            }
        }
    }

    let source = r#"
x = 4
y = 5
print x isa even
print y isa even
print x isa number
print "hello" isa string
"#;
    let script = npcs::compile(source).unwrap();
    let mut ctx = CustomIsaContext { output: vec![] };
    let mut exec = npcs::executor::Executor::new(&script);
    exec.execute(&mut ctx).unwrap();
    assert_eq!(ctx.output, vec!["true", "false", "true", "true"]);
}

// ── Tier 5: String escape sequences ────────────────────────────────

#[test]
fn string_escape_sequences() {
    let (_, output) = run(r#"
print "line1\nline2"
print "tab\there"
print "return\rhere"
print "null\0char"
"#)
    .unwrap();
    assert_eq!(
        output,
        vec!["line1\nline2", "tab\there", "return\rhere", "null\0char"]
    );
}

// ── Tier 5: Shortcut if/then syntax ────────────────────────────────

#[test]
fn shortcut_if_then() {
    let (_, output) = run(r#"x = 10
if x > 5 then print "yes"
if x < 5 then print "no" else print "yes-else"
"#)
    .unwrap();
    assert_eq!(output, vec!["yes", "yes-else"]);
}

// ── Tier 5: Block comment in expression ────────────────────────────

#[test]
fn block_comment_in_expression() {
    let (_, output) = run(r#"
x = 10 /* inline comment */ + 5
print x
"#)
    .unwrap();
    assert_eq!(output, vec!["15"]);
}
