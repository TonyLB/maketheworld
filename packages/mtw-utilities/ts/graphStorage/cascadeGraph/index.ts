import { unique } from "../../lists";
import { objectMap } from "../../objects";
import { Graph } from "../utils/graph";

type CascadeGraphPriorResult<KeyType extends string, NodeTemplateData extends {}, NodeFetchData extends{}, EdgeTemplateData extends {}, NodeWorkingData extends {}> = {
    key: KeyType;
    edge: EdgeTemplateData;
    fetch: NodeFetchData;
    result: NodeWorkingData;
}

export class CascadeGraphWorkspace<
        KeyType extends string,
        NodeTemplateData extends {},
        NodeFetchData extends {},
        EdgeTemplateData extends {},
        NodeWorkingData extends {}
    > {
    _template: Graph<KeyType, { key: KeyType } & NodeTemplateData, EdgeTemplateData>;
    _working: Graph<KeyType, { key: KeyType } & ({} | NodeFetchData | (NodeFetchData & NodeWorkingData)), {}>;

    constructor(props: {
        template: Graph<KeyType, { key: KeyType } & NodeTemplateData, EdgeTemplateData>;
    }) {
        this._template = props.template
        this._working = new Graph<KeyType, { key: KeyType } & ({} | NodeFetchData | (NodeFetchData & NodeWorkingData)), {}>(Object.assign({}, Object.keys(this._template.nodes).map((key) => ({ [key]: { key }}))) as Record<KeyType, { key: KeyType }>, props.template.edges, {} as Omit<{ key: KeyType }, "key">
        )
    }

}
export class CascadeGraph<KeyType extends string, NodeTemplateData extends {}, NodeFetchData extends {}, EdgeTemplateData extends {}, NodeWorkingData extends {}> {
    _template: Graph<KeyType, { key: KeyType } & NodeTemplateData, EdgeTemplateData>
    _fetch: (nodes: KeyType[]) => Promise<({ key: KeyType } & NodeFetchData)[]>;
    _process: (props: {
            template: { key: KeyType } & NodeTemplateData;
            fetch: NodeFetchData;
            priors: CascadeGraphPriorResult<KeyType, NodeTemplateData, NodeFetchData, EdgeTemplateData, NodeWorkingData>[];
        }) => Promise<NodeWorkingData>;
    _aggregate?: (graph: CascadeGraphWorkspace<KeyType, NodeTemplateData, NodeFetchData, EdgeTemplateData, NodeWorkingData>) => Promise<CascadeGraphWorkspace<KeyType, NodeTemplateData, NodeFetchData, EdgeTemplateData, NodeWorkingData>>;

    constructor(props: {
        template: Graph<KeyType, { key: KeyType } & NodeTemplateData, EdgeTemplateData>;
        fetch: (nodes: KeyType[]) => Promise<({ key: KeyType } & NodeFetchData)[]>;
        process: (props: {
                template: { key: KeyType } & NodeTemplateData;
                fetch: NodeFetchData;
                priors: CascadeGraphPriorResult<KeyType, NodeTemplateData, NodeFetchData, EdgeTemplateData, NodeWorkingData>[];
            }) => Promise<NodeWorkingData>;
        aggregate?: (graph: CascadeGraphWorkspace<KeyType, NodeTemplateData, NodeFetchData, EdgeTemplateData, NodeWorkingData>) => Promise<CascadeGraphWorkspace<KeyType, NodeTemplateData, NodeFetchData, EdgeTemplateData, NodeWorkingData>>;
    }) {
        this._template = props.template
        this._fetch = props.fetch
        this._process = props.process
        this._aggregate = props.aggregate
    }

    async execute(): Promise<void> {
        const generationOrderOutput = this._template.generationOrder()
        const stronglyConnectedComponentByContents = generationOrderOutput.flat(1).reduce<Partial<Record<KeyType, KeyType>>>(
            (previous, stronglyConnectedComponent) => (stronglyConnectedComponent.reduce<Partial<Record<KeyType, KeyType>>>((aggregator, key) => ({ ...aggregator, [key]: stronglyConnectedComponent[0] }), previous)),
            {}
        )

        //
        // TODO: Refactor code borrowed from sortedWalk to:
        //    - fetch all nodes in the current generation
        //    - Create a promise to process each stronglyConnectedComponent
        //
        let resultPromises: Partial<Record<KeyType, Promise<NodeWorkingData>>> = {}
        const workspace = new CascadeGraphWorkspace<KeyType, NodeTemplateData, NodeFetchData, EdgeTemplateData, NodeWorkingData>({
            template: this._template,
        })
        for (const generation of generationOrderOutput) {
            const fetchedNodes = await this._fetch(unique(generation.flat(1)))
            fetchedNodes.forEach(({ key, ...nodeData }) => {
                workspace._working.setNode(key, { key, ...nodeData })
            })
            for (const stronglyConnectedComponent of generation) {
                //
                // Find all Edges leading from *outside* keys to *inside* keys. By definition of generationOrder,
                // all those exits should lead to keys that have already been processed, and (therefore) have promises
                // in the resultPromises records defined above.  Collect all unique SCC representatives that this new set of
                // keys depends from, and deliver the saved Previous outputs to the callback.
                //
                resultPromises[stronglyConnectedComponent[0]] = (async (): Promise<NodeWorkingData> => {
                    if (stronglyConnectedComponent.length === 0) {
                        throw new Error('CascadeGraph error, empty strongly-connected-component encountered')
                    }
                    //
                    // TODO: Refactor for more generalized case, where processing occurs on stronglyConnectedComponents
                    // simultaneously
                    //
                    if (stronglyConnectedComponent.length > 1) {
                        throw new Error('CascadeGraph error, circular dependency encountered')
                    }
                    const key = stronglyConnectedComponent[0]

                    //
                    // Wait for all needed prior results to have their promises evaluated (which will
                    // result in their data being assigned into the workspace graph) so that their data
                    // is available for next stage processing.
                    //
                    const dependencyEdges = this._template.edges
                        .filter(({ to }) => (stronglyConnectedComponent.includes(to)))
                        .filter(({ from }) => (!stronglyConnectedComponent.includes(from)))
                    const dependencyResultPromises = unique(dependencyEdges.map(({ from }) => (from)))
                        .map((dependency) => (stronglyConnectedComponentByContents[dependency]))
                        .map((stronglyConnectedComponentRepresentative) => (
                            stronglyConnectedComponentRepresentative &&
                            resultPromises[stronglyConnectedComponentRepresentative]
                        ))
                        .filter((results) => (typeof results !== 'undefined'))
                    await Promise.all(dependencyResultPromises)

                    const nodeTemplateData = this._template.nodes[key]
                    if (typeof nodeTemplateData === 'undefined') {
                        throw new Error('CascadeGraph error, internal key call out of bounds')
                    }
                    return await this._process({
                            template: nodeTemplateData as { key: KeyType } & NodeTemplateData,
                            fetch: workspace._working.nodes[key] as { key: KeyType } & NodeFetchData,
                            priors: dependencyEdges.map(({ from, to, ...edge }) => ({
                                key: from,
                                fetch: workspace._working.nodes[from] as { key: KeyType } & NodeFetchData,
                                edge: edge as unknown as EdgeTemplateData,
                                result: workspace._working.nodes[from] as NodeWorkingData,
                            }))
                        }).then((results: NodeWorkingData) => {
                            workspace._working.setNode(key, { key, ...results })
                            return results
                        })
                })()
            }
        }
        await Promise.all(Object.values(resultPromises))
    }
}

export default CascadeGraph