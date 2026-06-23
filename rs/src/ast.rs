/// Span in source: (line, col) both 1-based.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Span {
    pub line: usize,
    pub col: usize,
}

impl Span {
    pub fn new(line: usize, col: usize) -> Self {
        Self { line, col }
    }
}

/// All AST node types, mirroring the TypeScript AST.
#[derive(Debug, Clone, PartialEq)]
pub enum Expr {
    // Literals
    Number {
        value: f64,
        span: Span,
    },
    String {
        value: String,
        span: Span,
    },
    Boolean {
        value: bool,
        span: Span,
    },
    Nil {
        span: Span,
    },

    // Identifier
    Identifier {
        name: String,
        span: Span,
    },

    // Unary expression
    Unary {
        op: UnaryOp,
        argument: Box<Expr>,
        span: Span,
    },

    // Binary expression
    Binary {
        op: BinaryOp,
        left: Box<Expr>,
        right: Box<Expr>,
        span: Span,
    },

    // Logical expression (and/or)
    Logical {
        op: LogicalOp,
        left: Box<Expr>,
        right: Box<Expr>,
        span: Span,
    },

    // Comparison group (a < b < c)
    ComparisonGroup {
        ops: Vec<ComparisonOp>,
        exprs: Vec<Expr>,
        span: Span,
    },

    // Member access: expr.identifier
    Member {
        object: Box<Expr>,
        property: String,
        span: Span,
    },

    // Index access: expr[index]
    Index {
        object: Box<Expr>,
        index: Box<Expr>,
        span: Span,
    },

    // Function call: expr(args...)
    Call {
        callee: Box<Expr>,
        args: Vec<Expr>,
        span: Span,
    },

    // Function literal
    Function {
        params: Vec<String>,
        param_defaults: Vec<Option<Expr>>,
        body: Vec<Stmt>,
        span: Span,
    },

    // Object literal { key: val, ... }
    Map {
        fields: Vec<(String, Expr)>,
        span: Span,
    },

    // Array literal [expr, ...]
    List {
        items: Vec<Expr>,
        span: Span,
    },

    // Ternary: true_val if cond else false_val
    Ternary {
        condition: Box<Expr>,
        true_val: Box<Expr>,
        false_val: Box<Expr>,
        span: Span,
    },

    // isa expression: expr isa type
    Isa {
        left: Box<Expr>,
        right: Box<Expr>,
        span: Span,
    },

    // Slice: base[left:right]
    Slice {
        base: Box<Expr>,
        left: Box<Expr>,
        right: Box<Expr>,
        span: Span,
    },

    // Parenthesized expression
    Paren(Box<Expr>),
}

#[derive(Debug, Clone, PartialEq)]
pub enum Stmt {
    // varname = expr
    Assignment {
        target: Box<Expr>,
        value: Box<Expr>,
        span: Span,
    },

    // expr(args...) — statement-level call
    Call {
        callee: Box<Expr>,
        args: Vec<Expr>,
        span: Span,
    },

    // if condition then ... else if ... else ... end if
    If {
        clauses: Vec<IfClause>,
        span: Span,
    },

    // for var in expr ... end for
    For {
        variable: String,
        iterator: Box<Expr>,
        body: Vec<Stmt>,
        span: Span,
    },

    // do ... while cond loop  /  do ... loop
    DoWhile {
        body: Vec<Stmt>,
        while_clauses: Vec<Expr>, // each while clause has its own condition
        while_bodies: Vec<Vec<Stmt>>, // body for each while clause
        span: Span,
    },

    // plan expr ... checking cond ... end plan
    Plan {
        plan_value: Box<Expr>,
        checkings: Vec<PlanChecking>,
        body: Vec<Stmt>,
        span: Span,
    },

    // return expr
    Return {
        value: Option<Box<Expr>>,
        span: Span,
    },

    // break
    Break {
        span: Span,
    },

    // continue
    Continue {
        span: Span,
    },

    // Raw expression statement (e.g., yield 42)
    Expr(Expr),
}

#[derive(Debug, Clone, PartialEq)]
pub struct IfClause {
    pub condition: Option<Expr>, // None for else
    pub body: Vec<Stmt>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PlanChecking {
    pub description: Option<Expr>,
    pub condition: Expr,
}

/// The top-level program.
#[derive(Debug, Clone, PartialEq)]
pub struct Program {
    pub body: Vec<Stmt>,
}

// ---- Operator enums ----

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum UnaryOp {
    Negate, // -expr or not expr
    Not,
    Plus, // +expr (rare but valid)
    New,  // new expr
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum BinaryOp {
    Add,
    Subtract,
    Multiply,
    Divide,
    Modulo,
    Power,
    Equal,
    NotEqual,
    Less,
    Greater,
    LessEqual,
    GreaterEqual,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum LogicalOp {
    And,
    Or,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ComparisonOp {
    Equal,
    NotEqual,
    Less,
    Greater,
    LessEqual,
    GreaterEqual,
}
