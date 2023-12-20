import { NormalReference } from '@tonylb/mtw-wml/dist/normalize/baseClasses';
import {
    SimulationNodeDatum,
    SimulationLinkDatum
} from 'd3-force'

export type SimNode = SimulationNodeDatum & {
    id: string;
    cascadeNode: boolean;
    roomId: string;
    visible: boolean;
    reference: NormalReference;
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
    links: (SimulationLinkDatum<SimNode> & { id: string })[]
}

export type SimCallback = (nodes: SimNode[]) => void

export type MapNodes = SimNode[]
export type MapLinks = SimulationLinkDatum<SimulationNodeDatum>[]

export interface MapLayerRoom {
    id: string;
    roomId: string;
    x: number;
    y: number;
}

export interface MapLayer {
    key: string;
    rooms: Record<string, MapLayerRoom>;
    roomVisibility: Record<string, boolean>;
}
