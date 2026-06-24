use std::collections::{BTreeMap, HashMap};
use std::rc::Rc;

use serde::{Deserialize, Serialize};

use crate::ast::*;
use crate::value::*;

// ── Public types ───────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ExecResult {
    Return(Option<Value>),
    Yield(Value),
}

/// Variable scope chain — serializable.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Scope {
    pub variables: HashMap<String, Value>,
    pub parent: Option<Box<Scope>>,
}

impl Scope {
    pub fn new() -> Self {
        Self {
            variables: HashMap::new(),
            parent: None,
        }
    }
    pub fn with_parent(parent: Scope) -> Self {
        Self {
            variables: HashMap::new(),
            parent: Some(Box::new(parent)),
        }
    }
    pub fn get(&self, name: &str) -> Option<&Value> {
        self.variables
            .get(name)
            .or_else(|| self.parent.as_ref().and_then(|p| p.get(name)))
    }
    pub fn set(&mut self, name: &str, value: Value) {
        if self.variables.contains_key(name) || self.parent.is_none() {
            self.variables.insert(name.to_string(), value);
        } else if let Some(ref mut parent) = self.parent {
            parent.set(name, value);
        }
    }
    pub fn define(&mut self, name: &str, value: Value) {
        self.variables.insert(name.to_string(), value);
    }
}

/// Loop scope — for for-in and do-while tracking.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LoopScope {
    ForIn {
        iterator: Vec<Value>,
        index: usize,
        variable: String,
    },
    DoWhile {
        occurrences: usize,
    },
}

/// Flow control signal (replaces string-based break/continue).
#[derive(Debug, Clone)]
pub enum Flow {
    Break,
    Continue,
}

// ── Stack frame & state machine ────────────────────────────────────

/// What to do when a stack frame completes (ip >= body.len()).
#[derive(Debug, Clone, Default)]
enum FrameComplete {
    #[default]
    Done,
    IfClause,
    ForLoop {
        variable: String,
        iterator: Vec<Value>,
        index: usize,
        body: Vec<Stmt>,
    },
    DoWhileBody {
        body: Vec<Stmt>,
        whiles: Vec<Expr>,
        wbodies: Vec<Vec<Stmt>>,
        occurrences: usize,
    },
    WhileClause {
        body: Vec<Stmt>,
        whiles: Vec<Expr>,
        wbodies: Vec<Vec<Stmt>>,
        occurrences: usize,
    },
}

/// One stack frame in the execution state machine.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StackFrame {
    pub scope: Scope,
    pub ip: usize,
    pub body: Vec<Stmt>,
    pub loop_scopes: Vec<LoopScope>,
    pub evaluated_cache: HashMap<usize, Value>,
    pub target_return: Option<usize>,
    pub expr_cache_index: usize,
    pub expr_cache_stack: Vec<usize>,
    #[serde(skip)]
    on_complete: FrameComplete,
}

impl StackFrame {
    fn new(body: Vec<Stmt>, scope: Scope) -> Self {
        Self {
            scope,
            ip: 0,
            body,
            loop_scopes: vec![],
            evaluated_cache: HashMap::new(),
            target_return: None,
            expr_cache_index: 0,
            expr_cache_stack: vec![],
            on_complete: FrameComplete::Done,
        }
    }
    fn with_on_complete(mut self, oc: FrameComplete) -> Self {
        self.on_complete = oc;
        self
    }
}

/// Plan scope (stub — fully implemented in Tier 2).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanScope {
    pub stack_depth: usize,
}

/// Serializable execution state for yield/resume.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionState {
    pub stack: Vec<StackFrame>,
    pub plan_scopes: Vec<PlanScope>,
}

#[derive(Debug, Clone)]
pub struct NpcScript {
    pub source: String,
    pub program: Program,
    pub functions: Vec<Vec<Stmt>>,
    pub name_to_index: HashMap<String, usize>,
}

