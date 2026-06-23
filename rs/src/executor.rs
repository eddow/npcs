use std::collections::{BTreeMap, HashMap};
use std::rc::Rc;

use crate::ast::*;
use crate::value::*;

/// Execution result.
#[derive(Debug, Clone)]
pub enum ExecResult {
    Return(Option<Value>),
    Yield(Value),
    None,
}

/// Variable scope chain.
#[derive(Debug, Clone)]
struct Scope {
    variables: HashMap<String, Value>,
    parent: Option<Box<Scope>>,
}

impl Scope {
    fn new() -> Self {
        Self {
            variables: HashMap::new(),
            parent: None,
        }
    }

    fn get(&self, name: &str) -> Option<&Value> {
        self.variables
            .get(name)
            .or_else(|| self.parent.as_ref().and_then(|p| p.get(name)))
    }

    fn set(&mut self, name: &str, value: Value) {
        if self.variables.contains_key(name) || self.parent.is_none() {
            self.variables.insert(name.to_string(), value);
        } else if let Some(ref mut parent) = self.parent {
            parent.set(name, value);
        }
    }

    fn define(&mut self, name: &str, value: Value) {
        self.variables.insert(name.to_string(), value);
    }
}

/// Loop scope tracking.
#[derive(Debug, Clone)]
enum LoopScope {
    ForIn {
        iterator: Vec<Value>,
        index: usize,
        variable: String,
    },
    DoWhile,
}

pub struct Executor {
    stack: Vec<Scope>,
    loop_scopes: Vec<LoopScope>,
    /// (name, params, param_defaults, body)
    functions: Vec<(String, Vec<String>, Vec<Option<Expr>>, Vec<Stmt>)>,
}

impl Executor {
    pub fn new() -> Self {
        Self {
            stack: vec![Scope::new()],
            loop_scopes: Vec::new(),
            functions: Vec::new(),
        }
    }

    fn scope(&self) -> &Scope {
        self.stack.last().unwrap()
    }
    fn scope_mut(&mut self) -> &mut Scope {
        self.stack.last_mut().unwrap()
    }

    pub fn execute(
        &mut self,
        program: &Program,
        context: &mut dyn Context,
    ) -> Result<ExecResult, String> {
        // Collect function definitions
        for stmt in &program.body {
            if let Stmt::Assignment { target, value, .. } = stmt {
                if let Expr::Identifier { name, .. } = target.as_ref() {
                    if let Expr::Function {
                        params,
                        param_defaults,
                        body,
                        ..
                    } = value.as_ref()
                    {
                        self.functions.push((
                            name.clone(),
                            params.clone(),
                            param_defaults.clone(),
                            body.clone(),
                        ));
                    }
                }
            }
        }
        match self.execute_block(&program.body, context)? {
            ExecResult::None => Ok(ExecResult::Return(None)),
            other => Ok(other),
        }
    }

    fn execute_block(
        &mut self,
        stmts: &[Stmt],
        context: &mut dyn Context,
    ) -> Result<ExecResult, String> {
        for stmt in stmts {
            match self.execute_statement(stmt, context)? {
                ExecResult::Return(v) => return Ok(ExecResult::Return(v)),
                ExecResult::Yield(v) => return Ok(ExecResult::Yield(v)),
                ExecResult::None => {}
            }
        }
        Ok(ExecResult::None)
    }

