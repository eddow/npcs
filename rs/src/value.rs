use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fmt;
use std::rc::Rc;

use crate::ast::Stmt;

/// Runtime value — the `any` equivalent from TypeScript.
#[derive(Clone, Serialize, Deserialize)]
pub enum Value {
    Nil,
    Bool(bool),
    Number(f64),
    String(String),
    List(Vec<Value>),
    Map(BTreeMap<String, Value>),
    Function(FunctionDef),
    #[serde(skip)]
    NativeFunction(String), // not serializable — host provides on resume
}

/// Serializable function definition.
#[derive(Clone, Serialize, Deserialize)]
pub struct FunctionDef {
    pub index: usize,
    pub params: Vec<String>,
    pub param_defaults: Vec<Option<Value>>,
    #[serde(skip)]
    pub body: Rc<Vec<Stmt>>,
}

impl fmt::Debug for Value {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            Value::Nil => write!(f, "nil"),
            Value::Bool(b) => write!(f, "{b}"),
            Value::Number(n) => write!(f, "{n}"),
            Value::String(s) => write!(f, "{s:?}"),
            Value::List(items) => write!(f, "{items:?}"),
            Value::Map(m) => write!(f, "{m:?}"),
            Value::Function(fd) => write!(f, "fn({})", fd.params.join(", ")),
            Value::NativeFunction(name) => write!(f, "<native {name}>"),
        }
    }
}

impl fmt::Display for Value {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            Value::Nil => write!(f, "null"),
            Value::Bool(b) => write!(f, "{b}"),
            Value::Number(n) => write!(f, "{n}"),
            Value::String(s) => write!(f, "{s}"),
            Value::List(items) => {
                write!(f, "[")?;
                for (i, item) in items.iter().enumerate() {
                    if i > 0 {
                        write!(f, ", ")?;
                    }
                    write!(f, "{item}")?;
                }
                write!(f, "]")
            }
            Value::Map(m) => {
                write!(f, "{{")?;
                for (i, (k, v)) in m.iter().enumerate() {
                    if i > 0 {
                        write!(f, ", ")?;
                    }
                    write!(f, "{k}: {v}")?;
                }
                write!(f, "}}")
            }
            Value::Function(fd) => write!(f, "<function({})>", fd.params.join(", ")),
            Value::NativeFunction(name) => write!(f, "<native {name}>"),
        }
    }
}

/// JS-like fuzzy equality (matches the TypeScript `==` behavior used in npc-s).
impl PartialEq for Value {
    fn eq(&self, other: &Self) -> bool {
        match (self, other) {
            (Value::Nil, Value::Nil) => true,
            (Value::Bool(a), Value::Bool(b)) => a == b,
            (Value::Number(a), Value::Number(b)) => a == b,
            (Value::String(a), Value::String(b)) => a == b,

            // Coercion: JS == behavior
            (Value::Number(a), Value::Bool(b)) => (*a != 0.0) == *b,
            (Value::Bool(a), Value::Number(b)) => *a == (*b != 0.0),
            (Value::Number(a), Value::String(b)) => b.parse::<f64>().map_or(false, |n| *a == n),
            (Value::String(a), Value::Number(b)) => a.parse::<f64>().map_or(false, |n| n == *b),
            (Value::String(a), Value::Bool(b)) => {
                if *b {
                    !a.is_empty()
                } else {
                    a.is_empty()
                }
            }
            (Value::Bool(a), Value::String(b)) => {
                if *a {
                    !b.is_empty()
                } else {
                    b.is_empty()
                }
            }

            // Nil == Nil, Nil == false
            (Value::Nil, Value::Bool(false)) | (Value::Bool(false), Value::Nil) => true,
            (Value::Nil, Value::Number(0.0)) | (Value::Number(0.0), Value::Nil) => true,
            (Value::Nil, Value::String(s)) | (Value::String(s), Value::Nil) => s.is_empty(),

            // Structural equality for containers
            (Value::List(a), Value::List(b)) => a == b,
            (Value::Map(a), Value::Map(b)) => a == b,

            _ => false,
        }
    }
}

impl Value {
    /// Is this value "truthy" in MiniScript?
    pub fn is_truthy(&self) -> bool {
        match self {
            Value::Nil => false,
            Value::Bool(b) => *b,
            Value::Number(n) => *n != 0.0,
            Value::String(s) => !s.is_empty(),
            _ => true,
        }
    }

    pub fn type_name(&self) -> &'static str {
        match self {
            Value::Nil => "null",
            Value::Bool(_) => "boolean",
            Value::Number(_) => "number",
            Value::String(_) => "string",
            Value::List(_) => "list",
            Value::Map(_) => "map",
            Value::Function(_) => "function",
            Value::NativeFunction(_) => "function",
        }
    }
}
