import {
    SimulationNodeDatum,
    SimulationLinkDatum
} from 'd3-force'

export type SimNode = SimulationNodeDatum & {
    id: string;
    zLevel?: number;
    cascadeNode: boolean;
    roomId: string;
    visible: boolean;
}
export type NodeRecord = Record<string, SimNode>
export type LinkRecord = {
    id: string,
    source: string,
    target: string,
    visible?: boolean
}[]
export type SimulationReturn = {
    key: string,
    nodes: SimNode[],
    links: SimulationLinkDatum<SimNode>[]
}

export type SimCallback = (nodes: SimNode[]) => void

export type MapNodes = SimNode[]
export type MapLinks = SimulationLinkDatum<SimulationNodeDatum>[]
