use crate::ast::*;
use crate::token::{Token, TokenKind};

/// Recursive-descent parser.
pub struct Parser {
    tokens: Vec<Token>,
    pos: usize,
    pub errors: Vec<String>,
}

impl Parser {
    pub fn new(tokens: Vec<Token>) -> Self {
        Self {
            tokens,
            pos: 0,
            errors: Vec::new(),
        }
    }

    // ---- Helpers ----

    fn peek(&self) -> Option<&Token> {
        self.tokens.get(self.pos)
    }

    fn peek_kind(&self) -> Option<&TokenKind> {
        self.peek().map(|t| &t.kind)
    }

    fn at_eof(&self) -> bool {
        matches!(self.peek_kind(), Some(TokenKind::Eof) | None)
    }

    fn advance(&mut self) -> &Token {
        let tok = &self.tokens[self.pos];
        self.pos += 1;
        tok
    }

    fn skip_newlines(&mut self) {
        while matches!(
            self.peek_kind(),
            Some(TokenKind::Newline) | Some(TokenKind::Comment(_))
        ) {
            self.advance();
        }
    }

    fn expect(&mut self, expected: TokenKind) -> Result<&Token, String> {
        if self.peek().map(|t| &t.kind) == Some(&expected) {
            Ok(self.advance())
        } else {
            let got = self
                .peek()
                .map(|t| format!("{t}"))
                .unwrap_or_else(|| "EOF".into());
            Err(format!("expected {expected:?}, got {got}"))
        }
    }

    fn error(&mut self, msg: String) {
        self.errors.push(msg);
    }

    fn span(&self) -> Span {
        self.peek()
            .map(|t| Span::new(t.line, t.col))
            .unwrap_or(Span::new(1, 1))
    }

    /// Consume token if it matches, otherwise return None.
    fn eat(&mut self, kind: TokenKind) -> bool {
        if self.peek_kind() == Some(&kind) {
            self.advance();
            true
        } else {
            false
        }
    }

    // ---- Top level ----

    pub fn parse_program(&mut self) -> Result<Program, String> {
        let mut body = Vec::new();
        self.skip_newlines();
        while !self.at_eof() {
            body.push(self.parse_statement()?);
            self.skip_newlines();
        }
        Ok(Program { body })
    }

    // ---- Statements ----

    fn parse_statement(&mut self) -> Result<Stmt, String> {
        match self.peek_kind() {
            Some(TokenKind::If) => self.parse_if(),
            Some(TokenKind::For) => self.parse_for(),
            Some(TokenKind::Do) => self.parse_do_while(),
            Some(TokenKind::While) => {
                // while clauses inside do-while are handled by parse_do_while
                Err("unexpected 'while' outside do-while loop".into())
            }
            Some(TokenKind::Plan) => self.parse_plan(),
            Some(TokenKind::Function) => self.parse_named_function(),
            Some(TokenKind::Return) => self.parse_return(),
            Some(TokenKind::Break) => {
                let span = self.span();
                self.advance();
                Ok(Stmt::Break { span })
            }
            Some(TokenKind::Continue) => {
                let span = self.span();
                self.advance();
                Ok(Stmt::Continue { span })
            }
            Some(TokenKind::End)
            | Some(TokenKind::EndIf)
            | Some(TokenKind::EndFunction)
            | Some(TokenKind::EndFor)
            | Some(TokenKind::EndPlan)
            | Some(TokenKind::Loop)
            | Some(TokenKind::Else)
            | Some(TokenKind::ElseIf) => Err(format!(
                "unexpected {:?} at statement position",
                self.peek_kind()
            )),
            _ => self.parse_assign_or_expr_stmt(),
        }
    }