    fn execute_statement(
        &mut self,
        stmt: &Stmt,
        context: &mut dyn Context,
    ) -> Result<ExecResult, String> {
        match stmt {
            Stmt::Assignment { target, value, .. } => {
                let val = self.evaluate(value, context)?;
                self.assign_to(target, val)?;
                Ok(ExecResult::None)
            }
            Stmt::Call { callee, args, .. } => {
                let name = match callee.as_ref() {
                    Expr::Identifier { name, .. } => name.clone(),
                    _ => return Err("statement call requires a function name".into()),
                };
                let mut evaled = Vec::new();
                for a in args {
                    evaled.push(self.evaluate(a, context)?);
                }
                self.call_function(&name, &evaled, context)
            }
            Stmt::If { clauses, .. } => {
                for c in clauses {
                    let take = match &c.condition {
                        Some(cond) => self.evaluate(cond, context)?.is_truthy(),
                        None => true,
                    };
                    if take {
                        return self.execute_block(&c.body, context);
                    }
                }
                Ok(ExecResult::None)
            }
            Stmt::For {
                variable,
                iterator,
                body,
                ..
            } => {
                let iter_val = self.evaluate(iterator, context)?;
                let items = match &iter_val {
                    Value::List(l) => l.clone(),
                    Value::Map(m) => m.keys().map(|k| Value::String(k.clone())).collect(),
                    _ => return Err(format!("cannot iterate over {iter_val:?}")),
                };
                self.loop_scopes.push(LoopScope::ForIn {
                    iterator: items.clone(),
                    index: 0,
                    variable: variable.clone(),
                });
                let r = self.execute_for_loop(variable, &items, body, context);
                self.loop_scopes.pop();
                r
            }
            Stmt::DoWhile {
                body,
                while_clauses,
                while_bodies,
                ..
            } => {
                self.loop_scopes.push(LoopScope::DoWhile);
                let r = self.execute_do_while(body, while_clauses, while_bodies, context);
                self.loop_scopes.pop();
                r
            }
            Stmt::Return { value, .. } => {
                let val = value
                    .as_ref()
                    .map(|v| self.evaluate(v, context))
                    .transpose()?;
                Ok(ExecResult::Return(val))
            }
            Stmt::Break { .. } => Err("break".into()),
            Stmt::Continue { .. } => Err("continue".into()),
            Stmt::Expr(expr) => {
                self.evaluate(expr, context)?;
                Ok(ExecResult::None)
            }
            Stmt::Plan { .. } => Ok(ExecResult::None),
        }
    }

    fn execute_for_loop(
        &mut self,
        var: &str,
        items: &[Value],
        body: &[Stmt],
        ctx: &mut dyn Context,
    ) -> Result<ExecResult, String> {
        for (i, item) in items.iter().enumerate() {
            if let Some(LoopScope::ForIn { index, .. }) = self.loop_scopes.last_mut() {
                *index = i;
            }
            self.scope_mut().define(var, item.clone());
            match self.execute_block(body, ctx) {
                Ok(ExecResult::None) => {}
                Ok(other) => return Ok(other),
                Err(ref e) if e == "break" => break,
                Err(ref e) if e == "continue" => continue,
                Err(e) => return Err(e),
            }
        }
        Ok(ExecResult::None)
    }

    fn execute_do_while(
        &mut self,
        body: &[Stmt],
        whiles: &[Expr],
        wbodies: &[Vec<Stmt>],
        ctx: &mut dyn Context,
    ) -> Result<ExecResult, String> {
        let mut occ = 0usize;
        loop {
            if occ > 1000 {
                return Err("do-while exceeded 1000 iterations".into());
            }
            occ += 1;
            match self.execute_block(body, ctx) {
                Ok(ExecResult::None) => {}
                Ok(other) => return Ok(other),
                Err(ref e) if e == "break" => break,
                Err(ref e) if e == "continue" => continue,
                Err(e) => return Err(e),
            }
            let mut again = whiles.is_empty(); // no while clauses → infinite loop (until break)
            for (i, cond) in whiles.iter().enumerate() {
                if self.evaluate(cond, ctx)?.is_truthy() {
                    if let Some(wb) = wbodies.get(i) {
                        match self.execute_block(wb, ctx) {
                            Ok(ExecResult::None) => {}
                            Ok(other) => return Ok(other),
                            Err(ref e) if e == "break" => {
                                again = false;
                                break;
                            }
                            Err(ref e) if e == "continue" => {
                                again = true;
                                break;
                            }
                            Err(e) => return Err(e),
                        }
                    }
                    again = true;
                    break;
                }
            }
            if !again {
                break;
            }
        }
        Ok(ExecResult::None)
    }

