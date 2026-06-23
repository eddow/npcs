use crate::token::{Token, TokenKind};

/// Hand-written character-by-character lexer.
pub struct Lexer {
    source: Vec<char>,
    pos: usize,
    line: usize,
    col: usize, // 1-based, start of current token
    /// Accumulated errors during lexing.
    pub errors: Vec<LexerError>,
}

#[derive(Debug, Clone)]
pub struct LexerError {
    pub message: String,
    pub line: usize,
    pub col: usize,
}

impl Lexer {
    pub fn new(source: &str) -> Self {
        Self {
            source: source.chars().collect(),
            pos: 0,
            line: 1,
            col: 1,
            errors: Vec::new(),
        }
    }

    fn peek(&self, offset: usize) -> Option<char> {
        self.source.get(self.pos + offset).copied()
    }

    fn advance(&mut self) -> Option<char> {
        let ch = self.source.get(self.pos).copied();
        if let Some(ch) = ch {
            self.pos += 1;
            if ch == '\n' {
                self.line += 1;
                self.col = 1;
            } else {
                self.col += 1;
            }
        }
        ch
    }

    fn advance_if(&mut self, predicate: fn(char) -> bool) -> bool {
        if self.peek(0).map_or(false, predicate) {
            self.advance();
            true
        } else {
            false
        }
    }

    fn advance_while(&mut self, predicate: fn(char) -> bool) {
        while self.peek(0).map_or(false, predicate) {
            self.advance();
        }
    }

    /// Peek ahead in the original source for multi-word keywords like "end if".
    fn matches_ahead(&self, s: &str) -> bool {
        let mut i = 0;
        let chars: Vec<char> = s.chars().collect();
        while i < chars.len() {
            let ch = self.peek(i);
            if ch != Some(chars[i]) {
                return false;
            }
            i += 1;
        }
        true
    }

    fn error(&mut self, message: String, line: usize, col: usize) {
        self.errors.push(LexerError { message, line, col });
    }

    fn make_token(
        &self,
        kind: TokenKind,
        start_offset: usize,
        start_line: usize,
        start_col: usize,
    ) -> Token {
        let len = self.pos - start_offset;
        Token {
            kind,
            line: start_line,
            col: start_col,
            offset: start_offset,
            len,
        }
    }