    fn parse_assign_or_expr_stmt(&mut self) -> Result<Stmt, String> {
        let start = self.span();
        let expr = self.parse_expression()?;

        // Assignment?
        if self.eat(TokenKind::Assign) {
            let value = self.parse_expression()?;
            return Ok(Stmt::Assignment {
                target: Box::new(expr),
                value: Box::new(value),
                span: start,
            });
        }

        // Compound assignment (+=, -=, etc.)
        if let Some(op) = self.compound_assign_op() {
            self.advance();
            let rhs = self.parse_expression()?;
            let binop = match op {
                TokenKind::PlusAssign => BinaryOp::Add,
                TokenKind::MinusAssign => BinaryOp::Subtract,
                TokenKind::StarAssign => BinaryOp::Multiply,
                TokenKind::SlashAssign => BinaryOp::Divide,
                TokenKind::PercentAssign => BinaryOp::Modulo,
                TokenKind::CaretAssign => BinaryOp::Power,
                _ => unreachable!(),
            };
            let binary = Expr::Binary {
                op: binop,
                left: Box::new(expr.clone()),
                right: Box::new(rhs),
                span: start,
            };
            return Ok(Stmt::Assignment {
                target: Box::new(expr),
                value: Box::new(binary),
                span: start,
            });
        }

        // Statement call: `print "hello"` (no parens, args separated by spaces/commas)
        // Check if the next token can start an argument (string, number, identifier, etc.)
        if is_stmt_arg_start(self.peek_kind()) {
            let mut args = Vec::new();
            loop {
                if is_stmt_end(self.peek_kind()) {
                    break;
                }
                if self.eat(TokenKind::Comma) {
                    self.skip_newlines();
                    continue;
                }
                args.push(self.parse_expression()?);
            }
            if args.is_empty() {
                return Ok(Stmt::Call {
                    callee: Box::new(expr),
                    args: vec![],
                    span: start,
                });
            }
            return Ok(Stmt::Call {
                callee: Box::new(expr),
                args,
                span: start,
            });
        }

        // Plain expression statement
        Ok(Stmt::Expr(expr))
    }

    fn compound_assign_op(&self) -> Option<TokenKind> {
        match self.peek_kind() {
            Some(TokenKind::PlusAssign)
            | Some(TokenKind::MinusAssign)
            | Some(TokenKind::StarAssign)
            | Some(TokenKind::SlashAssign)
            | Some(TokenKind::PercentAssign)
            | Some(TokenKind::CaretAssign) => self.peek_kind().cloned(),
            _ => None,
        }
    }

    fn parse_if(&mut self) -> Result<Stmt, String> {
        let span = self.span();
        self.advance(); // if
        let condition = self.parse_expression()?;
        self.expect(TokenKind::Then)?;

        let mut clauses: Vec<IfClause> = Vec::new();

        // First clause — shortcut (one-liner) or block?
        let body = if self.peek_kind() == Some(&TokenKind::Newline) {
            // Multi-line block
            self.parse_block_until(&[
                TokenKind::Else,
                TokenKind::ElseIf,
                TokenKind::EndIf,
                TokenKind::End,
            ])?
        } else {
            // Shortcut: single statement on the same line
            let stmt = self.parse_statement()?;
            self.skip_newlines();
            vec![stmt]
        };
        clauses.push(IfClause {
            condition: Some(condition),
            body,
        });

        // else if / else clauses
        loop {
            if self.eat(TokenKind::EndIf) || (self.eat(TokenKind::End) && self.eat(TokenKind::If)) {
                break;
            }
            if self.eat(TokenKind::Else) {
                let body = if self.peek_kind() == Some(&TokenKind::Newline) {
                    self.parse_block_until(&[TokenKind::EndIf, TokenKind::End])?
                } else {
                    let stmt = self.parse_statement()?;
                    self.skip_newlines();
                    vec![stmt]
                };
                // consume end if
                if !self.eat(TokenKind::EndIf) {
                    self.eat(TokenKind::End);
                    self.eat(TokenKind::If);
                }
                clauses.push(IfClause {
                    condition: None,
                    body,
                });
                break;
            } else if self.eat(TokenKind::ElseIf)
                || (self.eat(TokenKind::Else) && self.eat(TokenKind::If))
            {
                let cond = self.parse_expression()?;
                self.expect(TokenKind::Then)?;
                let body = if self.peek_kind() == Some(&TokenKind::Newline) {
                    self.parse_block_until(&[
                        TokenKind::Else,
                        TokenKind::ElseIf,
                        TokenKind::EndIf,
                        TokenKind::End,
                    ])?
                } else {
                    let stmt = self.parse_statement()?;
                    self.skip_newlines();
                    vec![stmt]
                };
                clauses.push(IfClause {
                    condition: Some(cond),
                    body,
                });
            } else {
                break;
            }
        }

        Ok(Stmt::If { clauses, span })
    }