    fn call_function(
        &mut self,
        name: &str,
        args: &[Value],
        ctx: &mut dyn Context,
    ) -> Result<ExecResult, String> {
        if let Some(result) = ctx.call_native(name, args) {
            return if matches!(result, Value::Nil) {
                Ok(ExecResult::None)
            } else {
                Ok(ExecResult::Yield(result))
            };
        }
        let (params, _defaults, body) = self
            .functions
            .iter()
            .find(|(n, _, _, _)| n == name)
            .map(|(_, p, d, b)| (p.clone(), d.clone(), b.clone()))
            .ok_or_else(|| format!("function '{name}' not found"))?;
        let mut scope = Scope::new();
        for (i, p) in params.iter().enumerate() {
            let v = args.get(i).cloned().unwrap_or(Value::Nil);
            scope.define(p, v);
        }
        self.stack.push(scope);
        let saved = std::mem::take(&mut self.loop_scopes);
        let r = self.execute_block(&body, ctx);
        self.loop_scopes = saved;
        self.stack.pop();
        match r {
            Ok(ExecResult::Return(Some(v))) => Ok(ExecResult::Yield(v)),
            Ok(ExecResult::Return(None)) => Ok(ExecResult::None),
            Ok(ExecResult::Yield(v)) => Ok(ExecResult::Yield(v)),
            Ok(ExecResult::None) => Ok(ExecResult::None),
            Err(e) => Err(e),
        }
    }

