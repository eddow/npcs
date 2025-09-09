#!/usr/bin/env tsx

import { PauseTestRunner } from './src/pause-test-runner.js';

const runner = new PauseTestRunner();

async function runPauseTest(filename: string) {
	console.log(`\n🧪 Running pause test: ${filename}`);
	console.log('='.repeat(50));
	
	try {
		const result = await runner.runPauseResumeCycle(filename);
		
		if (result.pauseResult.success && result.pauseResult.paused) {
			console.log('✅ Pause successful');
			console.log(`⏱️  Pause time: ${result.pauseResult.executionTime}ms`);
			console.log('\n📤 Pause output:');
			result.pauseResult.output.forEach(line => console.log(`   ${line}`));
			
			if (result.resumeResult.success) {
				console.log('\n✅ Resume successful');
				console.log(`⏱️  Resume time: ${result.resumeResult.executionTime}ms`);
				console.log('\n📤 Resume output:');
				result.resumeResult.output.forEach(line => console.log(`   ${line}`));
				
				if (result.complete) {
					console.log('\n🎉 Complete pause/resume cycle successful!');
				} else {
					console.log('\n⚠️  Execution still paused after resume');
				}
			} else {
				console.log('\n❌ Resume failed');
				console.log(`💥 Error: ${result.resumeResult.error}`);
			}
		} else {
			console.log('❌ Pause failed or not paused');
			if (result.pauseResult.error) {
				console.log(`💥 Error: ${result.pauseResult.error}`);
			}
		}
	} catch (error) {
		console.log('💥 Test error');
		console.log(`   ${error}`);
	}
}

async function main() {
	const args = process.argv.slice(2);
	
	if (args.length === 0) {
		console.log('Usage: tsx run-pause-test.ts <test-name>');
		console.log('\nAvailable pause tests:');
		console.log('  - pause-basic');
		console.log('  - pause-if');
		console.log('  - pause-loop');
		console.log('  - pause-function');
		console.log('  - pause-objects');
		console.log('\nOr run all pause tests:');
		console.log('  - all');
		return;
	}
	
	if (args[0] === 'all') {
		const tests = ['pause-basic', 'pause-if', 'pause-loop', 'pause-function', 'pause-objects'];
		for (const test of tests) {
			await runPauseTest(test);
		}
	} else {
		await runPauseTest(args[0]);
	}
}

main().catch(console.error);
