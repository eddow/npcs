use std::fmt;

/// Every token the lexer can produce.
#[derive(Debug, Clone, PartialEq)]
pub enum TokenKind {
    // Keywords (single word)
    If,
    Then,
    Else,
    ElseIf,
    End,
    EndIf,
    Function,
    EndFunction,
    For,
    EndFor,
    In,
    While,
    Do,
    Loop,
    Return,
    Break,
    Continue,
    Plan,
    EndPlan,
    Checking,
    Not,
    And,
    Or,
    Isa,
    New,

    // Literal keywords
    True,
    False,
    Null,

    // Literals with values
    Number(f64),
    String(String),

    // Operators (1-2 chars)
    Equal,
    NotEqual,
    LessEqual,
    GreaterEqual,
    Less,
    Greater,
    Assign,
    PlusAssign,
    MinusAssign,
    StarAssign,
    SlashAssign,
    PercentAssign,
    CaretAssign,
    Plus,
    Minus,
    Star,
    Slash,
    Percent,
    Caret,

    // Punctuation
    LParen,
    RParen,
    LBracket,
    RBracket,
    LBrace,
    RBrace,
    Comma,
    Dot,
    Colon,
    Semicolon,
    At,

    // Structural
    Newline,
    Identifier(String),
    Comment(String),
    Eof,
}

/// A token with position information.
#[derive(Debug, Clone, PartialEq)]
pub struct Token {
    pub kind: TokenKind,
    pub line: usize,
    pub col: usize,    // 1-based column within the line
    pub offset: usize, // byte offset from start of source
    pub len: usize,
}

impl Token {
    pub fn span_text<'s>(&self, source: &'s str) -> &'s str {
        &source[self.offset..self.offset + self.len]
    }
}

impl fmt::Display for Token {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match &self.kind {
            TokenKind::Number(n) => write!(f, "Number({n})"),
            TokenKind::String(s) => write!(f, "String({s:?})"),
            TokenKind::Identifier(id) => write!(f, "Identifier({id})"),
            TokenKind::Comment(_) => write!(f, "Comment"),
            other => write!(f, "{other:?}"),
        }
    }
}