impl NpcScript {
    pub fn parse(source: &str) -> Result<Self, String> {
        let program = crate::parse(source)?;
        let mut funcs = vec![];
        let mut n2i = HashMap::new();
        for stmt in &program.body {
            if let Stmt::Assignment { target, value, .. } = stmt {
                if let Expr::Identifier { name, .. } = target.as_ref() {
                    if let Expr::Function { ref body, .. } = **value {
                        let idx = funcs.len();
                        funcs.push(body.clone());
                        n2i.insert(name.clone(), idx);
                    }
                }
            }
        }
        Ok(Self {
            source: source.to_string(),
            program,
            functions: funcs,
            name_to_index: n2i,
        })
    }
    pub fn function_index(&self, name: &str) -> Option<usize> {
        self.name_to_index.get(name).copied()
    }
    pub fn function_body(&self, idx: usize) -> Option<&[Stmt]> {
        self.functions.get(idx).map(|v| v.as_slice())
    }
    pub fn function_params(&self, fi: usize) -> (Vec<String>, Vec<Option<Value>>) {
        for stmt in &self.program.body {
            if let Stmt::Assignment { target, value, .. } = stmt {
                if let Expr::Identifier { name, .. } = target.as_ref() {
                    if let Expr::Function { params, .. } = value.as_ref() {
                        if self.name_to_index.get(name) == Some(&fi) {
                            return (params.clone(), params.iter().map(|_| None).collect());
                        }
                    }
                }
            }
        }
        (vec![], vec![])
    }
}

#[derive(Debug)]
enum StepResult {
    Continue,
    Yield(Value),
    Return(Option<Value>),
    Break,
    Continue_,
    PushFrame(StackFrame, bool),
}

// ── Executor (IP-based state machine) ─────────────────────────────

pub struct Executor<'s> {
    script: &'s NpcScript,
    stack: Vec<StackFrame>,
    plan_scopes: Vec<PlanScope>,
}

impl<'s> Executor<'s> {
    pub fn new(script: &'s NpcScript) -> Self {
        Self {
            script,
            stack: vec![StackFrame::new(script.program.body.clone(), Scope::new())],
            plan_scopes: vec![],
        }
    }

    pub fn from_state(script: &'s NpcScript, state: &ExecutionState) -> Self {
        let mut stack = state.stack.clone();
        for frame in &mut stack {
            frame.on_complete = FrameComplete::Done;
        }
        Self {
            script,
            stack,
            plan_scopes: state.plan_scopes.clone(),
        }
    }

    pub fn state(&self) -> ExecutionState {
        ExecutionState {
            stack: self.stack.clone(),
            plan_scopes: self.plan_scopes.clone(),
        }
    }

    fn scope(&self) -> &Scope {
        &self.stack.last().unwrap().scope
    }
    fn scope_mut(&mut self) -> &mut Scope {
        &mut self.stack.last_mut().unwrap().scope
    }

    // ── Public API ────────────────────────────────────────────

    pub fn execute(&mut self, ctx: &mut dyn Context) -> Result<ExecResult, String> {
        loop {
            if self.stack.is_empty() {
                return Ok(ExecResult::Return(None));
            }
            let ip = self.stack.last().unwrap().ip;
            let body_len = self.stack.last().unwrap().body.len();
            if ip >= body_len {
                match self.handle_frame_complete(ctx)? {
                    Some(result) => return Ok(result),
                    None => continue,
                }
            }
            let stmt = self.stack.last().unwrap().body[ip].clone();
            {
                let frame = self.stack.last_mut().unwrap();
                frame.evaluated_cache.clear();
                frame.expr_cache_index = 0;
                frame.expr_cache_stack.clear();
            }
            match self.execute_step(&stmt, ctx)? {
                StepResult::Continue => {}
                StepResult::Yield(v) => {
                    if let Some(f) = self.stack.last_mut() {
                        f.ip += 1;
                    }
                    return Ok(ExecResult::Yield(v));
                }
                StepResult::Return(v) => {
                    if let Some(result) = self.propagate_return(v) {
                        return Ok(result);
                    }
                }
                StepResult::Break => {
                    self.propagate_break()?;
                }
                StepResult::Continue_ => {
                    self.propagate_continue()?;
                }
                StepResult::PushFrame(mut child, advance) => {
                    if advance {
                        self.stack.last_mut().unwrap().ip += 1;
                    }
                    // Note: loop_scopes stay on the parent frame (the one that initiated the loop).
                    // Child frames only inherit target_return for function calls.
                    child.target_return = self.stack.last().unwrap().target_return;
                    self.stack.push(child);
                }
            }
        }
    }

    // ── Frame completion handlers ─────────────────────────────

