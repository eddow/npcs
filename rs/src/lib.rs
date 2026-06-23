pub mod token;
pub mod lexer;
pub mod ast;
pub mod parser;
pub mod value;
pub mod executor;

use lexer::Lexer;
use parser::Parser;

/// Parse a MiniScript source string into a Program AST.
pub fn parse(source: &str) -> Result<ast::Program, String> {
    let mut lexer = Lexer::new(source);
    let tokens = lexer.tokenize();
    let mut parser = Parser::new(tokens);
    let program = parser.parse_program()?;

    if !parser.errors.is_empty() {
        for err in &parser.errors {
            eprintln!("Parse error: {err}");
        }
    }
    if !lexer.errors.is_empty() {
        for err in &lexer.errors {
            eprintln!("Lexer error at {}:{}: {}", err.line, err.col, err.message);
        }
    }

    Ok(program)
}

/// Execute a parsed program with the given context.
pub fn execute(
    program: &ast::Program,
    context: &mut dyn executor::Context,
) -> Result<executor::ExecResult, String> {
    let mut exec = executor::Executor::new();
    exec.execute(program, context)
}

/// Parse and execute a MiniScript source string.
pub fn run(source: &str, context: &mut dyn executor::Context) -> Result<executor::ExecResult, String> {
    let program = parse(source)?;
    execute(&program, context)
}
