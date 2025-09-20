# VSCode Extension

## Overview

NPCS includes a VSCode extension that provides language support for MiniScript files, including syntax highlighting, IntelliSense, and debugging capabilities.

## Installation

### From VSIX Package

```bash
# Install the extension from the built package
code --install-extension npcs-language-support-1.0.0.vsix
```

### Development Installation

```bash
# Clone the repository
git clone https://github.com/eddow/npcs.git
cd npcs/vscode-extension

# Install dependencies
npm install

# Build the extension
npm run build

# Install in development mode
code --install-extension npcs-language-support-1.0.0.vsix
```

## Features

### 1. Syntax Highlighting

The extension provides comprehensive syntax highlighting for MiniScript files (.npcs, .ms).

#### Supported Elements:
- **Keywords**: `function`, `if`, `else`, `while`, `for`, `return`, `break`, `continue`
- **Literals**: Numbers, strings, booleans, null
- **Operators**: `+`, `-`, `*`, `/`, `==`, `!=`, `<`, `>`, etc.
- **Comments**: Single-line (`//`) and multi-line (`/* */`)
- **Functions**: Function definitions and calls
- **Variables**: Variable declarations and references

#### Color Theme

The extension includes a custom color theme (`npcs-color-theme.json`) with:
- **Keywords**: Blue
- **Strings**: Green
- **Numbers**: Orange
- **Comments**: Gray
- **Functions**: Purple
- **Operators**: Red

### 2. Language Configuration

The extension configures VSCode for MiniScript files with:

```json
{
    "comments": {
        "lineComment": "//",
        "blockComment": ["/*", "*/"]
    },
    "brackets": [
        ["{", "}"],
        ["[", "]"],
        ["(", ")"]
    ],
    "autoClosingPairs": [
        ["{", "}"],
        ["[", "]"],
        ["(", ")"],
        ["\"", "\""],
        ["'", "'"]
    ],
    "surroundingPairs": [
        ["{", "}"],
        ["[", "]"],
        ["(", ")"],
        ["\"", "\""],
        ["'", "'"]
    ]
}
```

### 3. Snippets

The extension provides code snippets for common MiniScript patterns:

```json
{
    "Function Definition": {
        "prefix": "func",
        "body": [
            "function ${1:name}(${2:params})",
            "\t${3:// function body}",
            "end function"
        ],
        "description": "Create a function definition"
    },
    "If Statement": {
        "prefix": "if",
        "body": [
            "if ${1:condition} then",
            "\t${2:// if body}",
            "else",
            "\t${3:// else body}",
            "end if"
        ],
        "description": "Create an if-else statement"
    },
    "While Loop": {
        "prefix": "while",
        "body": [
            "while ${1:condition}",
            "\t${2:// loop body}",
            "end while"
        ],
        "description": "Create a while loop"
    },
    "For Loop": {
        "prefix": "for",
        "body": [
            "for ${1:item} in ${2:collection}",
            "\t${3:// loop body}",
            "end for"
        ],
        "description": "Create a for-in loop"
    }
}
```

### 4. IntelliSense

The extension provides IntelliSense support for:

- **Keywords**: Auto-completion for MiniScript keywords
- **Functions**: Function name completion
- **Variables**: Variable name completion
- **Parameters**: Function parameter hints
- **Documentation**: Hover documentation for built-in functions

### 5. Error Detection

The extension provides real-time error detection:

- **Syntax errors**: Invalid MiniScript syntax
- **Semantic errors**: Undefined variables, type mismatches
- **Runtime errors**: Potential runtime issues

## Configuration

### Extension Settings

The extension can be configured through VSCode settings:

```json
{
    "npcs.enableSyntaxHighlighting": true,
    "npcs.enableIntelliSense": true,
    "npcs.enableErrorDetection": true,
    "npcs.autoFormatOnSave": false,
    "npcs.tabSize": 4,
    "npcs.insertSpaces": true
}
```

### File Associations

The extension automatically associates with MiniScript files:

- `.npcs` - NPCS script files
- `.ms` - MiniScript files
- `.miniscript` - MiniScript files

## Usage

### Creating MiniScript Files

1. **New File**: Create a new file with `.npcs` or `.ms` extension
2. **Syntax Highlighting**: The file will automatically have syntax highlighting
3. **IntelliSense**: Use `Ctrl+Space` for auto-completion
4. **Snippets**: Type snippet prefixes and use `Tab` to expand

### Running Scripts

The extension provides commands for running MiniScript files:

1. **Command Palette**: `Ctrl+Shift+P`
2. **Run Script**: `NPCS: Run Script`
3. **Debug Script**: `NPCS: Debug Script`

### Debugging

The extension includes debugging support:

1. **Breakpoints**: Set breakpoints in MiniScript code
2. **Step Through**: Step through execution
3. **Variable Inspection**: Inspect variable values
4. **Call Stack**: View function call stack

## Development

### Project Structure

```
vscode-extension/
├── src/
│   └── extension.ts          # Main extension code
├── syntaxes/
│   └── npcs.tmLanguage.json  # Syntax highlighting rules
├── themes/
│   └── npcs-color-theme.json # Color theme
├── snippets/
│   └── npcs.json            # Code snippets
├── language-configuration.json # Language configuration
├── package.json             # Extension manifest
└── tsconfig.json           # TypeScript configuration
```

### Building the Extension