    fn parse_for(&mut self) -> Result<Stmt, String> {
        let span = self.span();
        self.advance(); // for

        let var_name = match self.peek_kind() {
            Some(TokenKind::Identifier(name)) => name.clone(),
            _ => return Err("expected variable name after 'for'".into()),
        };
        self.advance();

        self.expect(TokenKind::In)?;
        let iterator = self.parse_expression()?;
        self.skip_newlines();

        let body = self.parse_block_until(&[TokenKind::EndFor, TokenKind::End])?;
        // consume end for
        self.eat(TokenKind::EndFor);
        if !self.eat(TokenKind::EndFor) {
            self.eat(TokenKind::End);
            self.eat(TokenKind::For);
        }

        Ok(Stmt::For {
            variable: var_name,
            iterator: Box::new(iterator),
            body,
            span,
        })
    }

    fn parse_do_while(&mut self) -> Result<Stmt, String> {
        let span = self.span();
        self.advance(); // do
        self.skip_newlines();

        // Parse body until while or loop
        let mut body = Vec::new();
        let mut while_clauses: Vec<Expr> = Vec::new();
        let mut while_bodies: Vec<Vec<Stmt>> = Vec::new();

        loop {
            self.skip_newlines();
            match self.peek_kind() {
                Some(TokenKind::Loop) => {
                    self.advance();
                    break;
                }
                Some(TokenKind::While) => {
                    self.advance();
                    let cond = self.parse_expression()?;
                    self.skip_newlines();

                    // Parse while-clause body until next while or loop
                    let mut wbody = Vec::new();
                    loop {
                        self.skip_newlines();
                        match self.peek_kind() {
                            Some(TokenKind::While) | Some(TokenKind::Loop) => break,
                            Some(TokenKind::Eof) => break,
                            _ => {
                                wbody.push(self.parse_statement()?);
                            }
                        }
                    }
                    while_clauses.push(cond);
                    while_bodies.push(wbody);
                }
                Some(TokenKind::Eof) => {
                    return Err("unexpected EOF in do-while loop".into());
                }
                _ => {
                    body.push(self.parse_statement()?);
                }
            }
        }

        Ok(Stmt::DoWhile {
            body,
            while_clauses,
            while_bodies,
            span,
        })
    }

    fn parse_plan(&mut self) -> Result<Stmt, String> {
        let span = self.span();
        self.advance(); // plan
        let plan_value = self.parse_expression()?;
        self.skip_newlines();

        let mut checkings = Vec::new();
        let mut body = Vec::new();

        loop {
            self.skip_newlines();
            match self.peek_kind() {
                Some(TokenKind::Checking) => {
                    self.advance();
                    let first = self.parse_expression()?;

                    let (description, condition) =
                        if matches!(self.peek_kind(), Some(TokenKind::Colon)) {
                            self.advance(); // colon
                            (Some(first), self.parse_expression()?)
                        } else {
                            (None, first)
                        };
                    checkings.push(PlanChecking {
                        description,
                        condition,
                    });
                }
                Some(TokenKind::EndPlan) | Some(TokenKind::End) => {
                    self.eat(TokenKind::EndPlan);
                    if !self.eat(TokenKind::EndPlan) {
                        self.eat(TokenKind::End);
                        self.eat(TokenKind::Plan);
                    }
                    break;
                }
                Some(TokenKind::Eof) => break,
                _ => {
                    body.push(self.parse_statement()?);
                }
            }
        }

        Ok(Stmt::Plan {
            plan_value: Box::new(plan_value),
            checkings,
            body,
            span,
        })
    }

