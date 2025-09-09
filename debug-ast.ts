import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const MiniScript = require('miniscript-core');

const code = `
flag = true
if flag then
	print "flag is true"
else
	print "flag is false"
end if
`;

const lexer = new MiniScript.Lexer(code);
const parser = new MiniScript.Parser(code, { lexer });
const ast = parser.parseChunk();

console.log('AST structure:');
console.log('Body length:', ast.body.length);
if (ast.body.length > 1) {
	const ifStatement = ast.body[1];
	console.log('If statement type:', ifStatement.constructor.name);
	console.log('Clauses length:', ifStatement.clauses?.length);
	if (ifStatement.clauses) {
		ifStatement.clauses.forEach((clause: any, index: number) => {
			console.log(`Clause ${index}:`, {
				condition: clause.condition,
				bodyLength: clause.body?.length
			});
		});
	}
}
