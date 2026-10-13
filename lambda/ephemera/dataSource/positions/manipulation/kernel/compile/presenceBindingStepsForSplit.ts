import type { MutationKernelStep } from '../kernelStep'
import type { PositionKernelSplitOp } from './positionKernelOp'

/**
 * A split's one step. Structural only, like `presenceBindingStepsForMove`: the producer
 * (`resolvePresenceSplit`) named every binding and cover, so there is no prior-state read here. Not
 * routed through `compilePositionKernelOp`, which brackets a *move* with captures, narration and
 * dissolved edges, none of which a split has.
 */
export const presenceBindingStepsForSplit = (op: PositionKernelSplitOp): MutationKernelStep[] => [{
    kind: 'splitPresenceBinding',
    hostId: op.whole,
    presence: op.presence,
    splitInto: op.splitInto,
}]