    fn parse_named_function(&mut self) -> Result<Stmt, String> {
        let span = self.span();
        self.advance(); // function

        let name = match self.peek_kind() {
            Some(TokenKind::Identifier(name)) => name.clone(),
            _ => return Err("expected function name".into()),
        };
        self.advance();

        let (params, defaults) = self.parse_function_params()?;
        self.skip_newlines();

        let body = self.parse_block_until(&[TokenKind::EndFunction, TokenKind::End])?;
        // consume end function
        self.eat(TokenKind::EndFunction);
        if !self.eat(TokenKind::EndFunction) {
            self.eat(TokenKind::End);
            self.eat(TokenKind::Function);
        }

        let func_expr = Expr::Function {
            params,
            param_defaults: defaults,
            body,
            span,
        };

        Ok(Stmt::Assignment {
            target: Box::new(Expr::Identifier { name, span }),
            value: Box::new(func_expr),
            span,
        })
    }

    fn parse_function_params(&mut self) -> Result<(Vec<String>, Vec<Option<Expr>>), String> {
        let mut params = Vec::new();
        let mut defaults = Vec::new();

        if !self.eat(TokenKind::LParen) {
            return Ok((params, defaults));
        }

        loop {
            self.skip_newlines();
            if self.eat(TokenKind::RParen) {
                break;
            }

            let name = match self.peek_kind() {
                Some(TokenKind::Identifier(name)) => name.clone(),
                _ => return Err("expected parameter name".into()),
            };
            self.advance();

            let default = if self.eat(TokenKind::Assign) {
                Some(self.parse_expression()?)
            } else {
                None
            };

            params.push(name);
            defaults.push(default);

            if self.eat(TokenKind::Comma) {
                continue;
            }
            self.skip_newlines();
            if self.eat(TokenKind::RParen) {
                break;
            }
        }

        Ok((params, defaults))
    }

    fn parse_return(&mut self) -> Result<Stmt, String> {
        let span = self.span();
        self.advance(); // return

        if matches!(
            self.peek_kind(),
            Some(TokenKind::Newline) | Some(TokenKind::Eof) | Some(TokenKind::Comment(_))
        ) {
            return Ok(Stmt::Return { value: None, span });
        }

        let value = self.parse_expression()?;
        Ok(Stmt::Return {
            value: Some(Box::new(value)),
            span,
        })
    }

    /// Parse statements until one of the end tokens is encountered.
    fn parse_block_until(&mut self, end_tokens: &[TokenKind]) -> Result<Vec<Stmt>, String> {
        let mut stmts = Vec::new();
        self.skip_newlines();
        loop {
            if self.at_eof() {
                break;
            }
            let kind = self.peek_kind().cloned();
            if kind.as_ref().map_or(false, |k| end_tokens.contains(k)) {
                break;
            }
            // Also check for the compound "end if", "end for", etc. via End token
            if kind == Some(TokenKind::End) {
                break; // conservative: break on bare "end" too
            }
            // Do-while terminators (should never appear as statements inside blocks)
            if kind == Some(TokenKind::Loop) || kind == Some(TokenKind::While) {
                break;
            }
            stmts.push(self.parse_statement()?);
            self.skip_newlines();
        }
        Ok(stmts)
    }

    // ---- Expressions (precedence climbing) ----

    /// Top-level expression: or
    fn parse_expression(&mut self) -> Result<Expr, String> {
        self.parse_or()
    }

