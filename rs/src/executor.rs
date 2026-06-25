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
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub enum FrameComplete {
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
    PlanBody {
        plan_value: Value,
        checkings: Vec<crate::ast::PlanChecking>,
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
    pub on_complete: FrameComplete,
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

/// Plan scope — tracks an active plan for cancellation and resume checking.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanScope {
    pub plan_value: Value,
    /// stack.len() at the moment the plan body was entered (not including body frame)
    pub stack_depth: usize,
    /// parent frame's IP *after* advancing past the plan statement
    pub saved_parent_ip: usize,
    /// checking conditions for resume-time re-evaluation
    pub checkings: Vec<crate::ast::PlanChecking>,
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
    pub fn function_params(&self, fi: usize) -> (Vec<String>, Vec<Option<Expr>>) {
        for stmt in &self.program.body {
            if let Stmt::Assignment { target, value, .. } = stmt {
                if let Expr::Identifier { name, .. } = target.as_ref() {
                    if let Expr::Function {
                        params,
                        param_defaults,
                        ..
                    } = value.as_ref()
                    {
                        if self.name_to_index.get(name) == Some(&fi) {
                            return (params.clone(), param_defaults.clone());
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
        let stack = state.stack.clone();
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

    /// Cancel all plans whose stack_depth is >= `min_depth`.
    /// Calls cancel/finally callbacks and removes plan scopes.
    fn cancel_plans_at_depth(
        &mut self,
        ctx: &mut dyn Context,
        min_depth: usize,
        reason: Option<&str>,
    ) {
        while let Some(ps) = self.plan_scopes.last() {
            if ps.stack_depth < min_depth {
                break;
            }
            let pv = ps.plan_value.clone();
            ctx.plan_cancel(&pv, reason);
            ctx.plan_finally(&pv);
            self.plan_scopes.pop();
        }
    }

    /// Cancel any plan whose stack_depth refers to a frame that has been popped.
    fn cancel_plans_below_current_stack(&mut self, ctx: &mut dyn Context, reason: Option<&str>) {
        let cur_depth = self.stack.len();
        self.cancel_plans_at_depth(ctx, cur_depth, reason);
    }

    /// Re-evaluate all active plan checking conditions on resume.
    /// If any fail, cancel that plan (and sub-plans), restoring to after the plan block.
    fn recheck_plans(&mut self, ctx: &mut dyn Context) -> Result<(), String> {
        // Check from oldest to newest
        let mut i = 0;
        while i < self.plan_scopes.len() {
            // Clone checkings to avoid borrow conflict with self.evaluate
            let checkings = self.plan_scopes[i].checkings.clone();
            let mut fail = false;
            for checking in &checkings {
                if !self.evaluate(&checking.condition, ctx)?.is_truthy() {
                    fail = true;
                    break;
                }
            }
            if fail {
                let target_depth = self.plan_scopes[i].stack_depth;
                let saved_ip = self.plan_scopes[i].saved_parent_ip;
                self.cancel_plans_at_depth(ctx, target_depth, Some("checking_failed_on_resume"));
                self.stack.truncate(target_depth);
                if let Some(parent) = self.stack.last_mut() {
                    parent.ip = saved_ip;
                }
                // Restart: after cancellation, plan list changed, recheck remaining
                i = 0;
            } else {
                i += 1;
            }
        }
        Ok(())
    }

    // ── Public API ────────────────────────────────────────────

    /// Cancel a specific plan (and all sub-plans), restoring execution
    /// to just after the plan block. Returns new state, or None if script is done.
    pub fn cancel(
        &mut self,
        ctx: &mut dyn Context,
        plan_value: &Value,
        reason: Option<&str>,
    ) -> Option<ExecutionState> {
        let idx = self
            .plan_scopes
            .iter()
            .rposition(|p| &p.plan_value == plan_value);
        if let Some(i) = idx {
            let target_depth = self.plan_scopes[i].stack_depth;
            let saved_ip = self.plan_scopes[i].saved_parent_ip;
            // Cancel target plan and all sub-plans above it
            self.cancel_plans_at_depth(ctx, target_depth, reason);
            // Restore stack to the parent frame at saved IP
            self.stack.truncate(target_depth);
            if let Some(parent) = self.stack.last_mut() {
                parent.ip = saved_ip;
            }
            Some(self.state())
        } else {
            // Plan not found — cancel all plans
            self.cancel_plans_at_depth(ctx, 0, reason);
            self.stack.clear();
            None
        }
    }

    pub fn execute(&mut self, ctx: &mut dyn Context) -> Result<ExecResult, String> {
        // Resume-time checking: re-evaluate all active plan checking conditions.
        // If any fail, cancel that plan (and sub-plans), restoring to after the plan block.
        self.recheck_plans(ctx)?;

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
                    // execute_step already advanced IP.
                    return Ok(ExecResult::Yield(v));
                }
                StepResult::Return(v) => {
                    if let Some(result) = self.propagate_return(v, ctx) {
                        return Ok(result);
                    }
                }
                StepResult::Break => {
                    self.propagate_break(ctx)?;
                }
                StepResult::Continue_ => {
                    self.propagate_continue(ctx)?;
                }
                StepResult::PushFrame(mut child, advance) => {
                    if advance {
                        self.stack.last_mut().unwrap().ip += 1;
                    }
                    // Note: loop_scopes stay on the parent frame (the one that initiated the loop).
                    // Only inherit target_return for "transparent" frames (Done).
                    // Control-structure frames (PlanBody, IfClause, ForLoop, etc.) must NOT
                    // capture the parent's return target, or the inline Return handler will
                    // stop at the wrong frame and leak frames onto the main stack.
                    if matches!(child.on_complete, FrameComplete::Done) {
                        child.target_return = self.stack.last().unwrap().target_return;
                    }
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
                // On resume, on_complete is reset to Done. Check if a PlanScope
                // matches the current stack depth — if so, treat as PlanBody completion.
                if let Some(ps) = self.plan_scopes.last() {
                    if ps.stack_depth == self.stack.len() {
                        let plan_value = ps.plan_value.clone();
                        self.plan_scopes.pop();
                        ctx.plan_conclude(&plan_value);
                        ctx.plan_finally(&plan_value);
                        return Ok(None);
                    }
                }
                if self.stack.is_empty() {
                    return Ok(Some(ExecResult::Return(None)));
                }
                Ok(None)
            }
            FrameComplete::PlanBody { plan_value, .. } => {
                self.plan_scopes.pop();
                ctx.plan_conclude(&plan_value);
                ctx.plan_finally(&plan_value);
                Ok(None)
            }
            FrameComplete::IfClause { .. } => {
                // PushFrame(true) already advanced parent IP past the if statement.
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
                self.assign_to(target, val, ctx)?;
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
            Stmt::Plan {
                plan_value,
                checkings,
                body,
                ..
            } => {
                let pv = self.evaluate(plan_value, ctx)?;
                // Evaluate all checking conditions (conjunctive)
                for checking in checkings {
                    if !self.evaluate(&checking.condition, ctx)?.is_truthy() {
                        // Checking failed — skip the plan entirely
                        self.advance_ip();
                        return Ok(StepResult::Continue);
                    }
                }
                // All checks passed — enter the plan
                ctx.plan_begin(&pv);
                let plan_scope = PlanScope {
                    plan_value: pv,
                    stack_depth: self.stack.len(),
                    saved_parent_ip: self.stack.last().unwrap().ip + 1,
                    checkings: checkings.clone(),
                };
                self.plan_scopes.push(plan_scope);
                let child = StackFrame::new(body.clone(), self.scope().clone()).with_on_complete(
                    FrameComplete::PlanBody {
                        plan_value: self.plan_scopes.last().unwrap().plan_value.clone(),
                        checkings: checkings.clone(),
                    },
                );
                Ok(StepResult::PushFrame(child, true))
            }
        }
    }

    // ── Flow control propagation ────────────────────────────

    fn propagate_return(
        &mut self,
        value: Option<Value>,
        ctx: &mut dyn Context,
    ) -> Option<ExecResult> {
        loop {
            if self.stack.is_empty() {
                return Some(ExecResult::Return(value));
            }
            if self.stack.last().unwrap().target_return.is_some() {
                let frame = self.stack.pop().unwrap();
                // Cancel plans whose body frames were inside this popped subtree.
                self.cancel_plans_below_current_stack(ctx, Some("return"));
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
            self.cancel_plans_below_current_stack(ctx, Some("return"));
        }
    }

    fn propagate_break(&mut self, ctx: &mut dyn Context) -> Result<(), String> {
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
            self.cancel_plans_below_current_stack(ctx, Some("break"));
        }
    }

    fn propagate_continue(&mut self, ctx: &mut dyn Context) -> Result<(), String> {
        // When a do-while/while child frame is popped, capture its on_complete
        // so we can reconstruct the loop body on re-entry.
        let mut captured_fc: Option<FrameComplete> = None;
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
                            // The on_complete with ForLoop state lives on the child
                            // frame that was just popped; use the captured value.
                            let fc = captured_fc.as_ref().unwrap_or(&frame.on_complete).clone();
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
                                self.stack.push(child);
                                return Ok(());
                            }
                        }
                        frame.loop_scopes.remove(0);
                        return Ok(());
                    }
                    Some(LoopScope::DoWhile { occurrences }) => {
                        // The on_complete with loop state lives on the child frame
                        // that was just popped; use the captured value.
                        let fc = captured_fc.as_ref().unwrap_or(&frame.on_complete).clone();
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
                        let child = StackFrame::new(body.clone(), scope).with_on_complete(
                            FrameComplete::DoWhileBody {
                                body,
                                whiles,
                                wbodies,
                                occurrences,
                            },
                        );
                        self.stack.push(child);
                        return Ok(());
                    }
                    None => {
                        self.stack.pop();
                        self.cancel_plans_below_current_stack(ctx, Some("continue"));
                    }
                }
            } else {
                let popped = self.stack.pop().unwrap();
                // Merge scope for do-while body frames so the re-entered
                // child doesn't start with stale variable values.
                match &popped.on_complete {
                    FrameComplete::DoWhileBody { .. } | FrameComplete::WhileClause { .. } => {
                        merge_scope_up(&popped.scope, self.scope_mut());
                    }
                    _ => {}
                }
                captured_fc = Some(popped.on_complete);
                self.cancel_plans_below_current_stack(ctx, Some("continue"));
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
        let (params, defaults) = self.script.function_params(fi);
        let mut scope = Scope::new();
        for (i, p) in params.iter().enumerate() {
            let val = if let Some(arg) = args.get(i) {
                arg.clone()
            } else if let Some(Some(ref default_expr)) = defaults.get(i) {
                self.evaluate(default_expr, ctx)?
            } else {
                Value::Nil
            };
            scope.define(p, val);
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
                let (params, defaults) = self.script.function_params(fi);
                let mut scope = Scope::new();
                for (i, p) in params.iter().enumerate() {
                    let val = if let Some(arg) = ea.get(i) {
                        arg.clone()
                    } else if let Some(Some(ref default_expr)) = defaults.get(i) {
                        self.evaluate(default_expr, ctx)?
                    } else {
                        Value::Nil
                    };
                    scope.define(p, val);
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
                // Check host-provided isa registry first, then fall back to built-in
                if let Some(result) = ctx.isa_check(tn, &v) {
                    return Ok(Value::Bool(result));
                }
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
    /// Shares frame completion and flow control with the main execute() loop.
    /// Differs only in termination: after propagate_return crosses a function
    /// boundary, we return to the expression evaluator rather than continuing.
    fn execute_inline(&mut self, ctx: &mut dyn Context) -> Result<ExecResult, String> {
        loop {
            if self.stack.is_empty() {
                return Ok(ExecResult::Return(None));
            }
            let ip = self.stack.last().unwrap().ip;
            let body_len = self.stack.last().unwrap().body.len();
            if ip >= body_len {
                // Check before handle_frame_complete pops the frame.
                let is_fn_boundary = self.stack.last().unwrap().target_return.is_some();
                if let Some(result) = self.handle_frame_complete(ctx)? {
                    return Ok(result);
                }
                if is_fn_boundary {
                    return Ok(ExecResult::Return(None));
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
                    return Ok(ExecResult::Yield(v));
                }
                StepResult::Return(v) => {
                    // propagate_return walks up to the function boundary,
                    // pops frames, cancels plans, and writes the value
                    // into the parent frame's cache.
                    // We capture the value first — the inline caller
                    // (eval_inner) reads it from the ExecResult payload.
                    let ret_val = v.clone().unwrap_or(Value::Nil);
                    if let Some(result) = self.propagate_return(v, ctx) {
                        return Ok(result);
                    }
                    return Ok(ExecResult::Return(Some(ret_val)));
                }
                StepResult::Break => {
                    self.propagate_break(ctx)?;
                }
                StepResult::Continue_ => {
                    self.propagate_continue(ctx)?;
                }
                StepResult::PushFrame(mut child, advance) => {
                    if advance {
                        self.stack.last_mut().unwrap().ip += 1;
                    }
                    // Only inherit target_return for "transparent" frames (Done).
                    // Control-structure frames must not capture the parent's return target.
                    if matches!(child.on_complete, FrameComplete::Done) {
                        child.target_return = self.stack.last().unwrap().target_return;
                    }
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

    fn assign_to(
        &mut self,
        target: &Expr,
        value: Value,
        ctx: &mut dyn Context,
    ) -> Result<(), String> {
        match target {
            Expr::Identifier { name, .. } => {
                self.scope_mut().set(name, value);
                Ok(())
            }
            Expr::Member {
                object, property, ..
            } => {
                let obj = self.evaluate_mut(object, value.clone(), property, None, ctx)?;
                let _ = obj;
                Ok(())
            }
            Expr::Index { object, index, .. } => {
                let idx_val = self.evaluate(index, ctx)?;
                let obj = self.evaluate_mut(object, value.clone(), "", Some(&idx_val), ctx)?;
                let _ = obj;
                Ok(())
            }
            _ => Err("complex assignment not yet supported".into()),
        }
    }

    /// Evaluate the object of a member/index expression and mutate it for LValue assignment.
    /// Each level of a member chain (a.b.c = val) processes one hop:
    /// read inner object, mutate its property, then write back via assign_to.
    fn evaluate_mut(
        &mut self,
        object: &Expr,
        value: Value,
        property: &str,
        index: Option<&Value>,
        ctx: &mut dyn Context,
    ) -> Result<Value, String> {
        match object {
            Expr::Identifier { name, .. } => {
                // Leaf: read the variable, apply mutation, write back.
                let obj = self.scope().get(name).cloned().unwrap_or(Value::Nil);
                let modified = apply_lvalue_mutation(&obj, property, index, value)?;
                self.scope_mut().set(name, modified);
                Ok(Value::Nil)
            }
            Expr::Member {
                object: inner,
                property: inner_prop,
                ..
            } => {
                // Read the inner object (e.g. person for person.address.city)
                let inner_val = self.evaluate(inner, ctx)?;
                // Get the sub-object at inner_prop (e.g. person.address)
                let sub = get_prop(&inner_val, inner_prop)?;
                // Apply the outer mutation to this sub-object
                let modified_sub = apply_lvalue_mutation(&sub, property, index, value)?;
                // Set the modified sub back on a clone of inner_val
                let modified_inner = set_prop(&inner_val, inner_prop, modified_sub)?;
                // Write the modified container back to wherever inner points
                self.assign_to(inner, modified_inner, ctx)?;
                Ok(Value::Nil)
            }
            _ => Err("complex assignment target not yet supported".into()),
        }
    }
}

/// Merge variables from a child scope into a parent scope (used for do-while body scopes).
fn merge_scope_up(child: &Scope, parent: &mut Scope) {
    for (k, v) in &child.variables {
        parent.set(k, v.clone());
    }
}

/// Apply a property or index mutation to a Value clone.
fn apply_lvalue_mutation(
    obj: &Value,
    property: &str,
    index: Option<&Value>,
    value: Value,
) -> Result<Value, String> {
    match (obj, index) {
        (Value::Map(m), None) => {
            let mut mc = m.clone();
            mc.insert(property.to_string(), value);
            Ok(Value::Map(mc))
        }
        (Value::Map(m), Some(Value::String(s))) => {
            let mut mc = m.clone();
            mc.insert(s.clone(), value);
            Ok(Value::Map(mc))
        }
        (Value::List(l), Some(Value::Number(n))) => {
            let mut lc = l.clone();
            let i = *n as usize;
            if i < lc.len() {
                lc[i] = value;
            } else {
                lc.resize(i + 1, Value::Nil);
                lc[i] = value;
            }
            Ok(Value::List(lc))
        }
        _ => Err(format!("cannot assign to {obj:?}[{index:?}]")),
    }
}

/// Get a named property from a Value.
fn get_prop(val: &Value, prop: &str) -> Result<Value, String> {
    match val {
        Value::Map(m) => Ok(m.get(prop).cloned().unwrap_or(Value::Nil)),
        _ => Err(format!("cannot access property '{prop}' on {val:?}")),
    }
}

/// Set a named property on a Value clone, returning the modified Value.
fn set_prop(val: &Value, prop: &str, new_val: Value) -> Result<Value, String> {
    match val {
        Value::Map(m) => {
            let mut mc = m.clone();
            mc.insert(prop.to_string(), new_val);
            Ok(Value::Map(mc))
        }
        _ => Err(format!("cannot set property '{prop}' on {val:?}")),
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
    fn plan_begin(&mut self, _plan_value: &Value) {}
    fn plan_conclude(&mut self, _plan_value: &Value) {}
    fn plan_cancel(&mut self, _plan_value: &Value, _reason: Option<&str>) {}
    fn plan_finally(&mut self, _plan_value: &Value) {}
    /// Host-provided isa type check. Return `None` to fall back to built-in types.
    fn isa_check(&self, _type_name: &str, _value: &Value) -> Option<bool> {
        None
    }
}