    fn evaluate(&mut self, expr: &Expr, ctx: &mut dyn Context) -> Result<Value, String> {
        match expr {
            Expr::Number { value, .. } => Ok(Value::Number(*value)),
            Expr::String { value, .. } => Ok(Value::String(value.clone())),
            Expr::Boolean { value, .. } => Ok(Value::Bool(*value)),
            Expr::Nil { .. } => Ok(Value::Nil),
            Expr::Identifier { name, .. } => {
                for ls in self.loop_scopes.iter().rev() {
                    if let LoopScope::ForIn {
                        variable,
                        iterator,
                        index,
                        ..
                    } = ls
                    {
                        if variable == name {
                            return Ok(iterator[*index].clone());
                        }
                    }
                }
                self.scope()
                    .get(name)
                    .cloned()
                    .or_else(|| ctx.get(name))
                    .ok_or_else(|| format!("variable '{name}' not found"))
            }
            Expr::Unary { op, argument, .. } => {
                let arg = self.evaluate(argument, ctx)?;
                match op {
                    UnaryOp::Negate => match arg {
                        Value::Number(n) => Ok(Value::Number(-n)),
                        _ => Err("cannot negate non-number".into()),
                    },
                    UnaryOp::Not => Ok(Value::Bool(!arg.is_truthy())),
                    UnaryOp::Plus => Ok(arg),
                    UnaryOp::New => match &arg {
                        Value::Map(m) => Ok(Value::Map(m.clone())),
                        _ => Err("new expects a map".into()),
                    },
                }
            }
            Expr::Binary {
                op, left, right, ..
            } => {
                let l = self.evaluate(left, ctx)?;
                let r = self.evaluate(right, ctx)?;
                apply_binary(op, &l, &r)
            }
            Expr::Logical {
                op, left, right, ..
            } => {
                let l = self.evaluate(left, ctx)?;
                match op {
                    LogicalOp::And => {
                        if !l.is_truthy() {
                            Ok(l)
                        } else {
                            self.evaluate(right, ctx)
                        }
                    }
                    LogicalOp::Or => {
                        if l.is_truthy() {
                            Ok(l)
                        } else {
                            self.evaluate(right, ctx)
                        }
                    }
                }
            }
            Expr::ComparisonGroup { ops, exprs, .. } => {
                let mut lv = self.evaluate(&exprs[0], ctx)?;
                for i in 0..ops.len() {
                    let rv = self.evaluate(&exprs[i + 1], ctx)?;
                    if !apply_comparison(&ops[i], &lv, &rv)? {
                        return Ok(Value::Bool(false));
                    }
                    lv = rv;
                }
                Ok(Value::Bool(true))
            }
            Expr::Member {
                object, property, ..
            } => {
                let obj = self.evaluate(object, ctx)?;
                match &obj {
                    Value::Map(m) => Ok(m.get(property).cloned().unwrap_or(Value::Nil)),
                    Value::List(l) if property == "length" => Ok(Value::Number(l.len() as f64)),
                    Value::String(s) if property == "length" => {
                        Ok(Value::Number(s.chars().count() as f64))
                    }
                    _ => Ok(Value::Nil),
                }
            }
            Expr::Index { object, index, .. } => {
                let obj = self.evaluate(object, ctx)?;
                let idx = self.evaluate(index, ctx)?;
                match (&obj, &idx) {
                    (Value::List(l), Value::Number(n)) => {
                        Ok(l.get(*n as usize).cloned().unwrap_or(Value::Nil))
                    }
                    (Value::Map(m), Value::String(s)) => {
                        Ok(m.get(s).cloned().unwrap_or(Value::Nil))
                    }
                    (Value::String(s), Value::Number(n)) => Ok(s
                        .chars()
                        .nth(*n as usize)
                        .map(|c| Value::String(c.to_string()))
                        .unwrap_or(Value::Nil)),
                    _ => Err("invalid index".into()),
                }
            }
            Expr::Call { callee, args, .. } => {
                let name = match callee.as_ref() {
                    Expr::Identifier { name, .. } => name.clone(),
                    _ => return Err("call requires function name".into()),
                };
                let mut evaled = Vec::new();
                for a in args {
                    evaled.push(self.evaluate(a, ctx)?);
                }
                if let Some(result) = ctx.call_native(&name, &evaled) {
                    return Ok(result);
                }
                let (params, _defaults, body) = self
                    .functions
                    .iter()
                    .find(|(n, _, _, _)| n == &name)
                    .map(|(_, p, d, b)| (p.clone(), d.clone(), b.clone()))
                    .ok_or_else(|| format!("function '{name}' not found"))?;
                let mut scope = Scope::new();
                for (i, p) in params.iter().enumerate() {
                    scope.define(p, evaled.get(i).cloned().unwrap_or(Value::Nil));
                }
                self.stack.push(scope);
                let saved = std::mem::take(&mut self.loop_scopes);
                let r = self.execute_block(&body, ctx);
                self.loop_scopes = saved;
                self.stack.pop();
                match r {
                    Ok(ExecResult::Return(v)) => Ok(v.unwrap_or(Value::Nil)),
                    Ok(_) => Ok(Value::Nil),
                    Err(e) => Err(e),
                }
            }
            Expr::Function { params, body, .. } => Ok(Value::Function(FunctionDef {
                index: 0,
                params: params.clone(),
                param_defaults: vec![],
                body: Rc::new(body.clone()),
            })),
            Expr::Map { fields, .. } => {
                let mut m = BTreeMap::new();
                for (k, v) in fields {
                    m.insert(k.clone(), self.evaluate(v, ctx)?);
                }
                Ok(Value::Map(m))
            }
            Expr::List { items, .. } => {
                let mut l = Vec::new();
                for item in items {
                    l.push(self.evaluate(item, ctx)?);
                }
                Ok(Value::List(l))
            }
            Expr::Ternary {
                condition,
                true_val,
                false_val,
                ..
            } => {
                if self.evaluate(condition, ctx)?.is_truthy() {
                    self.evaluate(true_val, ctx)
                } else {
                    self.evaluate(false_val, ctx)
                }
            }
            Expr::Isa { left, right, .. } => {
                let val = self.evaluate(left, ctx)?;
                let tn = match right.as_ref() {
                    Expr::Identifier { name, .. } => name,
                    _ => return Err("isa requires type name".into()),
                };
                Ok(Value::Bool(match tn.as_str() {
                    "number" => matches!(val, Value::Number(_)),
                    "string" => matches!(val, Value::String(_)),
                    "boolean" => matches!(val, Value::Bool(_)),
                    "list" => matches!(val, Value::List(_)),
                    "map" => matches!(val, Value::Map(_)),
                    "function" => matches!(val, Value::Function(_) | Value::NativeFunction(_)),
                    _ => return Err(format!("unknown isa type: {tn}")),
                }))
            }
            Expr::Slice {
                base, left, right, ..
            } => {
                let bv = self.evaluate(base, ctx)?;
                let lv = self.evaluate(left, ctx)?;
                let rv = self.evaluate(right, ctx)?;
                let len = match &bv {
                    Value::String(s) => s.chars().count(),
                    Value::List(l) => l.len(),
                    _ => return Err("slice requires string/list".into()),
                };
                let to_idx = |v: &Value| -> Result<usize, String> {
                    match v {
                        Value::Number(n) => {
                            let mut i = *n as isize;
                            if i < 0 {
                                i += len as isize;
                            }
                            Ok(i.max(0) as usize)
                        }
                        Value::Nil => Ok(len),
                        _ => Err("slice index must be number".into()),
                    }
                };
                let s = to_idx(&lv)?;
                let e = to_idx(&rv)?.min(len).max(s);
                match &bv {
                    Value::String(x) => Ok(Value::String(x.chars().skip(s).take(e - s).collect())),
                    Value::List(x) => Ok(Value::List(x[s..e].to_vec())),
                    _ => unreachable!(),
                }
            }
            Expr::Paren(inner) => self.evaluate(inner, ctx),
        }
    }

