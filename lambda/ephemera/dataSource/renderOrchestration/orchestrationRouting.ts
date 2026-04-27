import type { Perspective } from '@tonylb/mtw-interfaces/ts/perspective'
import type { RenderComponentId } from '../../messageBus/baseClasses'
import type { RenderOrchestrationPublishedRouting } from './publishedEvents'

export const buildOrchestrationRouting = (
    componentId: RenderComponentId,
    perspective: Perspective,
    computePerspectiveKey: (assetStack: Perspective['assetStack']) => string
): RenderOrchestrationPublishedRouting => ({
    componentId,
    perspective,
    perspectiveKey: computePerspectiveKey(perspective.assetStack),
})
