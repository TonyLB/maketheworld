import { ReferenceList } from "./reference"
import StandardReference from "../keys/reference"
import {
    LudicGraphNodeTag,
    LudicGraphPortListData,
    StandardLudicGraphData,
} from "./dataTypes/ludicGraph"
import { LudicEdgeList } from "../keys/edges/ludicEdge"
import { LudicGraphNodeList, LudicGraphPresenceNode } from "./ludicGraphNodeList"

export class StandardLudicGraph {
    _rootId?: StandardReference
    _nodes: LudicGraphNodeList
    _edges: LudicEdgeList
    _ports: LudicGraphPortListData

    constructor(arg?: StandardLudicGraph | StandardLudicGraphData | ReferenceList) {
        if (arg instanceof StandardLudicGraph) {
            this._rootId = arg._rootId?.clone()
            this._nodes = new LudicGraphNodeList(arg._nodes)
            this._edges = new LudicEdgeList(arg._edges)
            this._ports = [...arg._ports]
            return
        }
        if (arg instanceof ReferenceList) {
            this._nodes = new LudicGraphNodeList(arg)
            this._edges = new LudicEdgeList([])
            this._ports = []
            return
        }
        if (arg && typeof arg === 'object' && ('rootId' in arg || 'nodes' in arg || 'edges' in arg || 'ports' in arg)) {
            const data = arg as StandardLudicGraphData
            this._rootId = data.rootId !== undefined ? new StandardReference(data.rootId) : undefined
            this._nodes = new LudicGraphNodeList(data.nodes ?? [])
            this._edges = new LudicEdgeList(data.edges ?? [])
            this._ports = data.ports ? [...data.ports] : []
            return
        }
        this._nodes = new LudicGraphNodeList([])
        this._edges = new LudicEdgeList([])
        this._ports = []
    }

    static fromJSON(data?: StandardLudicGraphData): StandardLudicGraph {
        return new StandardLudicGraph(data)
    }

    get rootId(): StandardReference | undefined {
        return this._rootId
    }

    get nodes(): LudicGraphNodeList {
        return this._nodes
    }

    get presenceNodes(): LudicGraphPresenceNode[] {
        return this._nodes.presenceNodes
    }

    get edges(): LudicEdgeList {
        return this._edges
    }

    get ports(): LudicGraphPortListData {
        return [...this._ports]
    }

    toJSON(): StandardLudicGraphData | undefined {
        const nodesJSON = this._nodes.payload.length ? this._nodes.toJSON() : undefined
        const edgesJSON = this._edges.length ? this._edges.toJSON() : undefined
        const portsJSON = this._ports.length ? [...this._ports] : undefined
        if (!this._rootId && !nodesJSON && !edgesJSON && !portsJSON) {
            return undefined
        }
        return {
            ...(this._rootId ? { rootId: this._rootId.toJSON() } : {}),
            ...(nodesJSON ? { nodes: nodesJSON } : {}),
            ...(edgesJSON ? { edges: edgesJSON } : {}),
            ...(portsJSON ? { ports: portsJSON } : {}),
        }
    }

    merge(other: StandardLudicGraph): StandardLudicGraph {
        const mergedNodes = this._nodes.merge(other._nodes) ?? new LudicGraphNodeList([])
        const mergedEdges = this._edges.merge(other._edges) ?? new LudicEdgeList([])
        return new StandardLudicGraph({
            ...(other._rootId ?? this._rootId ? { rootId: (other._rootId ?? this._rootId)!.toJSON() } : {}),
            nodes: mergedNodes.toJSON(),
            edges: mergedEdges.toJSON(),
            ports: [...this._ports, ...other._ports.filter((port) => !this._ports.some((existing) => existing.portId === port.portId))],
        })
    }

    diff(other: StandardLudicGraph): StandardLudicGraph | undefined {
        const diffedNodes = this._nodes.diff(other._nodes) ?? new LudicGraphNodeList([])
        const diffedEdges = this._edges.diff(other._edges) ?? new LudicEdgeList([])
        if (diffedNodes.isEmpty() && diffedEdges.isEmpty()) {
            return undefined
        }
        return new StandardLudicGraph({
            ...(diffedNodes.payload.length ? { nodes: diffedNodes.toJSON() } : {}),
            ...(diffedEdges.length ? { edges: diffedEdges.toJSON() } : {}),
        })
    }

    equals(other: StandardLudicGraph): boolean {
        if (!(other instanceof StandardLudicGraph)) {
            return false
        }
        const rootIdEqual = Boolean(this._rootId) === Boolean(other._rootId) &&
            (!this._rootId || this._rootId.sameKey(other._rootId!))
        return rootIdEqual && this._nodes.equals(other._nodes) && this._edges.equals(other._edges)
    }

    clone(): StandardLudicGraph {
        return new StandardLudicGraph(this)
    }

    nodesByTag(tag: LudicGraphNodeTag): ReferenceList {
        const rootId = this._rootId
        return this._nodes.componentRefs.filter((item) => item.tag === tag && !(rootId && item.sameKey(rootId)))
    }
}

export default StandardLudicGraph
