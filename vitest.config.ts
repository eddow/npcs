import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		include: ['tests/**/*.test.ts'],
		exclude: ['node_modules', 'dist'],
		reporters: ['verbose', 'json'],
		outputFile: {
			json: './test-results.json'
		}
	},
	resolve: {
		alias: {
			'@': './src'
		}
	}
});
