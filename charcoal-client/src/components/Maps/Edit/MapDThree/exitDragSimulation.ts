import {
    SimulationLinkDatum,
    Simulation,
    forceSimulation
} from 'd3-force'

import { SimNode } from './baseClasses'
import cascadeForce from './cascadeForce'
import exitSeekerForce, { SeekerForceFunction } from './exitSeekerForce'

type MapNodes = SimNode[]

export class ExitDragD3Layer extends Object {
    nodes: MapNodes = []
    getSourceNodes: () => MapNodes
    sourceRoomId: `ROOM#${string}`
    double: boolean = false
    invalidTargets: string[] = []
    ticksLocked: boolean = false
    onTick: (dragTarget: { sourceRoomId: `ROOM#${string}`, x: number, y: number }) => void = () => {}
    simulation: Simulation<SimNode, SimulationLinkDatum<SimNode>>

    constructor(getNodes: () => MapNodes, sourceRoomId: `ROOM#${string}`, double: boolean, invalidTargets: string[]) {
        super()
        this.getSourceNodes = getNodes
        this.sourceRoomId = sourceRoomId
        this.double = double
        this.invalidTargets = invalidTargets
        this.nodes = [
            ...getNodes().map(({ id, fx, fy, x, y }) => ({
                id,
                x: fx ?? x,
                y: fy ?? y,
            })),
            {
                id: 'ROOM#DRAG-TARGET',
                x: 0,
                y: 0
            }
        ]
        this.simulation = forceSimulation(this.nodes)
            .force("cascade", cascadeForce(this.getSourceNodes, this.nodes))
            .force("seeker", exitSeekerForce(this.nodes).id(({ id }) => (id)).invalidTargets(this.invalidTargets))
            .alphaTarget(0.5)
            .alphaDecay(0.15)
            .on("tick", () => {
                if (this.ticksLocked)  {
                    return
                }
                const dragTarget = this.nodes.find(({ id }) => (id === 'ROOM#DRAG-TARGET'))
                if (dragTarget) {
                    const { x, y } = dragTarget
                    this.onTick({ sourceRoomId: this.sourceRoomId, x: x ?? 0, y: y ?? 0 })
                }
            })
    }

    drag(x: number, y: number) {
        this.simulation
            .alpha(1)
        const seekerForce = this.simulation.force("seeker") as SeekerForceFunction<SimNode>
        seekerForce.x(x).y(y)
    }

    endDrag() {
        this.simulation.force("dragX", null).force("dragY", null).alpha(0).tick(1)
        this.ticksLocked = true
        this.onTick({ sourceRoomId: 'ROOM#', x: 0, y: 0 })
    }
}

export default ExitDragD3Layer
