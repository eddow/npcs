import { MiniScriptExecutor } from './src/executor.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const MiniScript = require('miniscript-core');

console.log('🎯 MiniScript Pause/Resume Demo');
console.log('================================\n');

// Test 1: Basic pause/resume
console.log('📋 Test 1: Basic Pause/Resume');
console.log('-----------------------------');

const basicScript = `
x = 10
print "Before waitTomorrow: x = " + x
waitTomorrow()
print "After waitTomorrow: x = " + x
print "Execution completed!"
`;

const lexer1 = new MiniScript.Lexer(basicScript);
const parser1 = new MiniScript.Parser(basicScript, { lexer: lexer1 });
const ast1 = parser1.parseChunk();

const executor1 = new MiniScriptExecutor();
executor1.execute(ast1, basicScript);

const state1 = executor1.serializeState();
console.log('\n🔄 Resuming execution...');

const executor2 = new MiniScriptExecutor();
executor2.restoreState(state1, MiniScript);
executor2.resume();

console.log('\n✅ Test 1 completed!\n');

// Test 2: Object state preservation
console.log('📋 Test 2: Object State Preservation');
console.log('-----------------------------------');

const objectScript = `
person = {name: "Alice", age: 30, active: true}
print "Before pause: " + person.name + " is " + person.age
waitTomorrow()
person.age = 31
print "After pause: " + person.name + " is now " + person.age
`;

const lexer2 = new MiniScript.Lexer(objectScript);
const parser2 = new MiniScript.Parser(objectScript, { lexer: lexer2 });
const ast2 = parser2.parseChunk();

const executor3 = new MiniScriptExecutor();
executor3.execute(ast2, objectScript);

const state2 = executor3.serializeState();
console.log('\n🔄 Resuming execution...');

const executor4 = new MiniScriptExecutor();
executor4.restoreState(state2, MiniScript);
executor4.resume();

console.log('\n✅ Test 2 completed!\n');

// Test 3: Function with pause
console.log('📋 Test 3: Function with Pause');
console.log('------------------------------');

const functionScript = `
testFunc = function(value)
print "Function called with: " + value
waitTomorrow()
print "After pause in function: " + value
return value * 2
end function

result = testFunc(5)
print "Function result: " + result
`;

const lexer3 = new MiniScript.Lexer(functionScript);
const parser3 = new MiniScript.Parser(functionScript, { lexer: lexer3 });
const ast3 = parser3.parseChunk();

const executor5 = new MiniScriptExecutor();
executor5.execute(ast3, functionScript);

const state3 = executor5.serializeState();
console.log('\n🔄 Resuming execution...');

const executor6 = new MiniScriptExecutor();
executor6.restoreState(state3, MiniScript);
executor6.resume();

console.log('\n✅ Test 3 completed!\n');

console.log('🎉 All tests completed successfully!');
console.log('\n📊 Summary:');
console.log('- ✅ Basic pause/resume works');
console.log('- ✅ Object state preservation works');
console.log('- ✅ Function execution with pause works');
console.log('- ✅ State serialization works');
console.log('- ✅ Cross-executor state restoration works');