    fn handle_frame_complete(
        &mut self,
        ctx: &mut dyn Context,
    ) -> Result<Option<ExecResult>, String> {
        let frame = self.stack.pop().unwrap();
        match frame.on_complete {
            FrameComplete::Done => {
                if self.stack.is_empty() {
                    return Ok(Some(ExecResult::Return(None)));
                }
                Ok(None)
            }
            FrameComplete::IfClause { .. } => {
                // When any if-clause body completes, we're done with the if statement
                if let Some(p) = self.stack.last_mut() {
                    p.ip += 1;
                }
                Ok(None)
            }
            FrameComplete::ForLoop {
                variable,
                iterator,
                mut index,
                body,
            } => {
                index += 1;
                if index < iterator.len() {
                    let mut scope = self.scope().clone();
                    scope.define(&variable, iterator[index].clone());
                    let child = StackFrame::new(body.clone(), scope).with_on_complete(
                        FrameComplete::ForLoop {
                            variable,
                            iterator,
                            index,
                            body: body.clone(),
                        },
                    );
                    self.stack.push(child);
                } else {
                    // Parent IP was already advanced when the loop started
                    let _ = self.stack.last_mut().map(|p| p.loop_scopes.remove(0));
                }
                Ok(None)
            }
            FrameComplete::DoWhileBody {
                body,
                whiles,
                wbodies,
                occurrences,
            } => {
                // Merge child scope vars back into parent (do-while bodies share scope)
                merge_scope_up(&frame.scope, self.scope_mut());
                let occ = occurrences + 1;
                if occ > 1000 {
                    return Err("do-while exceeded 1000 iterations".into());
                }
                let mut again = whiles.is_empty();
                for (i, cond) in whiles.iter().enumerate() {
                    if self.evaluate(cond, ctx)?.is_truthy() {
                        if let Some(wb) = wbodies.get(i) {
                            let child = StackFrame::new(wb.clone(), self.scope().clone())
                                .with_on_complete(FrameComplete::WhileClause {
                                    body: body.clone(),
                                    whiles: whiles.clone(),
                                    wbodies: wbodies.clone(),
                                    occurrences: occ,
                                });
                            self.stack.push(child);
                            return Ok(None);
                        }
                        again = true;
                        break;
                    }
                }
                if again {
                    let child = StackFrame::new(body.clone(), self.scope().clone())
                        .with_on_complete(FrameComplete::DoWhileBody {
                            body,
                            whiles,
                            wbodies,
                            occurrences: occ,
                        });
                    self.stack.push(child);
                } else {
                    if let Some(p) = self.stack.last_mut() {
                        p.loop_scopes.remove(0);
                    }
                }
                Ok(None)
            }
            FrameComplete::WhileClause {
                body,
                whiles,
                wbodies,
                occurrences,
            } => {
                // Merge child scope vars back into parent
                merge_scope_up(&frame.scope, self.scope_mut());
                let mut again = whiles.is_empty();
                for (i, cond) in whiles.iter().enumerate() {
                    if self.evaluate(cond, ctx)?.is_truthy() {
                        if let Some(wb) = wbodies.get(i) {
                            let child = StackFrame::new(wb.clone(), self.scope().clone())
                                .with_on_complete(FrameComplete::WhileClause {
                                    body: body.clone(),
                                    whiles: whiles.clone(),
                                    wbodies: wbodies.clone(),
                                    occurrences,
                                });
                            self.stack.push(child);
                            return Ok(None);
                        }
                        again = true;
                        break;
                    }
                }
                if again {
                    let child = StackFrame::new(body.clone(), self.scope().clone())
                        .with_on_complete(FrameComplete::DoWhileBody {
                            body,
                            whiles,
                            wbodies,
                            occurrences,
                        });
                    self.stack.push(child);
                } else {
                    if let Some(p) = self.stack.last_mut() {
                        p.loop_scopes.remove(0);
                    }
                }
                Ok(None)
            }
        }
    }

    // ── Statement stepping ────────────────────────────────────