    pub fn next_token(&mut self) -> Token {
        // Skip whitespace (but not newlines)
        while self
            .peek(0)
            .map_or(false, |c| c == ' ' || c == '\t' || c == '\r')
        {
            self.advance();
        }

        let start_offset = self.pos;
        let start_line = self.line;
        let start_col = self.col;

        let Some(ch) = self.peek(0) else {
            return self.make_token(TokenKind::Eof, start_offset, start_line, start_col);
        };

        match ch {
            // Newlines
            '\n' => {
                self.advance();
                return self.make_token(TokenKind::Newline, start_offset, start_line, start_col);
            }

            // Comments
            '/' if self.peek(1) == Some('/') => {
                self.advance(); // first /
                self.advance(); // second /
                while self.peek(0).map_or(false, |c| c != '\n') {
                    self.advance();
                }
                return self.make_token(
                    TokenKind::Comment(String::new()),
                    start_offset,
                    start_line,
                    start_col,
                );
            }
            '/' if self.peek(1) == Some('*') => {
                self.advance(); // /
                self.advance(); // *
                while self.peek(0).is_some() {
                    if self.peek(0) == Some('*') && self.peek(1) == Some('/') {
                        self.advance();
                        self.advance();
                        break;
                    }
                    self.advance();
                }
                return self.make_token(
                    TokenKind::Comment(String::new()),
                    start_offset,
                    start_line,
                    start_col,
                );
            }

            // Strings
            '"' | '\'' => {
                let quote = ch;
                self.advance();
                let mut s = String::new();
                loop {
                    match self.peek(0) {
                        None => {
                            self.error("unterminated string".into(), start_line, start_col);
                            break;
                        }
                        Some(c) if c == quote => {
                            self.advance();
                            if self.peek(0) == Some(quote) {
                                // Double quote = escaped quote inside string
                                s.push(quote);
                                self.advance();
                            } else {
                                break;
                            }
                        }
                        Some('\\') => {
                            self.advance();
                            match self.peek(0) {
                                Some('n') => {
                                    s.push('\n');
                                    self.advance();
                                }
                                Some('t') => {
                                    s.push('\t');
                                    self.advance();
                                }
                                Some('\\') => {
                                    s.push('\\');
                                    self.advance();
                                }
                                Some('"') => {
                                    s.push('"');
                                    self.advance();
                                }
                                Some('\'') => {
                                    s.push('\'');
                                    self.advance();
                                }
                                Some(c) => {
                                    s.push(c);
                                    self.advance();
                                }
                                None => {}
                            }
                        }
                        Some(_) => {
                            s.push(self.advance().unwrap());
                        }
                    }
                }
                return self.make_token(TokenKind::String(s), start_offset, start_line, start_col);
            }

            // Numbers
            '0'..='9' => {
                self.advance();
                while self.peek(0).map_or(false, |c| c.is_ascii_digit()) {
                    self.advance();
                }
                if self.peek(0) == Some('.') && self.peek(1).map_or(false, |c| c.is_ascii_digit()) {
                    self.advance(); // dot
                    while self.peek(0).map_or(false, |c| c.is_ascii_digit()) {
                        self.advance();
                    }
                }
                if self.peek(0) == Some('e') || self.peek(0) == Some('E') {
                    self.advance();
                    if self.peek(0) == Some('+') || self.peek(0) == Some('-') {
                        self.advance();
                    }
                    while self.peek(0).map_or(false, |c| c.is_ascii_digit()) {
                        self.advance();
                    }
                }
                let text: String = self.source[start_offset..self.pos].iter().collect();
                let n: f64 = text.parse().unwrap_or(f64::NAN);
                return self.make_token(TokenKind::Number(n), start_offset, start_line, start_col);
            }

            // Identifiers / keywords
            'a'..='z' | 'A'..='Z' | '_' => {
                self.advance();
                while self
                    .peek(0)
                    .map_or(false, |c| c.is_alphanumeric() || c == '_')
                {
                    self.advance();
                }
                let text: String = self.source[start_offset..self.pos].iter().collect();

                // Check for multi-word keywords: "end if", "end function", etc.
                if text == "end" {
                    self.skip_ws_no_newline();
                    if self.peek(0) == Some('i')
                        && self.peek(1) == Some('f')
                        && self
                            .peek(2)
                            .map_or(false, |c| !c.is_alphanumeric() && c != '_')
                    {
                        self.advance(); // i
                        self.advance(); // f
                        return self.make_token(
                            TokenKind::EndIf,
                            start_offset,
                            start_line,
                            start_col,
                        );
                    }
                    if self.peek(0) == Some('f')
                        && self.matches_ahead("function")
                        && self
                            .peek(8)
                            .map_or(false, |c| !c.is_alphanumeric() && c != '_')
                    {
                        for _ in 0..8 {
                            self.advance();
                        }
                        return self.make_token(
                            TokenKind::EndFunction,
                            start_offset,
                            start_line,
                            start_col,
                        );
                    }
                    if self.peek(0) == Some('f')
                        && self.peek(1) == Some('o')
                        && self.peek(2) == Some('r')
                        && self
                            .peek(3)
                            .map_or(false, |c| !c.is_alphanumeric() && c != '_')
                    {
                        self.advance(); // f
                        self.advance(); // o
                        self.advance(); // r
                        return self.make_token(
                            TokenKind::EndFor,
                            start_offset,
                            start_line,
                            start_col,
                        );
                    }
                    if self.peek(0) == Some('p')
                        && self.matches_ahead("plan")
                        && self
                            .peek(4)
                            .map_or(false, |c| !c.is_alphanumeric() && c != '_')
                    {
                        for _ in 0..4 {
                            self.advance();
                        }
                        return self.make_token(
                            TokenKind::EndPlan,
                            start_offset,
                            start_line,
                            start_col,
                        );
                    }
                    return self.make_token(TokenKind::End, start_offset, start_line, start_col);
                }

                // "else if" → ElseIf
                if text == "else" {
                    self.skip_ws_no_newline();
                    if self.peek(0) == Some('i')
                        && self.peek(1) == Some('f')
                        && self
                            .peek(2)
                            .map_or(false, |c| !c.is_alphanumeric() && c != '_')
                    {
                        self.advance(); // i
                        self.advance(); // f
                        return self.make_token(
                            TokenKind::ElseIf,
                            start_offset,
                            start_line,
                            start_col,
                        );
                    }
                }

                let kind = match text.as_str() {
                    "if" => TokenKind::If,
                    "then" => TokenKind::Then,
                    "else" => TokenKind::Else,
                    "function" => TokenKind::Function,
                    "for" => TokenKind::For,
                    "in" => TokenKind::In,
                    "while" => TokenKind::While,
                    "do" => TokenKind::Do,
                    "loop" => TokenKind::Loop,
                    "return" => TokenKind::Return,
                    "break" => TokenKind::Break,
                    "continue" => TokenKind::Continue,
                    "plan" => TokenKind::Plan,
                    "checking" => TokenKind::Checking,
                    "not" => TokenKind::Not,
                    "and" => TokenKind::And,
                    "or" => TokenKind::Or,
                    "isa" => TokenKind::Isa,
                    "new" => TokenKind::New,
                    "true" => TokenKind::True,
                    "false" => TokenKind::False,
                    "null" => TokenKind::Null,
                    _ => TokenKind::Identifier(text),
                };
                return self.make_token(kind, start_offset, start_line, start_col);
            }

            // Operators and punctuation
            _ => {
                self.advance();
                let kind = match ch {
                    '=' if self.peek(0) == Some('=') => {
                        self.advance();
                        TokenKind::Equal
                    }
                    '!' if self.peek(0) == Some('=') => {
                        self.advance();
                        TokenKind::NotEqual
                    }
                    '<' if self.peek(0) == Some('=') => {
                        self.advance();
                        TokenKind::LessEqual
                    }
                    '>' if self.peek(0) == Some('=') => {
                        self.advance();
                        TokenKind::GreaterEqual
                    }
                    '<' => TokenKind::Less,
                    '>' => TokenKind::Greater,
                    '=' => TokenKind::Assign,
                    '+' if self.peek(0) == Some('=') => {
                        self.advance();
                        TokenKind::PlusAssign
                    }
                    '-' if self.peek(0) == Some('=') => {
                        self.advance();
                        TokenKind::MinusAssign
                    }
                    '*' if self.peek(0) == Some('=') => {
                        self.advance();
                        TokenKind::StarAssign
                    }
                    '/' if self.peek(0) == Some('=') => {
                        self.advance();
                        TokenKind::SlashAssign
                    }
                    '%' if self.peek(0) == Some('=') => {
                        self.advance();
                        TokenKind::PercentAssign
                    }
                    '^' if self.peek(0) == Some('=') => {
                        self.advance();
                        TokenKind::CaretAssign
                    }
                    '+' => TokenKind::Plus,
                    '-' => TokenKind::Minus,
                    '*' => TokenKind::Star,
                    '/' => TokenKind::Slash,
                    '%' => TokenKind::Percent,
                    '^' => TokenKind::Caret,
                    '(' => TokenKind::LParen,
                    ')' => TokenKind::RParen,
                    '[' => TokenKind::LBracket,
                    ']' => TokenKind::RBracket,
                    '{' => TokenKind::LBrace,
                    '}' => TokenKind::RBrace,
                    ',' => TokenKind::Comma,
                    '.' => TokenKind::Dot,
                    ':' => TokenKind::Colon,
                    ';' => TokenKind::Semicolon,
                    '@' => TokenKind::At,
                    _ => {
                        self.error(format!("unexpected character: {ch}"), start_line, start_col);
                        TokenKind::Eof
                    }
                };
                self.make_token(kind, start_offset, start_line, start_col)
            }
        }
    }

    /// Skip whitespace without consuming newlines.
    fn skip_ws_no_newline(&mut self) {
        while self
            .peek(0)
            .map_or(false, |c| c == ' ' || c == '\t' || c == '\r')
        {
            self.advance();
        }
    }

    /// Collect all tokens into a Vec (for easy iteration in the parser).
    pub fn tokenize(&mut self) -> Vec<Token> {
        let mut tokens = Vec::new();
        loop {
            let tok = self.next_token();
            let done = tok.kind == TokenKind::Eof;
            tokens.push(tok);
            if done {
                break;
            }
        }
        tokens
    }
}
