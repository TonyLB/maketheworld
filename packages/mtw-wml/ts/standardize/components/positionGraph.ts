import { ReferenceList } from "./reference"
import StandardReference from "../keys/reference"
import {
    PositionGraphNodeTag,
    StandardPositionGraphData,
} from "./dataTypes/positionGraph"

export class StandardPositionGraph {
    _nodes: ReferenceList

    constructor(arg?: StandardPositionGraph | StandardPositionGraphData | ReferenceList) {
        if (arg instanceof StandardPositionGraph) {
            this._nodes = new ReferenceList(arg._nodes)
            return
        }
        if (arg instanceof ReferenceList) {
            this._nodes = new ReferenceList(arg)
            return
        }
        if (arg && typeof arg === 'object' && 'nodes' in arg) {
            const data = arg as StandardPositionGraphData
            this._nodes = new ReferenceList(
                data.nodes?.map((reference) => new StandardReference(reference)) ?? []
            )
            return
        }
        this._nodes = new ReferenceList([])
    }

    static fromJSON(data?: StandardPositionGraphData): StandardPositionGraph {
        return new StandardPositionGraph(data)
    }

    get nodes(): ReferenceList {
        return this._nodes
    }

    toJSON(): StandardPositionGraphData | undefined {
        if (!this._nodes.payload.length) {
            return undefined
        }
        return { nodes: this._nodes.toJSON() }
    }

    merge(other: StandardPositionGraph): StandardPositionGraph {
        return new StandardPositionGraph(
            this._nodes.merge(other._nodes) ?? new ReferenceList([])
        )
    }

    diff(other: StandardPositionGraph): StandardPositionGraph | undefined {
        const diffed = this._nodes.diff(other._nodes) ?? new ReferenceList([])
        if (diffed.isEmpty()) {
            return undefined
        }
        return new StandardPositionGraph(diffed)
    }

    equals(other: StandardPositionGraph): boolean {
        if (!(other instanceof StandardPositionGraph)) {
            return false
        }
        return this._nodes.equals(other._nodes)
    }

    clone(): StandardPositionGraph {
        return new StandardPositionGraph(this)
    }

    nodesByTag(tag: PositionGraphNodeTag): ReferenceList {
        return this._nodes.filter((item) => item.tag === tag)
    }
}

export default StandardPositionGraph