    fn execute_step(&mut self, stmt: &Stmt, ctx: &mut dyn Context) -> Result<StepResult, String> {
        match stmt {
            Stmt::Assignment { target, value, .. } => {
                let val = self.evaluate(value, ctx)?;
                self.assign_to(target, val)?;
                self.advance_ip();
                Ok(StepResult::Continue)
            }
            Stmt::Call { callee, args, .. } => {
                let name = match callee.as_ref() {
                    Expr::Identifier { name, .. } => name.clone(),
                    _ => return Err("stmt call needs name".into()),
                };
                let mut evaled = vec![];
                for a in args {
                    evaled.push(self.evaluate(a, ctx)?);
                }
                self.call_fn_step(&name, &evaled, ctx)
            }
            Stmt::If { clauses, .. } => {
                for (_i, clause) in clauses.iter().enumerate() {
                    let take = match &clause.condition {
                        Some(cond) => self.evaluate(cond, ctx)?.is_truthy(),
                        None => true,
                    };
                    if take {
                        let child = StackFrame::new(clause.body.clone(), self.scope().clone())
                            .with_on_complete(FrameComplete::IfClause);
                        return Ok(StepResult::PushFrame(child, true));
                    }
                }
                self.advance_ip();
                Ok(StepResult::Continue)
            }
            Stmt::For {
                variable,
                iterator,
                body,
                ..
            } => {
                let it = self.evaluate(iterator, ctx)?;
                let items: Vec<Value> = match &it {
                    Value::List(l) => l.clone(),
                    Value::Map(m) => m.keys().map(|k| Value::String(k.clone())).collect(),
                    _ => return Err(format!("cannot iterate over {it:?}")),
                };
                if items.is_empty() {
                    self.advance_ip();
                    return Ok(StepResult::Continue);
                }
                self.stack.last_mut().unwrap().loop_scopes.insert(
                    0,
                    LoopScope::ForIn {
                        iterator: items.clone(),
                        index: 0,
                        variable: variable.clone(),
                    },
                );
                let mut scope = self.scope().clone();
                scope.define(variable, items[0].clone());
                let child =
                    StackFrame::new(body.clone(), scope).with_on_complete(FrameComplete::ForLoop {
                        variable: variable.clone(),
                        iterator: items,
                        index: 0,
                        body: body.clone(),
                    });
                Ok(StepResult::PushFrame(child, true))
            }
            Stmt::DoWhile {
                body,
                while_clauses,
                while_bodies,
                ..
            } => {
                self.stack
                    .last_mut()
                    .unwrap()
                    .loop_scopes
                    .insert(0, LoopScope::DoWhile { occurrences: 1 });
                let child = StackFrame::new(body.clone(), self.scope().clone()).with_on_complete(
                    FrameComplete::DoWhileBody {
                        body: body.clone(),
                        whiles: while_clauses.clone(),
                        wbodies: while_bodies.clone(),
                        occurrences: 1,
                    },
                );
                Ok(StepResult::PushFrame(child, true))
            }
            Stmt::Return { value, .. } => {
                let val = value.as_ref().map(|v| self.evaluate(v, ctx)).transpose()?;
                Ok(StepResult::Return(val))
            }
            Stmt::Break { .. } => Ok(StepResult::Break),
            Stmt::Continue { .. } => Ok(StepResult::Continue_),
            Stmt::Expr(expr) => {
                let val = self.evaluate(expr, ctx)?;
                self.advance_ip();
                if matches!(&val, Value::Function(_)) {
                    Ok(StepResult::Yield(val))
                } else {
                    Ok(StepResult::Continue)
                }
            }
            Stmt::Plan { .. } => {
                self.advance_ip();
                Ok(StepResult::Continue)
            }
        }
    }

    // ── Flow control propagation ────────────────────────────

    fn propagate_return(&mut self, value: Option<Value>) -> Option<ExecResult> {
        loop {
            if self.stack.is_empty() {
                return Some(ExecResult::Return(value));
            }
            if self.stack.last().unwrap().target_return.is_some() {
                let frame = self.stack.pop().unwrap();
                if let Some(ci) = frame.target_return {
                    if let Some(p) = self.stack.last_mut() {
                        p.evaluated_cache
                            .insert(ci, value.clone().unwrap_or(Value::Nil));
                    }
                }
                if self.stack.is_empty() {
                    return Some(ExecResult::Return(value));
                }
                return None;
            }
            self.stack.pop();
        }
    }

    fn propagate_break(&mut self) -> Result<(), String> {
        loop {
            if self.stack.is_empty() {
                return Err("break outside of loop".into());
            }
            let has_loop = self
                .stack
                .last()
                .map(|f| !f.loop_scopes.is_empty())
                .unwrap_or(false);
            if has_loop {
                self.stack.last_mut().unwrap().loop_scopes.remove(0);
                return Ok(());
            }
            self.stack.pop();
        }
    }

