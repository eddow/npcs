# NPCS VSCode Extension Installation Guide

## Quick Start

### Option 1: Development Installation (Recommended for testing)

1. **Open the extension folder in VSCode:**
   ```bash
   cd /home/fmdm/dev/npcs/vscode-extension
   code .
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Compile the extension:**
   ```bash
   npm run compile
   ```

4. **Run the extension:**
   - Press `F5` or go to Run > Start Debugging
   - This opens a new "Extension Development Host" window
   - Open any `.npcs` file in this new window to see the language support

### Option 2: Package and Install

1. **Install vsce (Visual Studio Code Extension manager):**
   ```bash
   npm install -g vsce
   ```

2. **Package the extension:**
   ```bash
   cd /home/fmdm/dev/npcs/vscode-extension
   vsce package
   ```

3. **Install the generated package:**
   - This creates a `.vsix` file
   - In VSCode, go to Extensions view (`Ctrl+Shift+X`)
   - Click the "..." menu and select "Install from VSIX..."
   - Select the generated `.vsix` file

## Testing the Extension

### Test Files

The extension includes test examples in the `test-examples/` folder:

- `hello-world.npcs` - Basic syntax and features
- `game-example.npcs` - Complex game script example

### Features to Test

1. **Syntax Highlighting:**
   - Open a `.npcs` file
   - Verify keywords, strings, numbers, and comments are colored differently

2. **Auto-completion:**
   - Type `pr` and press `Ctrl+Space`
   - Should see `print` function in completion list

3. **Hover Information:**
   - Hover over `print` function
   - Should see documentation popup

4. **Code Snippets:**
   - Type `func` and press `Tab`
   - Should expand to function template

5. **Error Detection:**
   - Create syntax errors (unmatched `end function`, etc.)
   - Should see red squiggly lines

6. **Run Script:**
   - Right-click on a `.npcs` file
   - Select "Run NPCS Script" from context menu

## Integration with Your NPCS Project

### Running Scripts from VSCode

The extension is designed to work with your existing NPCS project structure. When you run a script:

1. It looks for a `package.json` in the parent directories
2. If it finds your NPCS project (with `miniscript-core` dependency), it runs:
   ```bash
   npm run dev "path/to/script.npcs"
   ```

### Customizing Script Execution

To customize how scripts are run, modify the `runNPCScript` function in `src/extension.ts`:

```typescript
// Example: Custom execution command
terminal.sendText(`node -e "const npcs = require('./dist/index.js'); npcs.run('${filePath}');"`);
```

## Troubleshooting

### Extension Not Loading

1. Check the Developer Console (`Help > Toggle Developer Tools`)
2. Look for error messages
3. Ensure all dependencies are installed: `npm install`

### Syntax Highlighting Not Working

1. Verify the file has `.npcs` extension
2. Check that the language is set to "NPCS" in the bottom-right status bar
3. Manually set language: `Ctrl+Shift+P` → "Change Language Mode" → "NPCS"

### Auto-completion Not Working

1. Ensure the extension is activated
2. Try `Ctrl+Shift+P` → "Developer: Reload Window"
3. Check that the completion provider is registered in `extension.ts`

### Script Execution Issues

1. Ensure your NPCS project is properly set up
2. Check that `npm run dev` works from the command line
3. Verify the script path is correct

## Development

### Making Changes

1. Edit files in the `src/` directory
2. Run `npm run compile` to rebuild
3. Press `Ctrl+R` in the Extension Development Host to reload

### Adding New Features

1. **New Snippets:** Edit `snippets/npcs.json`
2. **Syntax Rules:** Edit `syntaxes/npcs.tmLanguage.json`
3. **Language Features:** Edit `src/extension.ts`
4. **Configuration:** Edit `language-configuration.json`

### Debugging

1. Set breakpoints in `src/extension.ts`
2. Press `F5` to start debugging
3. Use the Debug Console to inspect variables

## Publishing

If you want to publish this extension:

1. **Update package.json:**
   - Set proper `publisher` name
   - Update version number
   - Add proper description

2. **Create publisher account:**
   ```bash
   vsce create-publisher your-publisher-name
   ```

3. **Publish:**
   ```bash
   vsce publish
   ```

## Support

For issues or questions:
1. Check the VSCode Extension API documentation
2. Review the TextMate grammar documentation
3. Test with the provided example files
