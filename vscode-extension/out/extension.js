"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
function activate(context) {
    console.log('NPCS Language Support extension is now active!');
    // Register commands
    const runScriptCommand = vscode.commands.registerCommand('npcs.runScript', async (uri) => {
        await runNPCScript(uri);
    });
    const debugScriptCommand = vscode.commands.registerCommand('npcs.debugScript', async (uri) => {
        await debugNPCScript(uri);
    });
    // Register hover provider (simplified)
    const hoverProvider = vscode.languages.registerHoverProvider('npcs', {
        provideHover(document, position, token) {
            try {
                const wordRange = document.getWordRangeAtPosition(position);
                if (!wordRange)
                    return undefined;
                const word = document.getText(wordRange);
                return provideHoverInfo(word);
            }
            catch (error) {
                console.error('Error providing hover info:', error);
                return undefined;
            }
        }
    });
    // Register completion provider (simplified)
    const completionProvider = vscode.languages.registerCompletionItemProvider('npcs', {
        provideCompletionItems(document, position, token, context) {
            try {
                return provideCompletionItems(document, position);
            }
            catch (error) {
                console.error('Error providing completion items:', error);
                return [];
            }
        }
    }, '.', ' ', '(');
    // Register diagnostic provider (on open/change/save)
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('npcs');
    const validateActive = (doc) => {
        if (doc.languageId !== 'npcs')
            return;
        try {
            validateDocument(doc, diagnosticCollection);
        }
        catch (error) {
            console.error('Error validating NPCS document:', error);
        }
    };
    const diagOnOpen = vscode.workspace.onDidOpenTextDocument(validateActive);
    const diagOnChange = vscode.workspace.onDidChangeTextDocument(e => validateActive(e.document));
    const diagOnSave = vscode.workspace.onDidSaveTextDocument(validateActive);
    // Validate already open docs
    vscode.workspace.textDocuments.forEach(validateActive);
    // Register folding provider
    const foldingProvider = vscode.languages.registerFoldingRangeProvider('npcs', new NpcsFoldingProvider());
    context.subscriptions.push(runScriptCommand, debugScriptCommand, hoverProvider, completionProvider, diagOnOpen, diagOnChange, diagOnSave, foldingProvider, diagnosticCollection);
}
exports.activate = activate;
async function runNPCScript(uri) {
    const activeEditor = vscode.window.activeTextEditor;
    const targetUri = uri || activeEditor?.document.uri;
    if (!targetUri) {
        vscode.window.showErrorMessage('No NPCS file to run');
        return;
    }
    const filePath = targetUri.fsPath;
    if (!filePath.endsWith('.npcs')) {
        vscode.window.showErrorMessage('Please select a .npcs file to run');
        return;
    }
    try {
        // Create a terminal to run the script
        const terminal = vscode.window.createTerminal({
            name: 'NPCS Runner',
            cwd: path.dirname(filePath)
        });
        // Check if there's a package.json in the parent directory (your NPCS project)
        const projectRoot = findProjectRoot(filePath);
        if (projectRoot) {
            terminal.sendText(`cd "${projectRoot}"`);
            terminal.sendText(`npm run dev "${filePath}"`);
        }
        else {
            // Fallback: try to run with node directly
            terminal.sendText(`node -e "const npcs = require('./dist/index.js'); console.log('NPCS script runner not configured yet');"`);
        }
        terminal.show();
        vscode.window.showInformationMessage(`Running NPCS script: ${path.basename(filePath)}`);
    }
    catch (error) {
        vscode.window.showErrorMessage(`Failed to run NPCS script: ${error}`);
    }
}
async function debugNPCScript(uri) {
    const activeEditor = vscode.window.activeTextEditor;
    const targetUri = uri || activeEditor?.document.uri;
    if (!targetUri) {
        vscode.window.showErrorMessage('No NPCS file to debug');
        return;
    }
    vscode.window.showInformationMessage('NPCS debugging not yet implemented. This would integrate with your NPCS executor for step-by-step debugging.');
}
function findProjectRoot(filePath) {
    let currentDir = path.dirname(filePath);
    while (currentDir !== path.dirname(currentDir)) {
        const packageJsonPath = path.join(currentDir, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            try {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                if (packageJson.name === 'npc-script' || packageJson.dependencies?.['miniscript-core']) {
                    return currentDir;
                }
            }
            catch (error) {
                // Continue searching
            }
        }
        currentDir = path.dirname(currentDir);
    }
    return null;
}
function provideHoverInfo(word) {
    const builtinFunctions = {
        'print': 'Prints text to the console',
        'len': 'Returns the length of a string or array',
        'str': 'Converts a value to a string',
        'val': 'Converts a string to a number',
        'abs': 'Returns the absolute value of a number',
        'floor': 'Rounds down to the nearest integer',
        'ceil': 'Rounds up to the nearest integer',
        'round': 'Rounds to the nearest integer',
        'sqrt': 'Returns the square root of a number',
        'sin': 'Returns the sine of an angle in radians',
        'cos': 'Returns the cosine of an angle in radians',
        'tan': 'Returns the tangent of an angle in radians',
        'atan': 'Returns the arctangent of a number',
        'atan2': 'Returns the arctangent of y/x',
        'pi': 'Returns the value of π (pi)',
        'rnd': 'Returns a random number between 0 and 1',
        'split': 'Splits a string into an array',
        'join': 'Joins an array into a string',
        'indexOf': 'Returns the index of an item in an array',
        'slice': 'Returns a portion of an array or string',
        'push': 'Adds an item to the end of an array',
        'pop': 'Removes and returns the last item from an array',
        'insert': 'Inserts an item at a specific index in an array',
        'remove': 'Removes an item from an array',
        'sort': 'Sorts an array',
        'shuffle': 'Randomly shuffles an array',
        'sum': 'Returns the sum of all numbers in an array',
        'min': 'Returns the minimum value in an array',
        'max': 'Returns the maximum value in an array',
        'mean': 'Returns the mean (average) of numbers in an array',
        'median': 'Returns the median of numbers in an array',
        'mode': 'Returns the mode of numbers in an array',
        'range': 'Returns an array of numbers from start to end',
        'keys': 'Returns the keys of an object',
        'values': 'Returns the values of an object',
        'hasIndex': 'Checks if an array has an item at a specific index',
        'hasKey': 'Checks if an object has a specific key',
        'type': 'Returns the type of a value',
        'isa': 'Checks if a value is of a specific type',
        'not': 'Logical NOT operator',
        'and': 'Logical AND operator',
        'or': 'Logical OR operator',
        'yield': 'Pauses execution and returns a value with state',
        'true': 'Boolean true value',
        'false': 'Boolean false value',
        'null': 'Null value',
        'undefined': 'Undefined value'
    };
    const keywords = {
        'function': 'Defines a function',
        'end function': 'Ends a function definition',
        'if': 'Conditional statement',
        'then': 'Used with if statements',
        'else': 'Alternative branch for if statements',
        'end if': 'Ends an if statement',
        'while': 'Loop that continues while condition is true',
        'end while': 'Ends a while loop',
        'for': 'Loop that iterates over a collection',
        'in': 'Used with for loops',
        'end for': 'Ends a for loop',
        'break': 'Exits a loop',
        'continue': 'Skips to the next iteration of a loop',
        'return': 'Returns a value from a function'
    };
    const info = builtinFunctions[word] || keywords[word];
    if (info) {
        return new vscode.Hover(new vscode.MarkdownString(`**${word}**\n\n${info}`));
    }
    return undefined;
}
function provideCompletionItems(document, position) {
    const items = [];
    // Built-in functions
    const builtinFunctions = [
        'print', 'len', 'str', 'val', 'abs', 'floor', 'ceil', 'round', 'sqrt',
        'sin', 'cos', 'tan', 'atan', 'atan2', 'pi', 'rnd', 'split', 'join',
        'indexOf', 'slice', 'push', 'pop', 'insert', 'remove', 'sort', 'shuffle',
        'sum', 'min', 'max', 'mean', 'median', 'mode', 'range', 'keys', 'values',
        'hasIndex', 'hasKey', 'type', 'isa', 'not', 'and', 'or', 'yield'
    ];
    builtinFunctions.forEach(func => {
        const item = new vscode.CompletionItem(func, vscode.CompletionItemKind.Function);
        item.detail = 'Built-in function';
        const hoverInfo = provideHoverInfo(func);
        if (hoverInfo && hoverInfo.contents[0]) {
            item.documentation = hoverInfo.contents[0];
        }
        items.push(item);
    });
    // Keywords
    const keywords = [
        'function', 'end function', 'if', 'then', 'else', 'end if',
        'while', 'end while', 'for', 'in', 'end for', 'break', 'continue', 'return'
    ];
    keywords.forEach(keyword => {
        const item = new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Keyword);
        item.detail = 'Keyword';
        items.push(item);
    });
    // Constants
    const constants = ['true', 'false', 'null', 'undefined'];
    constants.forEach(constant => {
        const item = new vscode.CompletionItem(constant, vscode.CompletionItemKind.Constant);
        item.detail = 'Constant';
        items.push(item);
    });
    return items;
}
function validateDocument(document, diagnosticCollection) {
    if (!document || !document.getText) {
        console.warn('Invalid document provided to validateDocument');
        return;
    }
    const diagnostics = [];
    const text = document.getText();
    if (!text) {
        // Empty document, clear diagnostics
        diagnosticCollection.set(document.uri, []);
        return;
    }
    // Structural validation with block stack
    const lines = text.split('\n');
    const stack = [];
    let inBlockComment = false;
    const isCommentOrEmpty = (line) => {
        const t = line.trim();
        return t.length === 0 || t.startsWith('//');
    };
    const stripLineComments = (line) => {
        // remove // comments not inside quotes; quick pass
        let out = '';
        let inSingle = false, inDouble = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            const prev = i > 0 ? line[i - 1] : '';
            if (!inSingle && ch === '"' && prev !== '\\')
                inDouble = !inDouble;
            else if (!inDouble && ch === '\'' && prev !== '\\')
                inSingle = !inSingle;
            if (!inSingle && !inDouble && ch === '/' && line[i + 1] === '/')
                break;
            out += ch;
        }
        return out;
    };
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        let raw = lines[lineIndex];
        // handle block comments /* ... */ across lines
        if (inBlockComment) {
            const endIdx = raw.indexOf('*/');
            if (endIdx >= 0) {
                raw = raw.slice(endIdx + 2);
                inBlockComment = false;
            }
            else {
                continue;
            }
        }
        const startIdx = raw.indexOf('/*');
        if (startIdx >= 0) {
            const endIdx = raw.indexOf('*/', startIdx + 2);
            if (endIdx >= 0) {
                raw = raw.slice(0, startIdx) + raw.slice(endIdx + 2);
            }
            else {
                raw = raw.slice(0, startIdx);
                inBlockComment = true;
            }
        }
        const lineNoComments = stripLineComments(raw);
        const line = lineNoComments.trim();
        if (line.length === 0)
            continue;
        // Patterns
        const ifOpen = /^if\b.*\bthen\b/i;
        const forOpen = /^for\b.*\bin\b/i;
        const doOpen = /^do\b/i;
        const funcOpen = /^(?:[A-Za-z_][A-Za-z0-9_]*\s*=\s*function|function\s+[A-Za-z_][A-Za-z0-9_]*)\b/i;
        const endIf = /^end\s+if\b/i;
        const endFor = /^end\s+for\b/i;
        const endLoop = /^loop\b/i;
        const endFunc = /^end\s+function\b/i;
        const elseLine = /^else\b/i;
        const pushBlock = (type) => stack.push({ type, line: lineIndex });
        const popBlock = (expected, endLen) => {
            const top = stack.pop();
            if (!top || top.type !== expected) {
                const message = `Mismatched end ${expected === 'if' ? 'if' : expected === 'do' ? 'loop' : expected}.` +
                    (top ? ` Found end ${expected === 'if' ? 'if' : expected === 'do' ? 'loop' : expected} while top-of-stack is ${top.type}.` : ' No matching opener.');
                diagnostics.push({
                    range: new vscode.Range(lineIndex, 0, lineIndex, endLen),
                    message,
                    severity: vscode.DiagnosticSeverity.Error
                });
            }
        };
        if (ifOpen.test(line)) {
            // one-liner if: content after 'then' on same line implies no block push
            const afterThen = line.replace(/^[\s\S]*?\bthen\b/i, '').trim();
            if (afterThen.length === 0) {
                pushBlock('if');
            }
            else if (afterThen.startsWith('do')) {
                // Special case: "if x then do" - this is a one-liner if followed by do
                pushBlock('do');
            }
            // else on same line is still part of one-liner, no push/pop needed here
            continue;
        }
        if (forOpen.test(line)) {
            pushBlock('for');
            continue;
        }
        if (doOpen.test(line)) {
            pushBlock('do');
            continue;
        }
        if (funcOpen.test(line)) {
            pushBlock('function');
            continue;
        }
        if (elseLine.test(line)) {
            const top = stack[stack.length - 1];
            if (!top || top.type !== 'if') {
                diagnostics.push({
                    range: new vscode.Range(lineIndex, 0, lineIndex, Math.max(4, lines[lineIndex].length)),
                    message: 'Unexpected else - no matching if',
                    severity: vscode.DiagnosticSeverity.Error
                });
            }
            continue;
        }
        if (endIf.test(line)) {
            popBlock('if', 6);
            continue;
        }
        if (endFor.test(line)) {
            popBlock('for', 7);
            continue;
        }
        if (endLoop.test(line)) {
            popBlock('do', 4);
            continue;
        }
        if (endFunc.test(line)) {
            popBlock('function', 12);
            continue;
        }
        // Check for while clauses outside of do blocks
        if (/^while\b/i.test(line)) {
            const top = stack[stack.length - 1];
            if (!top || top.type !== 'do') {
                diagnostics.push({
                    range: new vscode.Range(lineIndex, 0, lineIndex, Math.max(5, lines[lineIndex].length)),
                    message: 'while clauses are only allowed inside do blocks',
                    severity: vscode.DiagnosticSeverity.Error
                });
            }
            continue;
        }
        // Common syntax warnings
        if (line.includes('===') || line.includes('!==')) {
            diagnostics.push({
                range: new vscode.Range(lineIndex, 0, lineIndex, lines[lineIndex].length),
                message: 'Use == and != instead of === and !== in NPCS',
                severity: vscode.DiagnosticSeverity.Warning
            });
        }
    }
    // Remaining unclosed blocks
    for (const b of stack) {
        const msg = `Unclosed ${b.type} block`;
        diagnostics.push({
            range: new vscode.Range(b.line, 0, b.line, Math.max(1, lines[b.line].length)),
            message: msg,
            severity: vscode.DiagnosticSeverity.Error
        });
    }
    diagnosticCollection.set(document.uri, diagnostics);
}
class NpcsFoldingProvider {
    provideFoldingRanges(document, context, token) {
        const ranges = [];
        const lines = document.getText().split('\n');
        const stack = [];
        let inBlockComment = false;
        const normalize = (s) => s.trim();
        for (let i = 0; i < lines.length; i++) {
            let raw = lines[i];
            if (inBlockComment) {
                const endIdx = raw.indexOf('*/');
                if (endIdx >= 0) {
                    raw = raw.slice(endIdx + 2);
                    inBlockComment = false;
                }
                else {
                    continue;
                }
            }
            const startIdx = raw.indexOf('/*');
            if (startIdx >= 0) {
                const endIdx = raw.indexOf('*/', startIdx + 2);
                if (endIdx >= 0)
                    raw = raw.slice(0, startIdx) + raw.slice(endIdx + 2);
                else {
                    raw = raw.slice(0, startIdx);
                    inBlockComment = true;
                }
            }
            const line = normalize(raw);
            if (!line)
                continue;
            if (/^if\b.*\bthen\b/i.test(line)) {
                const afterThen = line.replace(/^[\s\S]*?\bthen\b/i, '').trim();
                if (afterThen.length === 0) {
                    stack.push({ type: 'if', line: i });
                }
                continue;
            }
            if (/^for\b.*\bin\b/i.test(line)) {
                stack.push({ type: 'for', line: i });
                continue;
            }
            if (/^do\b/i.test(line)) {
                stack.push({ type: 'do', line: i });
                continue;
            }
            if (/^(?:[A-Za-z_][A-Za-z0-9_]*\s*=\s*function|function\s+[A-Za-z_][A-Za-z0-9_]*)\b/i.test(line)) {
                stack.push({ type: 'function', line: i });
                continue;
            }
            if (/^end\s+if\b/i.test(line)) {
                const top = stack.pop();
                if (top && top.type === 'if' && i > top.line)
                    ranges.push(new vscode.FoldingRange(top.line, i));
                continue;
            }
            if (/^end\s+for\b/i.test(line)) {
                const top = stack.pop();
                if (top && top.type === 'for' && i > top.line)
                    ranges.push(new vscode.FoldingRange(top.line, i));
                continue;
            }
            if (/^loop\b/i.test(line)) {
                const top = stack.pop();
                if (top && top.type === 'do' && i > top.line)
                    ranges.push(new vscode.FoldingRange(top.line, i));
                continue;
            }
            if (/^end\s+function\b/i.test(line)) {
                const top = stack.pop();
                if (top && top.type === 'function' && i > top.line)
                    ranges.push(new vscode.FoldingRange(top.line, i));
                continue;
            }
        }
        return ranges;
    }
}
function deactivate() {
    console.log('NPCS Language Support extension is now deactivated');
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map