    fn propagate_continue(&mut self) -> Result<(), String> {
        loop {
            let has_loop = self
                .stack
                .last()
                .map(|f| !f.loop_scopes.is_empty())
                .unwrap_or(false);
            if has_loop {
                let frame = self.stack.last_mut().unwrap();
                frame.evaluated_cache.clear();
                match frame.loop_scopes.first().cloned() {
                    Some(LoopScope::ForIn {
                        iterator,
                        index,
                        variable,
                    }) => {
                        let new_idx = index + 1;
                        if new_idx < iterator.len() {
                            let fc = frame.on_complete.clone();
                            if let FrameComplete::ForLoop { body, .. } = fc {
                                frame.loop_scopes[0] = LoopScope::ForIn {
                                    iterator: iterator.clone(),
                                    index: new_idx,
                                    variable: variable.clone(),
                                };
                                let mut scope = frame.scope.clone();
                                scope.define(&variable, iterator[new_idx].clone());
                                let child = StackFrame::new(body.clone(), scope).with_on_complete(
                                    FrameComplete::ForLoop {
                                        variable: variable.clone(),
                                        iterator: iterator.clone(),
                                        index: new_idx,
                                        body,
                                    },
                                );
                                let ls = frame.loop_scopes.clone();
                                self.stack.push(child);
                                self.stack.last_mut().unwrap().loop_scopes = ls;
                                return Ok(());
                            }
                        }
                        frame.loop_scopes.remove(0);
                        return Ok(());
                    }
                    Some(LoopScope::DoWhile { occurrences }) => {
                        let fc = frame.on_complete.clone();
                        let (body, whiles, wbodies) = match fc {
                            FrameComplete::DoWhileBody {
                                body,
                                whiles,
                                wbodies,
                                ..
                            } => (body, whiles, wbodies),
                            FrameComplete::WhileClause {
                                body,
                                whiles,
                                wbodies,
                                ..
                            } => (body, whiles, wbodies),
                            _ => return Err("continue: mismatched do-while state".into()),
                        };
                        let scope = frame.scope.clone();
                        let child = StackFrame::new(body, scope).with_on_complete(
                            FrameComplete::DoWhileBody {
                                body: vec![],
                                whiles,
                                wbodies,
                                occurrences,
                            },
                        );
                        let ls = vec![LoopScope::DoWhile { occurrences }];
                        self.stack.push(child);
                        self.stack.last_mut().unwrap().loop_scopes = ls;
                        return Ok(());
                    }
                    None => {
                        self.stack.pop();
                    }
                }
            } else {
                self.stack.pop();
            }
        }
    }

    // ── Helpers ───────────────────────────────────────────

    fn advance_ip(&mut self) {
        if let Some(f) = self.stack.last_mut() {
            f.ip += 1;
        }
    }

    fn call_fn_step(
        &mut self,
        name: &str,
        args: &[Value],
        ctx: &mut dyn Context,
    ) -> Result<StepResult, String> {
        if let Some(result) = ctx.call_native(name, args) {
            self.advance_ip();
            return if matches!(result, Value::Nil) {
                Ok(StepResult::Continue)
            } else {
                Ok(StepResult::Yield(result))
            };
        }
        let fi = self
            .script
            .function_index(name)
            .ok_or_else(|| format!("function '{name}' not found"))?;
        let (params, _) = self.script.function_params(fi);
        let mut scope = Scope::new();
        for (i, p) in params.iter().enumerate() {
            scope.define(p, args.get(i).cloned().unwrap_or(Value::Nil));
        }
        let body = self.script.function_body(fi).unwrap_or(&[]).to_vec();
        let cache_idx = {
            let f = self.stack.last_mut().unwrap();
            let ci = f.expr_cache_index;
            f.expr_cache_index += 1;
            ci
        };
        let mut child = StackFrame::new(body, scope);
        child.target_return = Some(cache_idx);
        // Don't inherit loop_scopes — loop scopes are owned by the frame that started the loop
        self.advance_ip();
        Ok(StepResult::PushFrame(child, false))
    }

    // ── Expression evaluation ───────────────────────────────

    fn evaluate(&mut self, expr: &Expr, ctx: &mut dyn Context) -> Result<Value, String> {
        let (ci, cd) = {
            let frame = self.stack.last_mut().unwrap();
            let ci = frame.expr_cache_index;
            frame.expr_cache_index += 1;
            let cd = frame.expr_cache_stack.len();
            frame.expr_cache_stack.push(ci);
            (ci, cd)
        };
        {
            let frame = self.stack.last().unwrap();
            if let Some(cached) = frame.evaluated_cache.get(&ci).cloned() {
                self.clear_above(cd);
                return Ok(cached);
            }
        }
        let v = self.eval_inner(expr, ctx)?;
        self.clear_above(cd);
        self.stack
            .last_mut()
            .unwrap()
            .evaluated_cache
            .insert(ci, v.clone());
        Ok(v)
    }

