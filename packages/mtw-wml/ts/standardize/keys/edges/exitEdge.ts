import { edgeClassFactory } from './edgeFactory'
import { edgeListClassFactory } from './edgeListFactory'

export class StandardExitEdge extends edgeClassFactory('StandardExitEdge') {
    constructor(props: any) {
        super(props)
    }

    override _wrap(instance: any): this {
        return new StandardExitEdge(instance) as this
    }
}

export class ExitEdgeList extends edgeListClassFactory(StandardExitEdge, 'ExitEdgeList') {
    constructor(arg: any) {
        super(arg)
    }

    override _wrap(instance: any): this {
        return new ExitEdgeList(instance) as this
    }
}

export { validateAreaExitSchemaNode } from './edgeFactory'
export type { StandardExitEdgeData, ExitEdgePayloadData } from './dataTypes/exitEdge'
