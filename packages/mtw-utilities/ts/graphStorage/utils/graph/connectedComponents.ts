//
// connectedComponents takes a Graph object and returns an array of sub-graphs, each wholly connected,
// and together spanning the entire original graph.
//

import { Graph } from "."
import { objectMap } from "../../../objects"
import { v4 as uuidv4 } from 'uuid'

type ComponentLabelNode <K extends string> = { key: K, component?: string }

const compareComponents = <K extends string, T extends { key: K } & Record<string, any>>(A: Graph<K, T>, B: Graph<K, T>): number => {
    const firstA = Object.keys(A.nodes).sort()[0]
    const firstB = Object.keys(B.nodes).sort()[0]
    return firstA.localeCompare(firstB)
}

export const connectedComponents = <K extends string, T extends { key: K } & Record<string, any>>(graph: Graph<K, T>): Graph<K, T>[] => {
    const componentLabels = new Graph<K, ComponentLabelNode<K>>(
        objectMap<T, ComponentLabelNode<K>>(graph.nodes as Record<string, T>, ({ key }): ComponentLabelNode<K>  => ({ key })) as Record<K, T>,
        graph.edges
    )
    const graphKeys = Object.keys(graph.nodes) as K[]
    graphKeys.forEach((key) => {
        const { component } = componentLabels.getNode(key)?.node || {}
        if (!component) {
            const newComponent = uuidv4()
            graph.simpleWalk(key, (key) => { componentLabels.setNode(key, { key, component: newComponent })})
        }
    })

    const keysByComponent = (Object.entries(componentLabels.nodes) as [K, ComponentLabelNode<K>][]).reduce<Record<string, K[]>>((previous, [key, { component }]) => (
        component
        ? {
            ...previous,
            [component]: [...(previous[component] || []), key as K]
        }
        : previous
    ), {})

    return Object.values(keysByComponent).map((keys) => (graph.subGraph(keys))).sort(compareComponents)
}

export default connectedComponents