    fn assign_to(&mut self, target: &Expr, value: Value) -> Result<(), String> {
        match target {
            Expr::Identifier { name, .. } => {
                self.scope_mut().set(name, value);
                Ok(())
            }
            _ => Err("complex assignment targets not yet supported".into()),
        }
    }
}

// ---- Operator helpers ----

fn apply_binary(op: &BinaryOp, l: &Value, r: &Value) -> Result<Value, String> {
    match op {
        BinaryOp::Add => match (l, r) {
            (Value::Number(a), Value::Number(b)) => Ok(Value::Number(a + b)),
            (Value::String(a), Value::String(b)) => Ok(Value::String(format!("{a}{b}"))),
            (Value::Number(a), Value::String(b)) => Ok(Value::String(format!("{a}{b}"))),
            (Value::String(a), Value::Number(b)) => Ok(Value::String(format!("{a}{b}"))),
            _ => Err("cannot add".into()),
        },
        BinaryOp::Subtract => n2n(l, r, |a, b| a - b),
        BinaryOp::Multiply => n2n(l, r, |a, b| a * b),
        BinaryOp::Divide => n2n(l, r, |a, b| a / b),
        BinaryOp::Modulo => n2n(l, r, |a, b| a % b),
        BinaryOp::Power => n2n(l, r, |a, b| a.powf(b)),
        BinaryOp::Equal => Ok(Value::Bool(l == r)),
        BinaryOp::NotEqual => Ok(Value::Bool(l != r)),
        BinaryOp::Less => c2v(l, r, std::cmp::Ordering::Less),
        BinaryOp::Greater => c2v(l, r, std::cmp::Ordering::Greater),
        BinaryOp::LessEqual => compare_values(l, r)
            .map(|o| Value::Bool(o != std::cmp::Ordering::Greater))
            .ok_or_else(|| "cannot compare".into()),
        BinaryOp::GreaterEqual => compare_values(l, r)
            .map(|o| Value::Bool(o != std::cmp::Ordering::Less))
            .ok_or_else(|| "cannot compare".into()),
    }
}

fn apply_comparison(op: &ComparisonOp, l: &Value, r: &Value) -> Result<bool, String> {
    match op {
        ComparisonOp::Equal => Ok(l == r),
        ComparisonOp::NotEqual => Ok(l != r),
        ComparisonOp::Less => compare_values(l, r)
            .map(|o| o == std::cmp::Ordering::Less)
            .ok_or_else(|| "cannot compare".into()),
        ComparisonOp::Greater => compare_values(l, r)
            .map(|o| o == std::cmp::Ordering::Greater)
            .ok_or_else(|| "cannot compare".into()),
        ComparisonOp::LessEqual => compare_values(l, r)
            .map(|o| o != std::cmp::Ordering::Greater)
            .ok_or_else(|| "cannot compare".into()),
        ComparisonOp::GreaterEqual => compare_values(l, r)
            .map(|o| o != std::cmp::Ordering::Less)
            .ok_or_else(|| "cannot compare".into()),
    }
}

fn n2n(l: &Value, r: &Value, f: fn(f64, f64) -> f64) -> Result<Value, String> {
    match (l, r) {
        (Value::Number(a), Value::Number(b)) => Ok(Value::Number(f(*a, *b))),
        _ => Err("arithmetic requires numbers".into()),
    }
}

fn c2v(l: &Value, r: &Value, target: std::cmp::Ordering) -> Result<Value, String> {
    compare_values(l, r)
        .map(|o| Value::Bool(o == target))
        .ok_or_else(|| "cannot compare".into())
}

fn compare_values(l: &Value, r: &Value) -> Option<std::cmp::Ordering> {
    match (l, r) {
        (Value::Number(a), Value::Number(b)) => a.partial_cmp(b),
        (Value::String(a), Value::String(b)) => Some(a.cmp(b)),
        _ => None,
    }
}

/// Trait for host-provided context.
pub trait Context {
    fn get(&self, name: &str) -> Option<Value>;
    /// Return None if the function is not a known native.
    fn call_native(&mut self, name: &str, args: &[Value]) -> Option<Value>;
}
