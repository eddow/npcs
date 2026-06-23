import type { Token } from '../lexer/token'
import type {
	ASTAssignmentStatement,
	ASTBase,
	ASTChunk,
	ASTDoWhileLoop,
	ASTElseClause,
	ASTForGenericStatement,
	ASTFunctionStatement,
	ASTIfClause,
	ASTIfStatement,
	ASTPlanStatement,
	ASTType,
} from './ast'
import type { LineRegistry } from './line-registry'

type PendingBlockCompleteCallback = (pendingBlock: PendingBlock) => void | null

export enum PendingBlockType {
	Chunk,
	For,
	Function,
	If,
	DoWhileLoop,
	Plan,
}

export interface PendingBlock {
	block: ASTBase
	body: ASTBase[]
	type: PendingBlockType
	onComplete?: PendingBlockCompleteCallback

	complete(endToken: Token): void
}

abstract class PendingBlockBase {
	protected lineRegistry: LineRegistry

	block: ASTBase
	body: ASTBase[]
	type: PendingBlockType
	onComplete?: PendingBlockCompleteCallback

	constructor(block: ASTBase, type: PendingBlockType, lineRegistry: LineRegistry) {
		this.lineRegistry = lineRegistry
		this.block = block
		this.body = []
		this.type = type
	}

	complete(_endToken: Token): void {
		this.onComplete?.(this)
	}
}

export function isPendingChunk(pendingBlock: PendingBlock): pendingBlock is PendingChunk {
	return pendingBlock.type === PendingBlockType.Chunk
}

export class PendingChunk extends PendingBlockBase implements PendingBlock {
	declare block: ASTChunk

	constructor(block: ASTChunk, lineRegistry: LineRegistry) {
		super(block, PendingBlockType.Chunk, lineRegistry)
	}

	complete(endToken: Token): void {
		this.block.body = this.body
		this.block.end = endToken.end
		this.block.range = [this.block.range[0], endToken.range[1]]
		super.complete(endToken)
	}
}

export function isPendingFor(pendingBlock: PendingBlock): pendingBlock is PendingFor {
	return pendingBlock.type === PendingBlockType.For
}

export class PendingFor extends PendingBlockBase implements PendingBlock {
	declare block: ASTForGenericStatement

	constructor(block: ASTForGenericStatement, lineRegistry: LineRegistry) {
		super(block, PendingBlockType.For, lineRegistry)
		this.lineRegistry.addItemToLine(this.block.start!.line, this.block)
	}

	complete(endToken: Token): void {
		this.block.body = this.body
		this.block.end = endToken.end
		this.block.range = [this.block.range[0], endToken.range[1]]
		this.lineRegistry.addItemToLine(endToken.end.line, this.block)
		super.complete(endToken)
	}
}

export function isPendingFunction(pendingBlock: PendingBlock): pendingBlock is PendingFunction {
	return pendingBlock.type === PendingBlockType.Function
}

export class PendingFunction extends PendingBlockBase implements PendingBlock {
	declare block: ASTFunctionStatement

	private base: ASTBase | null
	public namedFunctionAssignment: ASTAssignmentStatement | null = null

	constructor(block: ASTFunctionStatement, base: ASTBase | null, lineRegistry: LineRegistry) {
		super(block, PendingBlockType.Function, lineRegistry)
		this.base = base
		this.lineRegistry.addItemToLine(this.block.start!.line, this.block)
	}

	complete(endToken: Token): void {
		this.block.body = this.body
		this.block.end = endToken.end
		this.block.range = [this.block.range[0], endToken.range[1]]

		// If this is a named function, finalize the assignment statement
		if (this.namedFunctionAssignment) {
			this.namedFunctionAssignment.end = endToken.end
			this.namedFunctionAssignment.range[1] = endToken.range[1]
			this.lineRegistry.addItemToLine(
				this.namedFunctionAssignment.end!.line,
				this.namedFunctionAssignment,
			)
		} else if (this.base !== null) {
			this.base.end = this.block.end
			this.base.range[1] = this.block.range[1]
			this.lineRegistry.addItemToLine(this.base.end.line, this.base)
		} else {
			this.lineRegistry.addItemToLine(this.block.end.line, this.block)
		}

		super.complete(endToken)
	}
}

export function isPendingIf(pendingBlock: PendingBlock): pendingBlock is PendingIf {
	return pendingBlock.type === PendingBlockType.If
}

export type PendingClauseType = ASTType.ElseifClause | ASTType.ElseClause

export class PendingIf extends PendingBlockBase implements PendingBlock {
	declare block: ASTIfStatement
	currentClause: ASTIfClause | ASTElseClause
	onCompleteCallback?: PendingBlockCompleteCallback

	constructor(block: ASTIfStatement, current: ASTIfClause, lineRegistry: LineRegistry) {
		super(block, PendingBlockType.If, lineRegistry)
		this.lineRegistry.addItemToLine(this.block.start!.line, this.block)
		this.currentClause = current
	}

	private addCurrentClauseToLineRegistry(): void {
		if (this.currentClause.start!.line === this.block.start!.line) {
			return
		}

		this.lineRegistry.addItemToLine(this.currentClause.start!.line, this.block)
	}

	next(endToken: Token): void {
		this.currentClause.body = this.body
		this.currentClause.end = endToken.end
		this.currentClause.range = [this.currentClause.range[0], endToken.range[1]]
		this.addCurrentClauseToLineRegistry()
		this.block.clauses.push(this.currentClause)
		super.complete(endToken)
		this.body = []
	}

	complete(endToken: Token): void {
		if (this.body.length > 0) this.next(endToken)
		this.block.end = endToken.end
		this.block.range = [this.block.range[0], endToken.range[1]]
		this.lineRegistry.addItemToLine(this.block.end!.line, this.block)
		super.complete(endToken)
	}
}

export function isPendingDoWhileLoop(
	pendingBlock: PendingBlock,
): pendingBlock is PendingDoWhileLoop {
	return pendingBlock.type === PendingBlockType.DoWhileLoop
}

export class PendingDoWhileLoop extends PendingBlockBase implements PendingBlock {
	declare block: ASTDoWhileLoop

	constructor(block: ASTDoWhileLoop, lineRegistry: LineRegistry) {
		super(block, PendingBlockType.DoWhileLoop, lineRegistry)
		this.lineRegistry.addItemToLine(this.block.start!.line, this.block)
	}

	complete(endToken: Token): void {
		// Set the main block body
		this.block.mainBlock.body = this.body
		this.block.mainBlock.end = endToken.end
		this.block.mainBlock.range = [this.block.mainBlock.range[0], endToken.range[1]]

		// Set the do-while-loop end
		this.block.end = endToken.end
		this.block.range = [this.block.range[0], endToken.range[1]]

		this.lineRegistry.addItemToLine(endToken.end.line, this.block)
		super.complete(endToken)
	}
}

export function isPendingPlan(pendingBlock: PendingBlock): pendingBlock is PendingPlan {
	return pendingBlock.type === PendingBlockType.Plan
}

export class PendingPlan extends PendingBlockBase implements PendingBlock {
	declare block: ASTPlanStatement

	constructor(block: ASTPlanStatement, lineRegistry: LineRegistry) {
		super(block, PendingBlockType.Plan, lineRegistry)
		this.lineRegistry.addItemToLine(this.block.start!.line, this.block)
	}

	complete(endToken: Token): void {
		this.block.body = this.body
		this.block.end = endToken.end
		this.block.range = [this.block.range[0], endToken.range[1]]
		this.lineRegistry.addItemToLine(endToken.end.line, this.block)
		super.complete(endToken)
	}
}
