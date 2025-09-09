#!/usr/bin/env tsx

import { MiniScriptTestRunner } from './src/test-runner.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const runner = new MiniScriptTestRunner();

async function runTestFile(filename: string) {
	console.log(`\n🧪 Running test: ${filename}`);
	console.log('='.repeat(50));
	
	try {
		const result = await runner.runFixture(filename);
		
		if (result.success) {
			console.log('✅ Test PASSED');
			console.log(`⏱️  Execution time: ${result.executionTime}ms`);
			console.log('\n📤 Output:');
			result.output.forEach(line => console.log(`   ${line}`));
		} else {
			console.log('❌ Test FAILED');
			console.log(`⏱️  Execution time: ${result.executionTime}ms`);
			console.log('\n📤 Output:');
			result.output.forEach(line => console.log(`   ${line}`));
			console.log('\n💥 Error:');
			console.log(`   ${result.error}`);
		}
	} catch (error) {
		console.log('💥 Test ERROR');
		console.log(`   ${error}`);
	}
}

async function main() {
	const args = process.argv.slice(2);
	
	if (args.length === 0) {
		console.log('Usage: tsx run-test.ts <test-name>');
		console.log('\nAvailable tests:');
		console.log('  - basic');
		console.log('  - functions');
		console.log('  - objects');
		console.log('  - arrays');
		console.log('  - control-flow');
		console.log('  - error-handling');
		console.log('\nOr run all tests:');
		console.log('  - all');
		return;
	}
	
	if (args[0] === 'all') {
		const tests = ['basic', 'functions', 'objects', 'arrays', 'control-flow', 'error-handling'];
		for (const test of tests) {
			await runTestFile(test);
		}
	} else {
		await runTestFile(args[0]);
	}
}

main().catch(console.error);
