import {
    SimulationNodeDatum,
} from 'd3-force'

//
// CascadeForce links together D3 simulations that are layered over each other in a read-only-from-previous fashion.
// At each iteration it finds all data from previous (read-only) layers and overrides any duplicate nodes
// with fx/fy data.
//
// Because of this, you can have layer A acting in ignorance of layer B, but have layer B respond to changes in
// layer A (by cascading those changes forward)
//
class CascadeForce<N extends SimulationNodeDatum> extends Object {
    sourceNodes: () => N[]
    targetNodes: Record<string, N>
    id: { (arg: N): string } = ({ index }) => (`${index}`)

    indexNodes: { (nodes: N[]): Record<string, N> } = (nodes) => (nodes.reduce<Record<string, N>>((previous, node) => ({ ...previous, [this.id(node)]: node }), {}))
    reindex(newId: { (arg: N): string }): void {
        this.id = newId
        this.targetNodes = this.indexNodes(Object.values(this.targetNodes))
    }

    constructor(sourceNodes: () => N[], targetNodes: N[]) {
        super()
        this.sourceNodes = sourceNodes
        this.targetNodes = this.indexNodes(targetNodes)
    }

    setSourceNodes(sourceNodes: () => N[]) {
        this.sourceNodes = sourceNodes
    }

    setTargetNodes(targetNodes: N[]) {
        this.targetNodes = this.indexNodes(targetNodes)
    }

    applyForce() {
        this.sourceNodes().forEach((node) => {
            const sourceId = this.id(node)
            if (sourceId && this.targetNodes[sourceId]) {
                this.targetNodes[sourceId].fx = node.fx ?? node.x
                this.targetNodes[sourceId].fy = node.fy ?? node.y
            }
        })
    }
}

interface ChainableCascadeFunction<N extends SimulationNodeDatum, Arg> {
    (): Arg;
    (arg: Arg): CascadeForceFunction<N>;
}

interface CascadeForceFunction<N extends SimulationNodeDatum> {
    (alpha: number): void;

    sourceNodes: ChainableCascadeFunction<N, () => N[]>;
    targetNodes: ChainableCascadeFunction<N, N[]>;
    id: ChainableCascadeFunction<N, { (arg: N): string }>;
}

export const cascadeForce = <N extends SimulationNodeDatum>(sourceNodes: () => N[], targetNodes: N[]): CascadeForceFunction<N> => {
    const cascade = new CascadeForce(sourceNodes, targetNodes)

    const d3EmulationFactory = <T>(getForce: () => CascadeForceFunction<N>, setFunction: (arg: T) => void, getFunction: () => T): ChainableCascadeFunction<N, T> => {
        return ((args?: T) => {
            if (args !== undefined) {
                setFunction(args)
                return getForce()
            }
            return getFunction()
        }) as ChainableCascadeFunction<N, T>
    }

    const force: CascadeForceFunction<N> = Object.assign(
        () => {
            cascade.applyForce()
        },
        {
            sourceNodes: d3EmulationFactory(() => force, cascade.setSourceNodes.bind(cascade), () => cascade.sourceNodes),
            targetNodes: d3EmulationFactory(() => force, cascade.setTargetNodes.bind(cascade), () => Object.values(cascade.targetNodes)),
            id: d3EmulationFactory(() => force, cascade.reindex.bind(cascade), () => cascade.id)
        }
    )

    return force
}

export default cascadeForce