```bash
# Install dependencies
npm install

# Build the extension
npm run build

# Package the extension
npm run package
```

### Testing the Extension

```bash
# Run tests
npm test

# Test in VSCode
npm run test:integration
```

## Syntax Highlighting Rules

The extension uses TextMate grammar rules for syntax highlighting:

```json
{
    "scopeName": "source.npcs",
    "fileTypes": ["npcs", "ms", "miniscript"],
    "patterns": [
        {
            "include": "#comments"
        },
        {
            "include": "#strings"
        },
        {
            "include": "#numbers"
        },
        {
            "include": "#keywords"
        },
        {
            "include": "#operators"
        },
        {
            "include": "#functions"
        },
        {
            "include": "#variables"
        }
    ],
    "repository": {
        "comments": {
            "patterns": [
                {
                    "name": "comment.line.double-slash.npcs",
                    "match": "//.*$"
                },
                {
                    "name": "comment.block.npcs",
                    "begin": "/\\*",
                    "end": "\\*/"
                }
            ]
        },
        "strings": {
            "patterns": [
                {
                    "name": "string.quoted.double.npcs",
                    "begin": "\"",
                    "end": "\"",
                    "patterns": [
                        {
                            "name": "constant.character.escape.npcs",
                            "match": "\\\\."
                        }
                    ]
                }
            ]
        },
        "keywords": {
            "patterns": [
                {
                    "name": "keyword.control.npcs",
                    "match": "\\b(function|if|else|while|for|return|break|continue|end|then|and|or|not|isa)\\b"
                }
            ]
        }
    }
}
```

## Language Server Protocol

The extension can be enhanced with Language Server Protocol (LSP) support:

### Features to Add:
- **Real-time validation**: Live syntax and semantic checking
- **Go to definition**: Navigate to function and variable definitions
- **Find references**: Find all references to a symbol
- **Rename symbol**: Rename variables and functions
- **Format document**: Auto-format MiniScript code
- **Code actions**: Quick fixes for common issues

### Implementation:

```typescript
import * as vscode from 'vscode'
import { LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient'

export function activate(context: vscode.ExtensionContext) {
    // Language server options
    const serverOptions: ServerOptions = {
        command: 'node',
        args: [context.extensionPath + '/server.js']
    }
    
    // Client options
    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'npcs' }],
        synchronize: {
            fileEvents: vscode.workspace.createFileSystemWatcher('**/.npcs')
        }
    }
    
    // Create language client
    const client = new LanguageClient('npcs', 'NPCS Language Server', serverOptions, clientOptions)
    
    // Start the client
    client.start()
    
    // Register commands
    const runScriptCommand = vscode.commands.registerCommand('npcs.runScript', () => {
        // Run script logic
    })
    
    context.subscriptions.push(runScriptCommand)
}
```

## Integration with NPCS Library

The extension integrates with the NPCS library for:

### Script Execution

```typescript
import { NpcScript } from 'npc-script'

export class NPCSRunner {
    private script: NpcScript | null = null
    private context: any = {}
    
    async runScript(source: string): Promise<any> {
        try {
            this.script = new NpcScript(source)
            const result = this.script.execute(this.context)
            return result
        } catch (error) {
            throw new Error(`Script error: ${error.message}`)
        }
    }
    
    async resumeScript(state: any): Promise<any> {
        if (!this.script) {
            throw new Error('No script to resume')
        }
        
        const result = this.script.execute(this.context, state)
        return result
    }
}
```

### Error Reporting

```typescript
export class NPCSDiagnostics {
    private diagnostics: vscode.DiagnosticCollection
    
    constructor() {
        this.diagnostics = vscode.languages.createDiagnosticCollection('npcs')
    }
    
    updateDiagnostics(document: vscode.TextDocument): void {
        try {
            const script = new NpcScript(document.getText())
            this.diagnostics.clear()
        } catch (error) {
            if (error instanceof LexerException || error instanceof ParserException) {
                const diagnostic = new vscode.Diagnostic(
                    new vscode.Range(
                        error.range.start.line - 1,
                        error.range.start.character - 1,
                        error.range.end.line - 1,
                        error.range.end.character - 1
                    ),
                    error.message,
                    vscode.DiagnosticSeverity.Error
                )
                
                this.diagnostics.set(document.uri, [diagnostic])
            }
        }
    }
}
```

## Publishing

### Package Creation

```bash
# Install vsce
npm install -g vsce

# Package the extension
vsce package

# Publish to marketplace
vsce publish
```

### Marketplace Listing

The extension is published to the VSCode Marketplace with:

- **Name**: NPCS Language Support
- **Description**: MiniScript language support for VSCode
- **Keywords**: miniscript, npcs, scripting, game-development
- **Categories**: Programming Languages, Debuggers
- **Icon**: Custom NPCS logo
- **Screenshots**: Syntax highlighting examples
- **Documentation**: Link to documentation

## Contributing

### Development Setup

1. **Fork the repository**
2. **Clone your fork**
3. **Install dependencies**: `npm install`
4. **Make changes**
5. **Test changes**: `npm test`
6. **Build extension**: `npm run build`
7. **Submit pull request**

### Guidelines

- **Follow VSCode extension conventions**
- **Add tests for new features**
- **Update documentation**
- **Follow the existing code style**
- **Test on multiple platforms**

This VSCode extension provides comprehensive language support for MiniScript, making it easier to develop and debug NPCS scripts within the VSCode environment.

