"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const vscode_textmate_1 = require("vscode-textmate");
const vscode_oniguruma_1 = require("vscode-oniguruma");
async function loadOnig() {
    const wasmPath = require.resolve('vscode-oniguruma/release/onig.wasm');
    const wasmBin = node_fs_1.default.readFileSync(wasmPath).buffer;
    await (0, vscode_oniguruma_1.loadWASM)(wasmBin);
}
async function loadGrammar(grammarPath) {
    const registry = new vscode_textmate_1.Registry({
        onigLib: Promise.resolve({
            createOnigScanner(patterns) { return new vscode_oniguruma_1.OnigScanner(patterns); },
            createOnigString(s) { return new vscode_oniguruma_1.OnigString(s); },
        }),
        loadGrammar: async (scopeName) => {
            if (scopeName !== 'source.npcs')
                return null;
            const raw = node_fs_1.default.readFileSync(grammarPath, 'utf-8');
            return JSON.parse(raw);
        },
    });
    const grammar = await registry.loadGrammar('source.npcs');
    if (!grammar)
        throw new Error('Failed to load grammar');
    return grammar;
}
function printTokens(line, tokens) {
    const parts = [];
    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        const text = line.slice(t.startIndex, t.endIndex);
        parts.push(`${JSON.stringify(text)} => ${t.scopes.join(' ')} [${t.startIndex},${t.endIndex}]`);
    }
    console.log(parts.join('\n'));
}
async function main() {
    const file = process.argv[2];
    if (!file) {
        console.error('Usage: npm run tm:tokenize -- <file>');
        process.exit(1);
    }
    const abs = node_path_1.default.resolve(file);
    const grammarPath = node_path_1.default.resolve(__dirname, '..', 'syntaxes', 'npcs.tmLanguage.json');
    await loadOnig();
    const grammar = await loadGrammar(grammarPath);
    const source = node_fs_1.default.readFileSync(abs, 'utf-8');
    const lines = source.split(/\r?\n/);
    let ruleStack = null;
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
        const line = lines[lineNumber];
        const { tokens, ruleStack: next } = grammar.tokenizeLine(line, ruleStack);
        process.stdout.write(`${lineNumber + 1}: ${line}\n`);
        printTokens(line, tokens);
        ruleStack = next;
    }
}
main().catch((err) => { console.error(err); process.exit(1); });
//# sourceMappingURL=tm-tokenize.js.map