pub mod ast;
pub mod cross_engine;
pub mod executor;
pub mod lexer;
pub mod parser;
pub mod pragma_parser;
pub mod token;
pub mod value;

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

/// Compile a MiniScript source string into an NpcScript.
pub fn compile(source: &str) -> Result<executor::NpcScript, String> {
    executor::NpcScript::parse(source)
}

/// Execute a compiled script with the given context.
pub fn execute(script: &executor::NpcScript, ctx: &mut dyn executor::Context) -> Result<executor::ExecResult, String> {
    let mut exec = executor::Executor::new(script);
    exec.execute(ctx)
}

/// Execute a compiled script, resuming from a saved state.
pub fn execute_with_state(
    script: &executor::NpcScript,
    ctx: &mut dyn executor::Context,
    state: &executor::ExecutionState,
) -> Result<executor::ExecResult, String> {
    let mut exec = executor::Executor::from_state(script, state);
    exec.execute(ctx)
}

/// Parse, compile, and execute a MiniScript source string (convenience).
pub fn run(source: &str, ctx: &mut dyn executor::Context) -> Result<executor::ExecResult, String> {
    let script = compile(source)?;
    execute(&script, ctx)
}
