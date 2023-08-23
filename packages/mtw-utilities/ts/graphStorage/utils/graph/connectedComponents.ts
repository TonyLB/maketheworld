//
// connectedComponents takes a Graph object and returns an array of sub-graphs, each wholly connected,
// and together spanning the entire original graph.
//

import { Graph } from "."
import { v4 as uuidv4 } from 'uuid'

const compareComponents = <K extends string, T extends { key: K } & Record<string, any>, E extends Record<string, any>>(A: Graph<K, T, E>, B: Graph<K, T, E>): number => {
    const firstA = Object.keys(A.nodes).sort()[0]
    const firstB = Object.keys(B.nodes).sort()[0]
    return firstA.localeCompare(firstB)
}

export const connectedComponents = <K extends string, T extends { key: K } & Record<string, any>, E extends Record<string, any>>(graph: Graph<K, T, E>): Graph<K, T, E>[] => {
    let componentLabels: Partial<Record<K, string | undefined>> = {}
    const graphKeys = Object.keys(graph.nodes) as K[]
    graphKeys.forEach((key) => {
        const component = componentLabels[key] || ''
        if (!component) {
            const newComponent = uuidv4()
            graph.simpleWalk(key, (key) => { componentLabels[key] = newComponent })
        }
    })

    const keysByComponent = (Object.entries(componentLabels) as [K, string | undefined][]).reduce<Record<string, K[]>>((previous, [key, component]) => (
        component
        ? {
            ...previous,
            [component]: [...(previous[component] || []), key as K]
        }
        : previous
    ), {})

    return Object.values(keysByComponent).map((keys) => (graph.filter({ keys }))).sort(compareComponents)
}

export default connectedComponents