    fn parse_or(&mut self) -> Result<Expr, String> {
        let mut left = self.parse_and()?;
        while self.eat(TokenKind::Or) {
            self.skip_newlines();
            let right = self.parse_and()?;
            left = Expr::Logical {
                op: LogicalOp::Or,
                left: Box::new(left),
                right: Box::new(right),
                span: self.span(),
            };
        }
        Ok(left)
    }

    fn parse_and(&mut self) -> Result<Expr, String> {
        let mut left = self.parse_ternary()?;
        while self.eat(TokenKind::And) {
            self.skip_newlines();
            let right = self.parse_ternary()?;
            left = Expr::Logical {
                op: LogicalOp::And,
                left: Box::new(left),
                right: Box::new(right),
                span: self.span(),
            };
        }
        Ok(left)
    }

    /// Ternary: true_val if cond else false_val
    fn parse_ternary(&mut self) -> Result<Expr, String> {
        let span = self.span();
        let true_val = self.parse_comparison()?;

        // Don't skip newlines — ternary `value if cond else other` is inline on one line
        if self.peek_kind() == Some(&TokenKind::If) {
            self.advance(); // if
            self.skip_newlines();
            let cond = self.parse_comparison()?;
            self.skip_newlines();
            self.expect(TokenKind::Else)?;
            self.skip_newlines();
            let false_val = self.parse_ternary()?;
            Ok(Expr::Ternary {
                condition: Box::new(cond),
                true_val: Box::new(true_val),
                false_val: Box::new(false_val),
                span,
            })
        } else {
            Ok(true_val)
        }
    }

    /// Comparison: a < b, a == b, a < b < c (comparison groups)
    fn parse_comparison(&mut self) -> Result<Expr, String> {
        let span = self.span();
        let first = self.parse_add_sub()?;

        // Check for comparison operator
        if !self.is_comparison_op() {
            return Ok(first);
        }

        let mut exprs = vec![first];
        let mut ops: Vec<ComparisonOp> = Vec::new();

        while self.is_comparison_op() {
            ops.push(self.comparison_op().unwrap());
            self.advance();
            exprs.push(self.parse_add_sub()?);
        }

        if ops.len() == 1 {
            Ok(Expr::Binary {
                op: comp_to_binary(ops[0]),
                left: Box::new(exprs.remove(0)),
                right: Box::new(exprs.remove(0)),
                span,
            })
        } else {
            Ok(Expr::ComparisonGroup { ops, exprs, span })
        }
    }

    fn is_comparison_op(&self) -> bool {
        matches!(
            self.peek_kind(),
            Some(TokenKind::Equal)
                | Some(TokenKind::NotEqual)
                | Some(TokenKind::Less)
                | Some(TokenKind::Greater)
                | Some(TokenKind::LessEqual)
                | Some(TokenKind::GreaterEqual)
        )
    }

    fn comparison_op(&self) -> Option<ComparisonOp> {
        match self.peek_kind() {
            Some(TokenKind::Equal) => Some(ComparisonOp::Equal),
            Some(TokenKind::NotEqual) => Some(ComparisonOp::NotEqual),
            Some(TokenKind::Less) => Some(ComparisonOp::Less),
            Some(TokenKind::Greater) => Some(ComparisonOp::Greater),
            Some(TokenKind::LessEqual) => Some(ComparisonOp::LessEqual),
            Some(TokenKind::GreaterEqual) => Some(ComparisonOp::GreaterEqual),
            _ => None,
        }
    }

    fn parse_add_sub(&mut self) -> Result<Expr, String> {
        let mut left = self.parse_mul_div()?;
        loop {
            match self.peek_kind() {
                Some(TokenKind::Plus) => {
                    let span = self.span();
                    self.advance();
                    self.skip_newlines();
                    let right = self.parse_mul_div()?;
                    left = Expr::Binary {
                        op: BinaryOp::Add,
                        left: Box::new(left),
                        right: Box::new(right),
                        span,
                    };
                }
                Some(TokenKind::Minus) => {
                    let span = self.span();
                    self.advance();
                    self.skip_newlines();
                    let right = self.parse_mul_div()?;
                    left = Expr::Binary {
                        op: BinaryOp::Subtract,
                        left: Box::new(left),
                        right: Box::new(right),
                        span,
                    };
                }
                _ => break,
            }
        }
        Ok(left)
    }