    fn eval_inner(&mut self, expr: &Expr, ctx: &mut dyn Context) -> Result<Value, String> {
        match expr {
            Expr::Number { value, .. } => Ok(Value::Number(*value)),
            Expr::String { value, .. } => Ok(Value::String(value.clone())),
            Expr::Boolean { value, .. } => Ok(Value::Bool(*value)),
            Expr::Nil { .. } => Ok(Value::Nil),
            Expr::Identifier { name, .. } => {
                for ls in &self.stack.last().unwrap().loop_scopes {
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
                    .ok_or_else(|| format!("var '{name}' not found"))
            }
            Expr::Unary { op, argument, .. } => {
                let a = self.evaluate(argument, ctx)?;
                match op {
                    UnaryOp::Negate => match a {
                        Value::Number(n) => Ok(Value::Number(-n)),
                        _ => Err("negate needs number".into()),
                    },
                    UnaryOp::Not => Ok(Value::Bool(!a.is_truthy())),
                    UnaryOp::Plus => Ok(a),
                    UnaryOp::New => match &a {
                        Value::Map(m) => Ok(Value::Map(m.clone())),
                        _ => Err("new expects map".into()),
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
                    _ => return Err("call needs name".into()),
                };
                let mut ea = vec![];
                for a in args {
                    ea.push(self.evaluate(a, ctx)?);
                }
                if let Some(r) = ctx.call_native(&name, &ea) {
                    return Ok(r);
                }
                let fi = self
                    .script
                    .function_index(&name)
                    .ok_or_else(|| format!("fn '{name}' not found"))?;
                let (params, _) = self.script.function_params(fi);
                let mut scope = Scope::new();
                for (i, p) in params.iter().enumerate() {
                    scope.define(p, ea.get(i).cloned().unwrap_or(Value::Nil));
                }
                let body = self.script.function_body(fi).unwrap_or(&[]).to_vec();
                let saved_loops = self.stack.last().unwrap().loop_scopes.clone();
                let cache_idx = {
                    let f = self.stack.last_mut().unwrap();
                    let ci = f.expr_cache_index;
                    f.expr_cache_index += 1;
                    ci
                };
                self.stack.push(StackFrame::new(body.clone(), scope));
                let n = self.stack.len();
                self.stack[n - 1].loop_scopes = saved_loops;
                self.stack[n - 1].target_return = Some(cache_idx);
                let result = self.execute_inline(ctx)?;
                match result {
                    ExecResult::Return(v) => Ok(v.unwrap_or(Value::Nil)),
                    ExecResult::Yield(v) => Ok(v),
                }
            }
            Expr::Function { params, body, .. } => {
                let idx = self
                    .script
                    .functions
                    .iter()
                    .position(|b| b.as_slice() == body.as_slice())
                    .unwrap_or(0);
                Ok(Value::Function(FunctionDef {
                    index: idx,
                    params: params.clone(),
                    param_defaults: vec![],
                    body: Rc::new(body.clone()),
                }))
            }
            Expr::Map { fields, .. } => {
                let mut m = BTreeMap::new();
                for (k, v) in fields {
                    m.insert(k.clone(), self.evaluate(v, ctx)?);
                }
                Ok(Value::Map(m))
            }
            Expr::List { items, .. } => {
                let mut l = vec![];
                for i in items {
                    l.push(self.evaluate(i, ctx)?);
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
                let v = self.evaluate(left, ctx)?;
                let tn = match right.as_ref() {
                    Expr::Identifier { name, .. } => name,
                    _ => return Err("isa needs name".into()),
                };
                Ok(Value::Bool(match tn.as_str() {
                    "number" => matches!(v, Value::Number(_)),
                    "string" => matches!(v, Value::String(_)),
                    "boolean" => matches!(v, Value::Bool(_)),
                    "list" => matches!(v, Value::List(_)),
                    "map" => matches!(v, Value::Map(_)),
                    "function" => matches!(v, Value::Function(_) | Value::NativeFunction(_)),
                    _ => return Err(format!("unknown isa: {tn}")),
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
                    _ => return Err("slice needs string/list".into()),
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
                        _ => Err("slice idx must be number".into()),
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

    /// Execute frames inline (for expression-call within evaluate).
    fn execute_inline(&mut self, ctx: &mut dyn Context) -> Result<ExecResult, String> {
        loop {
            if self.stack.is_empty() {
                return Ok(ExecResult::Return(None));
            }
            let ip = self.stack.last().unwrap().ip;
            let body_len = self.stack.last().unwrap().body.len();
            if ip >= body_len {
                let frame = self.stack.pop().unwrap();
                if frame.target_return.is_some() || self.stack.is_empty() {
                    return Ok(ExecResult::Return(None));
                }
                match frame.on_complete {
                    FrameComplete::Done => {
                        if self.stack.is_empty() {
                            return Ok(ExecResult::Return(None));
                        }
                    }
                    FrameComplete::IfClause { .. } => {
                        if let Some(p) = self.stack.last_mut() {
                            p.ip += 1;
                        }
                    }
                    FrameComplete::ForLoop {
                        variable,
                        iterator,
                        mut index,
                        body,
                    } => {
                        index += 1;
                        if index < iterator.len() {
                            let mut scope = self.scope().clone();
                            scope.define(&variable, iterator[index].clone());
                            self.stack
                                .push(StackFrame::new(body.clone(), scope).with_on_complete(
                                    FrameComplete::ForLoop {
                                        variable,
                                        iterator,
                                        index,
                                        body,
                                    },
                                ));
                        } else {
                            if let Some(p) = self.stack.last_mut() {
                                p.loop_scopes.remove(0);
                            }
                        }
                    }
                    FrameComplete::DoWhileBody {
                        body,
                        whiles,
                        wbodies,
                        occurrences,
                    } => {
                        merge_scope_up(&frame.scope, self.scope_mut());
                        let occ = occurrences + 1;
                        if occ > 1000 {
                            return Err("do-while exceeded 1000 iterations".into());
                        }
                        let mut again = whiles.is_empty();
                        for (i, cond) in whiles.iter().enumerate() {
                            if self.evaluate(cond, ctx)?.is_truthy() {
                                if let Some(wb) = wbodies.get(i) {
                                    self.stack.push(
                                        StackFrame::new(wb.clone(), self.scope().clone())
                                            .with_on_complete(FrameComplete::WhileClause {
                                                body: body.clone(),
                                                whiles: whiles.clone(),
                                                wbodies: wbodies.clone(),
                                                occurrences: occ,
                                            }),
                                    );
                                    again = false;
                                    break;
                                }
                                again = true;
                                break;
                            }
                        }
                        if again {
                            self.stack.push(
                                StackFrame::new(body.clone(), self.scope().clone())
                                    .with_on_complete(FrameComplete::DoWhileBody {
                                        body,
                                        whiles,
                                        wbodies,
                                        occurrences: occ,
                                    }),
                            );
                        } else {
                            if let Some(p) = self.stack.last_mut() {
                                p.loop_scopes.remove(0);
                            }
                        }
                    }
                    FrameComplete::WhileClause {
                        body,
                        whiles,
                        wbodies,
                        occurrences,
                    } => {
                        merge_scope_up(&frame.scope, self.scope_mut());
                        let mut again = whiles.is_empty();
                        for (i, cond) in whiles.iter().enumerate() {
                            if self.evaluate(cond, ctx)?.is_truthy() {
                                if let Some(wb) = wbodies.get(i) {
                                    self.stack.push(
                                        StackFrame::new(wb.clone(), self.scope().clone())
                                            .with_on_complete(FrameComplete::WhileClause {
                                                body: body.clone(),
                                                whiles: whiles.clone(),
                                                wbodies: wbodies.clone(),
                                                occurrences,
                                            }),
                                    );
                                    again = false;
                                    break;
                                }
                                again = true;
                                break;
                            }
                        }
                        if again {
                            self.stack.push(
                                StackFrame::new(body.clone(), self.scope().clone())
                                    .with_on_complete(FrameComplete::DoWhileBody {
                                        body,
                                        whiles,
                                        wbodies,
                                        occurrences,
                                    }),
                            );
                        } else {
                            if let Some(p) = self.stack.last_mut() {
                                p.loop_scopes.remove(0);
                            }
                        }
                    }
                }
                continue;
            }
            let stmt = self.stack.last().unwrap().body[ip].clone();
            {
                let frame = self.stack.last_mut().unwrap();
                frame.evaluated_cache.clear();
                frame.expr_cache_index = 0;
                frame.expr_cache_stack.clear();
            }
            match self.execute_step(&stmt, ctx)? {
                StepResult::Continue => {}
                StepResult::Yield(v) => {
                    if let Some(f) = self.stack.last_mut() {
                        f.ip += 1;
                    }
                    return Ok(ExecResult::Yield(v));
                }
                StepResult::Return(v) => {
                    // Walk up until we find a frame with target_return (function boundary)
                    let ret_val = v;
                    loop {
                        if self.stack.is_empty() {
                            return Ok(ExecResult::Return(ret_val));
                        }
                        if self.stack.last().unwrap().target_return.is_some() {
                            let frame = self.stack.pop().unwrap();
                            if let Some(ci) = frame.target_return {
                                if let Some(p) = self.stack.last_mut() {
                                    p.evaluated_cache
                                        .insert(ci, ret_val.clone().unwrap_or(Value::Nil));
                                }
                            }
                            // Restored value to parent cache — return the value to caller
                            return Ok(ExecResult::Return(ret_val));
                        }
                        self.stack.pop();
                    }
                }
                StepResult::Break => loop {
                    if self.stack.is_empty() {
                        return Err("break outside of loop".into());
                    }
                    let has_loop = self
                        .stack
                        .last()
                        .map(|f| !f.loop_scopes.is_empty())
                        .unwrap_or(false);
                    if has_loop {
                        self.stack.last_mut().unwrap().loop_scopes.remove(0);
                        break;
                    }
                    self.stack.pop();
                },
                StepResult::Continue_ => loop {
                    let has_loop = self
                        .stack
                        .last()
                        .map(|f| !f.loop_scopes.is_empty())
                        .unwrap_or(false);
                    if has_loop {
                        let frame = self.stack.last_mut().unwrap();
                        frame.evaluated_cache.clear();
                        match frame.loop_scopes.first().cloned() {
                            Some(LoopScope::ForIn {
                                iterator,
                                index,
                                variable,
                            }) => {
                                let new_idx = index + 1;
                                if new_idx < iterator.len() {
                                    let fc = frame.on_complete.clone();
                                    if let FrameComplete::ForLoop { body, .. } = fc {
                                        frame.loop_scopes[0] = LoopScope::ForIn {
                                            iterator: iterator.clone(),
                                            index: new_idx,
                                            variable: variable.clone(),
                                        };
                                        let mut scope = frame.scope.clone();
                                        scope.define(&variable, iterator[new_idx].clone());
                                        self.stack.push(
                                            StackFrame::new(body.clone(), scope).with_on_complete(
                                                FrameComplete::ForLoop {
                                                    variable: variable.clone(),
                                                    iterator: iterator.clone(),
                                                    index: new_idx,
                                                    body,
                                                },
                                            ),
                                        );
                                        break;
                                    }
                                }
                                frame.loop_scopes.remove(0);
                                break;
                            }
                            Some(LoopScope::DoWhile { occurrences }) => {
                                let fc = frame.on_complete.clone();
                                let scope = frame.scope.clone();
                                match fc {
                                    FrameComplete::DoWhileBody {
                                        body,
                                        whiles,
                                        wbodies,
                                        ..
                                    } => {
                                        self.stack.push(
                                            StackFrame::new(body, scope).with_on_complete(
                                                FrameComplete::DoWhileBody {
                                                    body: vec![],
                                                    whiles,
                                                    wbodies,
                                                    occurrences,
                                                },
                                            ),
                                        );
                                    }
                                    FrameComplete::WhileClause {
                                        body,
                                        whiles,
                                        wbodies,
                                        ..
                                    } => {
                                        self.stack.push(
                                            StackFrame::new(body, scope).with_on_complete(
                                                FrameComplete::DoWhileBody {
                                                    body: vec![],
                                                    whiles,
                                                    wbodies,
                                                    occurrences,
                                                },
                                            ),
                                        );
                                    }
                                    _ => {
                                        frame.loop_scopes.remove(0);
                                    }
                                }
                                break;
                            }
                            None => {
                                self.stack.pop();
                            }
                        }
                    } else {
                        self.stack.pop();
                    }
                },
                StepResult::PushFrame(mut child, advance) => {
                    if advance {
                        self.stack.last_mut().unwrap().ip += 1;
                    }
                    child.target_return = self.stack.last().unwrap().target_return;
                    self.stack.push(child);
                }
            }
        }
    }

    fn clear_above(&mut self, depth: usize) {
        let frame = self.stack.last_mut().unwrap();
        let rm: Vec<usize> = frame.expr_cache_stack.drain(depth + 1..).collect();
        for i in rm {
            frame.evaluated_cache.remove(&i);
        }
    }

    fn assign_to(&mut self, target: &Expr, value: Value) -> Result<(), String> {
        match target {
            Expr::Identifier { name, .. } => {
                self.scope_mut().set(name, value);
                Ok(())
            }
            _ => Err("complex assignment not yet supported".into()),
        }
    }
}

/// Merge variables from a child scope into a parent scope (used for do-while body scopes).
fn merge_scope_up(child: &Scope, parent: &mut Scope) {
    for (k, v) in &child.variables {
        parent.set(k, v.clone());
    }
}

// ── Operator helpers ──────────────────────────────────────────────

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
        _ => Err("needs numbers".into()),
    }
}
fn c2v(l: &Value, r: &Value, t: std::cmp::Ordering) -> Result<Value, String> {
    compare_values(l, r)
        .map(|o| Value::Bool(o == t))
        .ok_or_else(|| "cannot compare".into())
}
fn compare_values(l: &Value, r: &Value) -> Option<std::cmp::Ordering> {
    match (l, r) {
        (Value::Number(a), Value::Number(b)) => a.partial_cmp(b),
        (Value::String(a), Value::String(b)) => Some(a.cmp(b)),
        _ => None,
    }
}

// ── Context trait ─────────────────────────────────────────────────

pub trait Context {
    fn get(&self, name: &str) -> Option<Value>;
    fn call_native(&mut self, name: &str, args: &[Value]) -> Option<Value>;
}
