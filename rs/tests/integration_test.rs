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