    fn parse_mul_div(&mut self) -> Result<Expr, String> {
        let mut left = self.parse_unary()?;
        loop {
            match self.peek_kind() {
                Some(TokenKind::Star) => {
                    let span = self.span();
                    self.advance();
                    self.skip_newlines();
                    let right = self.parse_unary()?;
                    left = Expr::Binary {
                        op: BinaryOp::Multiply,
                        left: Box::new(left),
                        right: Box::new(right),
                        span,
                    };
                }
                Some(TokenKind::Slash) => {
                    let span = self.span();
                    self.advance();
                    self.skip_newlines();
                    let right = self.parse_unary()?;
                    left = Expr::Binary {
                        op: BinaryOp::Divide,
                        left: Box::new(left),
                        right: Box::new(right),
                        span,
                    };
                }
                Some(TokenKind::Percent) => {
                    let span = self.span();
                    self.advance();
                    self.skip_newlines();
                    let right = self.parse_unary()?;
                    left = Expr::Binary {
                        op: BinaryOp::Modulo,
                        left: Box::new(left),
                        right: Box::new(right),
                        span,
                    };
                }
                Some(TokenKind::Caret) => {
                    let span = self.span();
                    self.advance();
                    self.skip_newlines();
                    let right = self.parse_unary()?;
                    left = Expr::Binary {
                        op: BinaryOp::Power,
                        left: Box::new(left),
                        right: Box::new(right),
                        span,
                    };
                }
                _ => break,
            }
        }
        Ok(left)
    }

    fn parse_unary(&mut self) -> Result<Expr, String> {
        let span = self.span();
        match self.peek_kind() {
            Some(TokenKind::Minus) => {
                self.advance();
                let arg = self.parse_call_member_index()?;
                // If it's a number literal, negate it directly
                if let Expr::Number { value, .. } = &arg {
                    Ok(Expr::Number {
                        value: -value,
                        span,
                    })
                } else {
                    Ok(Expr::Unary {
                        op: UnaryOp::Negate,
                        argument: Box::new(arg),
                        span,
                    })
                }
            }
            Some(TokenKind::Not) => {
                self.advance();
                let arg = self.parse_call_member_index()?;
                Ok(Expr::Unary {
                    op: UnaryOp::Not,
                    argument: Box::new(arg),
                    span,
                })
            }
            Some(TokenKind::New) => {
                self.advance();
                let arg = self.parse_call_member_index()?;
                Ok(Expr::Unary {
                    op: UnaryOp::New,
                    argument: Box::new(arg),
                    span,
                })
            }
            _ => self.parse_call_member_index(),
        }
    }

