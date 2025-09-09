export interface IOInterface {
	print: (message: string) => void;
	import: (moduleName: string) => any;
}

export class ConsoleIO implements IOInterface {
	print(message: string): void {
		console.log(message);
	}

	import(moduleName: string): any {
		console.log(`Import statement: ${moduleName} (not implemented)`);
		// TODO: Implement actual module loading
		return undefined;
	}
}

export class TestIO implements IOInterface {
	public output: string[] = [];

	print(message: string): void {
		this.output.push(message);
	}

	import(moduleName: string): any {
		this.output.push(`Import statement: ${moduleName} (not implemented)`);
		// TODO: Implement actual module loading
		return undefined;
	}

	clear(): void {
		this.output = [];
	}

	getOutput(): string[] {
		return [...this.output];
	}
}
