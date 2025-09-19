# NPCS Language Support for VSCode

This extension provides comprehensive language support for NPCS (MiniScript-based scripting language) files in Visual Studio Code.

## Features

- **Syntax Highlighting**: Full syntax highlighting for NPCS files with proper color coding for keywords, functions, strings, numbers, and comments
- **Auto-completion**: Intelligent code completion for built-in functions, keywords, and constants
- **Hover Information**: Detailed hover information for built-in functions and keywords
- **Error Detection**: Basic syntax validation and error highlighting
- **Code Snippets**: Pre-built snippets for common NPCS patterns
- **Run Script**: Right-click context menu to run NPCS scripts
- **Debug Support**: Framework for debugging NPCS scripts (to be implemented)

## Installation

### Development Installation

1. Clone or download this extension
2. Open the extension folder in VSCode
3. Press `F5` to run the extension in a new Extension Development Host window
4. Open a `.npcs` file to see the language support in action

### Production Installation

1. Package the extension: `vsce package`
2. Install the generated `.vsix` file in VSCode

## Usage

### File Association

The extension automatically recognizes `.npcs` files and provides language support.

### Running Scripts

- Right-click on a `.npcs` file in the Explorer and select "Run NPCS Script"
- Or use the Command Palette (`Ctrl+Shift+P`) and search for "NPCS: Run Script"

### Code Snippets

Type the following prefixes and press `Tab` to expand:

- `func` - Anonymous function definition
- `nfunc` - Named function definition
- `funcdef` - Named function with default parameters
- `afuncdef` - Anonymous function with default parameters
- `if` - If statement
- `ifelse` - If-else statement
- `while` - While loop
- `for` - For loop
- `print` - Print statement
- `var` - Variable assignment
- `obj` - Object literal
- `arr` - Array literal
- `yield` - Yield statement
- `return` - Return statement
- `break` - Break statement
- `continue` - Continue statement
- `isa` - ISA type check
- `comment` - Comment
- `gamefunc` - Game function template

### Auto-completion

The extension provides auto-completion for:

- Built-in functions (`print`, `len`, `str`, `val`, etc.)
- Keywords (`function`, `if`, `while`, `for`, etc.)
- Constants (`true`, `false`, `null`, `undefined`)

### Hover Information

Hover over any built-in function or keyword to see detailed information about its usage.

## NPCS Language Features

NPCS is a MiniScript-based scripting language with the following features:

- **Variables and Functions**: Full support for variable declarations and function definitions
- **Named Functions**: Support for both `function name()` and `name = function()` syntax
- **Default Parameters**: Function parameters can have default values using `param = value` syntax
- **Control Flow**: `if/else`, `while`, and `for` loops with `break` and `continue`
- **Data Types**: Numbers, strings, booleans, objects, and arrays
- **Object Creation**: `{key: value}` syntax with property access
- **Array Support**: `[item1, item2]` syntax with index access
- **Stateful Execution**: `yield()` function for pausing and resuming execution
- **Built-in Functions**: Comprehensive set of built-in functions for common operations

## Configuration

The extension uses the following configuration files:

- `language-configuration.json` - Language-specific settings like comments, brackets, and indentation
- `syntaxes/npcs.tmLanguage.json` - TextMate grammar for syntax highlighting
- `snippets/npcs.json` - Code snippets for common patterns

## Development

### Project Structure

```
vscode-extension/
├── src/
│   └── extension.ts          # Main extension code
├── syntaxes/
│   └── npcs.tmLanguage.json  # Syntax highlighting grammar
├── snippets/
│   └── npcs.json            # Code snippets
├── .vscode/
│   ├── launch.json          # Debug configuration
│   └── tasks.json           # Build tasks
├── package.json             # Extension manifest
├── tsconfig.json           # TypeScript configuration
└── README.md               # This file
```

### Building

```bash
npm install
npm run compile
```

### Testing

Press `F5` to run the extension in a new Extension Development Host window for testing.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This extension is provided as-is for the NPCS scripting language project.

## Changelog

### 1.0.0
- Initial release
- Syntax highlighting
- Auto-completion
- Hover information
- Error detection
- Code snippets
- Run script functionality
- Named function syntax support (`function name()`)
- Default parameter syntax support (`param = value`)
- Enhanced function definition snippets