    /// Handles call, member, index, slice chains.
    fn parse_call_member_index(&mut self) -> Result<Expr, String> {
        let mut left = self.parse_atom()?;

        loop {
            match self.peek_kind() {
                // Function call: expr(args)
                Some(TokenKind::LParen) => {
                    let span = self.span();
                    self.advance();
                    let mut args = Vec::new();
                    loop {
                        self.skip_newlines();
                        if self.eat(TokenKind::RParen) {
                            break;
                        }
                        args.push(self.parse_expression()?);
                        self.skip_newlines();
                        if self.eat(TokenKind::Comma) {
                            continue;
                        }
                        if self.eat(TokenKind::RParen) {
                            break;
                        }
                    }
                    left = Expr::Call {
                        callee: Box::new(left),
                        args,
                        span,
                    };
                }
                // Member access: expr.identifier
                Some(TokenKind::Dot) => {
                    let span = self.span();
                    self.advance();
                    let prop = match self.peek_kind() {
                        Some(TokenKind::Identifier(name)) => name.clone(),
                        _ => return Err("expected property name after '.'".into()),
                    };
                    self.advance();
                    left = Expr::Member {
                        object: Box::new(left),
                        property: prop,
                        span,
                    };
                }
                // Index or slice: expr[index] or expr[left:right]
                Some(TokenKind::LBracket) => {
                    let span = self.span();
                    self.advance();
                    self.skip_newlines();

                    if self.eat(TokenKind::Colon) {
                        // [:right]
                        let right = if self.eat(TokenKind::RBracket) {
                            Expr::Nil { span }
                        } else {
                            let r = self.parse_expression()?;
                            self.expect(TokenKind::RBracket)?;
                            r
                        };
                        left = Expr::Slice {
                            base: Box::new(left),
                            left: Box::new(Expr::Nil { span }),
                            right: Box::new(right),
                            span,
                        };
                    } else {
                        let index = self.parse_expression()?;
                        self.skip_newlines();
                        if self.eat(TokenKind::Colon) {
                            // [left:right] or [left:]
                            let right = if self.eat(TokenKind::RBracket) {
                                Expr::Nil { span }
                            } else {
                                let r = self.parse_expression()?;
                                self.expect(TokenKind::RBracket)?;
                                r
                            };
                            left = Expr::Slice {
                                base: Box::new(left),
                                left: Box::new(index),
                                right: Box::new(right),
                                span,
                            };
                        } else {
                            self.expect(TokenKind::RBracket)?;
                            left = Expr::Index {
                                object: Box::new(left),
                                index: Box::new(index),
                                span,
                            };
                        }
                    }
                }
                // isa
                Some(TokenKind::Isa) => {
                    let span = self.span();
                    self.advance();
                    self.skip_newlines();
                    let right = self.parse_atom()?;
                    left = Expr::Isa {
                        left: Box::new(left),
                        right: Box::new(right),
                        span,
                    };
                }
                _ => break,
            }
        }
        Ok(left)
    }

    /// Parse atomic expressions: literals, identifiers, parenthesized, map, list, function
    fn parse_atom(&mut self) -> Result<Expr, String> {
        let span = self.span();
        match self.peek_kind().cloned() {
            Some(TokenKind::Number(n)) => {
                self.advance();
                Ok(Expr::Number { value: n, span })
            }
            Some(TokenKind::String(s)) => {
                self.advance();
                Ok(Expr::String { value: s, span })
            }
            Some(TokenKind::True) => {
                self.advance();
                Ok(Expr::Boolean { value: true, span })
            }
            Some(TokenKind::False) => {
                self.advance();
                Ok(Expr::Boolean { value: false, span })
            }
            Some(TokenKind::Null) => {
                self.advance();
                Ok(Expr::Nil { span })
            }
            Some(TokenKind::Identifier(name)) => {
                self.advance();
                Ok(Expr::Identifier { name, span })
            }
            Some(TokenKind::LParen) => {
                self.advance();
                let expr = self.parse_expression()?;
                self.expect(TokenKind::RParen)?;
                Ok(Expr::Paren(Box::new(expr)))
            }
            Some(TokenKind::LBrace) => self.parse_map(),
            Some(TokenKind::LBracket) => self.parse_list(),
            Some(TokenKind::Function) => self.parse_anonymous_function(),
            _ => Err(format!("unexpected token: {:?}", self.peek_kind())),
        }
    }

