import {
    SimulationNodeDatum,
} from 'd3-force'
import { produce } from 'immer'

//
// ExitSeekerForce applies on the Exit Drag D3 layer, to nudge the drag target toward valid exit
// connections and away from invalid ones.
//
class ExitSeekerForce<N extends SimulationNodeDatum> extends Object {
    nodes: Record<string, N>
    x: number = 0
    y: number = 0
    iterations: number = 3
    invalidTargets: string[] = []
    id: { (arg: N): string } = ({ index }) => (`${index}`)

    indexNodes: { (nodes: N[]): Record<string, N> } = (nodes) => (nodes.reduce<Record<string, N>>((previous, node) => ({ ...previous, [this.id(node)]: node }), {}))
    reindex(newId: { (arg: N): string }): void {
        this.id = newId
        this.nodes = this.indexNodes(Object.values(this.nodes))
    }

    constructor(nodes: N[]) {
        super()
        this.nodes = this.indexNodes(nodes)
    }

    setNodes(nodes: N[]) {
        this.nodes = this.indexNodes(nodes)
    }

    setX(x: number) {
        this.x = x
    }

    setY(y: number) {
        this.y = y
    }

    setIterations(iterations: number) {
        this.iterations = iterations
    }

    setInvalidTargets(invalidTargets: string[]) {
        this.invalidTargets = invalidTargets
    }

    applyForce(alpha: number) {
        const dragNode = this.nodes['DRAG-TARGET']
        if (dragNode) {
            const mappedNodesById: Record<string, { x: number, y: number, distanceSquared: number, attract: boolean }> = Object.values(this.nodes)
                .filter((node) => (this.id(node) !== 'DRAG-TARGET'))
                .map((node) => {
                    const { fx, fy, x, y } = node
                    const destX = fx ?? x ?? 0
                    const destY = fy ?? y ?? 0
                    const distanceSquared = Math.max(900, Math.pow((this.x || 0) - destX, 2) + Math.pow((this.y || 0) - destY, 2))
                    return { id: this.id(node), x: destX, y: destY, distanceSquared }
                })
                //
                // Convert to addressable in order to tag nodes with existing links (which should repulse
                // rather than attract)
                //
                .reduce<Record<string, { x: number; y: number; distanceSquared: number; attract: boolean }>>(
                    (previous, { id, x, y, distanceSquared }) => ({ ...previous, [id]: { x, y, distanceSquared, attract: true } }), {})
            const mappedNodes = Object.values(produce(mappedNodesById, (draft) => {
                this.invalidTargets.forEach((exit) => {
                    if (draft[exit]) {
                        draft[exit].attract = false
                    }
                })
            }))

            const allNodes: { x: number, y: number, distanceSquared: number, attract: boolean }[] = [
                ...mappedNodes,
                {
                    x: this.x,
                    y: this.y,
                    distanceSquared: 1600,
                    attract: true
                }
            ].sort(({ distanceSquared: a }, { distanceSquared: b }) => (a - b))
            //
            // Repel from anything that is not a valid target
            //
            allNodes
                .filter(({ attract }) => (!attract))
                .forEach(({ x, y }) => {
                    const repelDSquared = Math.pow(x - (dragNode.x || 0), 2) + Math.pow(y - (dragNode.y || 0), 2)
                    if (repelDSquared < 6400) {
                        const strength = 80 - Math.sqrt(repelDSquared)
                        dragNode.vx = (dragNode.vx || 0) + ((dragNode.x || 0) - x) * strength / 80
                        dragNode.vy = (dragNode.vy || 0) + ((dragNode.y || 0) - y) * strength / 80
                    }
                })

            //
            // Attract to anything that could be an exit target
            //
            allNodes
                .filter(({ attract }) => (attract))
                .forEach(({ x, y, distanceSquared }, index) => {
                    dragNode.vx = (dragNode.vx || 0) + (x - (dragNode.x || 0)) * 900 * alpha / (distanceSquared * (index + 1))
                    dragNode.vy = (dragNode.vy || 0) + (y - (dragNode.y || 0)) * 900 * alpha / (distanceSquared * (index + 1))
                })
        }
    }
}

interface ChainableSeekerFunction<N extends SimulationNodeDatum, Arg> {
    (): Arg;
    (arg: Arg): SeekerForceFunction<N>;
}

export interface SeekerForceFunction<N extends SimulationNodeDatum> {
    (alpha: number): void;

    nodes: ChainableSeekerFunction<N, N[]>;
    id: ChainableSeekerFunction<N, { (arg: N): string }>;
    x: ChainableSeekerFunction<N, number>;
    y: ChainableSeekerFunction<N, number>;
    invalidTargets: ChainableSeekerFunction<N, string[]>;
    iterations: ChainableSeekerFunction<N, number>;
}

export const seekerForce = <N extends SimulationNodeDatum>(nodes: N[]): SeekerForceFunction<N> => {
    const seeker = new ExitSeekerForce(nodes)

    const d3EmulationFactory = <T>(getForce: () => SeekerForceFunction<N>, setFunction: (arg: T) => void, getFunction: () => T): ChainableSeekerFunction<N, T> => {
        return ((args?: T) => {
            if (args !== undefined) {
                setFunction(args)
                return getForce()
            }
            return getFunction()
        }) as ChainableSeekerFunction<N, T>
    }

    const force: SeekerForceFunction<N> = Object.assign(
        (alpha: number) => {
            seeker.applyForce(alpha)
        },
        {
            nodes: d3EmulationFactory(() => force, seeker.setNodes.bind(seeker), () => Object.values(seeker.nodes)),
            id: d3EmulationFactory(() => force, seeker.reindex.bind(seeker), () => seeker.id),
            x: d3EmulationFactory(() => force, seeker.setX.bind(seeker), () => seeker.x),
            y: d3EmulationFactory(() => force, seeker.setY.bind(seeker), () => seeker.y),
            invalidTargets: d3EmulationFactory(() => force, seeker.setInvalidTargets.bind(seeker), () => seeker.invalidTargets),
            iterations: d3EmulationFactory(() => force, seeker.setIterations.bind(seeker), () => seeker.iterations)
        }
    )

    return force
}

export default seekerForce
