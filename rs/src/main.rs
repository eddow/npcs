use std::collections::HashMap;
use std::env;
use std::fs;
use std::process;

use npcs::executor::{Context, ExecResult};
use npcs::value::Value;

struct CliContext {
    variables: HashMap<String, Value>,
    output: Vec<String>,
}

impl CliContext {
    fn new() -> Self {
        let mut variables = HashMap::new();
        variables.insert("yield".into(), Value::NativeFunction("yield".into()));
        Self {
            variables,
            output: Vec::new(),
        }
    }
}

impl Context for CliContext {
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
                println!("{msg}");
                self.output.push(msg);
                Some(Value::Nil)
            }
            "yield" => Some(args.first().cloned().unwrap_or(Value::Nil)),
            _ => None,
        }
    }
}

fn main() {
    let args: Vec<String> = env::args().collect();

    if args.len() < 2 {
        eprintln!("Usage: npcs <file.npcs>");
        process::exit(1);
    }

    let path = &args[1];
    let source = match fs::read_to_string(path) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Error reading {path}: {e}");
            process::exit(1);
        }
    };

    match npcs::parse(&source) {
        Ok(program) => {
            let mut ctx = CliContext::new();
            match npcs::execute(&program, &mut ctx) {
                Ok(ExecResult::Return(val)) => {
                    if let Some(v) = val {
                        println!("=> {v}");
                    }
                }
                Ok(ExecResult::Yield(val)) => {
                    println!("⏸️  yielded: {val}");
                }
                Ok(_) => {}
                Err(e) => {
                    eprintln!("Runtime error: {e}");
                    process::exit(1);
                }
            }
        }
        Err(e) => {
            eprintln!("Parse error: {e}");
            process::exit(1);
        }
    }
}