    fn parse_map(&mut self) -> Result<Expr, String> {
        let span = self.span();
        self.advance(); // {
        self.skip_newlines();

        let mut fields = Vec::new();

        if !self.eat(TokenKind::RBrace) {
            loop {
                let key = self.parse_expression()?;

                let value = if self.eat(TokenKind::Colon) {
                    self.skip_newlines();
                    self.parse_expression()?
                } else {
                    // Shorthand: {name} → {name: name}
                    // Only valid for identifiers
                    key.clone()
                };

                // If key is an Identifier, use its name; otherwise stringify
                let key_str = match &key {
                    Expr::Identifier { name, .. } => name.clone(),
                    Expr::String { value, .. } => value.clone(),
                    _ => format!("{key:?}"), // fallback
                };
                fields.push((key_str, value));

                self.skip_newlines();
                if self.eat(TokenKind::Comma) {
                    self.skip_newlines();
                    continue;
                }
                if self.eat(TokenKind::RBrace) {
                    break;
                }
                // If next is not comma or }, might be end of map anyway
                if self.peek_kind() == Some(&TokenKind::Newline) || self.at_eof() {
                    self.eat(TokenKind::RBrace);
                    break;
                }
            }
        }

        Ok(Expr::Map { fields, span })
    }

    fn parse_list(&mut self) -> Result<Expr, String> {
        let span = self.span();
        self.advance(); // [
        self.skip_newlines();

        let mut items = Vec::new();

        if !self.eat(TokenKind::RBracket) {
            loop {
                items.push(self.parse_expression()?);

                self.skip_newlines();
                if self.eat(TokenKind::Comma) {
                    self.skip_newlines();
                    continue;
                }
                if self.eat(TokenKind::RBracket) {
                    break;
                }
                // End without bracket
                if self.peek_kind() == Some(&TokenKind::Newline) || self.at_eof() {
                    self.eat(TokenKind::RBracket);
                    break;
                }
            }
        }

        Ok(Expr::List { items, span })
    }

    fn parse_anonymous_function(&mut self) -> Result<Expr, String> {
        let span = self.span();
        self.advance(); // function

        let (params, defaults) = self.parse_function_params()?;
        self.skip_newlines();

        let body = self.parse_block_until(&[TokenKind::EndFunction, TokenKind::End])?;
        // consume end function
        self.eat(TokenKind::EndFunction);
        if !self.eat(TokenKind::EndFunction) {
            self.eat(TokenKind::End);
            self.eat(TokenKind::Function);
        }

        Ok(Expr::Function {
            params,
            param_defaults: defaults,
            body,
            span,
        })
    }
}

fn comp_to_binary(op: ComparisonOp) -> BinaryOp {
    match op {
        ComparisonOp::Equal => BinaryOp::Equal,
        ComparisonOp::NotEqual => BinaryOp::NotEqual,
        ComparisonOp::Less => BinaryOp::Less,
        ComparisonOp::Greater => BinaryOp::Greater,
        ComparisonOp::LessEqual => BinaryOp::LessEqual,
        ComparisonOp::GreaterEqual => BinaryOp::GreaterEqual,
    }
}

/// Can this token start a statement-call argument?
fn is_stmt_arg_start(kind: Option<&TokenKind>) -> bool {
    matches!(
        kind,
        Some(TokenKind::String(_))
            | Some(TokenKind::Number(_))
            | Some(TokenKind::True)
            | Some(TokenKind::False)
            | Some(TokenKind::Null)
            | Some(TokenKind::Identifier(_))
            | Some(TokenKind::LParen)
            | Some(TokenKind::LBracket)
            | Some(TokenKind::LBrace)
            | Some(TokenKind::Function)
            | Some(TokenKind::Not)
            | Some(TokenKind::Minus)
            | Some(TokenKind::New)
    )
}

/// Is this token an end-of-statement marker?
fn is_stmt_end(kind: Option<&TokenKind>) -> bool {
    matches!(
        kind,
        Some(TokenKind::Newline)
            | Some(TokenKind::Eof)
            | Some(TokenKind::Comment(_))
            | Some(TokenKind::Else)
            | Some(TokenKind::ElseIf)
            | Some(TokenKind::End)
            | Some(TokenKind::EndIf)
            | Some(TokenKind::EndFor)
            | Some(TokenKind::EndFunction)
            | Some(TokenKind::EndPlan)
            | Some(TokenKind::Loop)
            | Some(TokenKind::While)
    )
}
