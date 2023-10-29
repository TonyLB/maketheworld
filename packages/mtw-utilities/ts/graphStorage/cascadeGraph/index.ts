import { unique } from "../../lists"
import { Graph } from "../utils/graph"

type CascadeGraphWorkingResult<KeyType extends string, NodeTemplateData extends {}, NodeFetchData extends{}, EdgeTemplateData extends {}, NodeWorkingData extends {}> = {
    key: KeyType;
    fetch?: NodeFetchData;
    result?: NodeWorkingData;
}

type CascadeGraphPriorResult<KeyType extends string, NodeTemplateData extends {}, NodeFetchData extends{}, EdgeTemplateData extends {}, NodeWorkingData extends {}> = CascadeGraphWorkingResult<KeyType, NodeTemplateData, NodeFetchData, EdgeTemplateData, NodeWorkingData> & {
    edge: EdgeTemplateData;
}

type CascadeGraphBaseTemplate = {
    needsFetch?: boolean;
    needsProcessing?: boolean;
}

export class CascadeGraphWorkspace<
        KeyType extends string,
        NodeTemplateData extends CascadeGraphBaseTemplate,
        NodeFetchData extends {},
        EdgeTemplateData extends {},
        NodeWorkingData extends {}
    > {
    _template: Graph<KeyType, { key: KeyType } & NodeTemplateData, EdgeTemplateData>;
    _working: Graph<KeyType, CascadeGraphWorkingResult<KeyType, NodeTemplateData, NodeFetchData, EdgeTemplateData, NodeWorkingData>, {}>;

    constructor(props: {
        template: Graph<KeyType, { key: KeyType } & NodeTemplateData, EdgeTemplateData>;
    }) {
        this._template = props.template
        this._working = new Graph<KeyType, { key: KeyType } & ({} | NodeFetchData | (NodeFetchData & NodeWorkingData)), {}>(Object.assign({}, Object.keys(this._template.nodes).map((key) => ({ [key]: { key }}))) as Record<KeyType, { key: KeyType }>, props.template.edges, {} as Omit<{ key: KeyType }, "key">
        )
    }

}
export class CascadeGraph<KeyType extends string, NodeTemplateData extends CascadeGraphBaseTemplate, NodeFetchData extends {}, EdgeTemplateData extends {}, NodeWorkingData extends {}> {
    _template: Graph<KeyType, { key: KeyType } & NodeTemplateData, EdgeTemplateData>
    _fetch: (nodes: KeyType[]) => Promise<({ key: KeyType } & NodeFetchData)[]>;
    _unprocessed: (props: {
        template: { key: KeyType } & NodeTemplateData;
        fetch?: NodeFetchData;
        priors: CascadeGraphPriorResult<KeyType, NodeTemplateData, NodeFetchData, EdgeTemplateData, NodeWorkingData>[];
    }) => NodeWorkingData;
    _process: (props: {
            template: { key: KeyType } & NodeTemplateData;
            fetch?: NodeFetchData;
            priors: CascadeGraphPriorResult<KeyType, NodeTemplateData, NodeFetchData, EdgeTemplateData, NodeWorkingData>[];
        }) => Promise<NodeWorkingData>;
    _circular?: (props: {
            template: { key: KeyType } & NodeTemplateData;
            fetch?: NodeFetchData;
        }) => Promise<NodeWorkingData>;
    _aggregate?: (graph: CascadeGraphWorkspace<KeyType, NodeTemplateData, NodeFetchData, EdgeTemplateData, NodeWorkingData>) => Promise<CascadeGraphWorkspace<KeyType, NodeTemplateData, NodeFetchData, EdgeTemplateData, NodeWorkingData>>;

    constructor(props: {
        template: Graph<KeyType, { key: KeyType } & NodeTemplateData, EdgeTemplateData>;
        fetch: (nodes: KeyType[]) => Promise<({ key: KeyType } & NodeFetchData)[]>;
        unprocessed: (props: {
            template: { key: KeyType } & NodeTemplateData;
            fetch?: NodeFetchData;
            priors: CascadeGraphPriorResult<KeyType, NodeTemplateData, NodeFetchData, EdgeTemplateData, NodeWorkingData>[];
        }) => NodeWorkingData;
        process: (props: {
                template: { key: KeyType } & NodeTemplateData;
                fetch?: NodeFetchData;
                priors: CascadeGraphPriorResult<KeyType, NodeTemplateData, NodeFetchData, EdgeTemplateData, NodeWorkingData>[];
            }) => Promise<NodeWorkingData>;
        circular?: (props: {
                template: { key: KeyType } & NodeTemplateData;
                fetch?: NodeFetchData;
            }) => Promise<NodeWorkingData>;
        aggregate?: (graph: CascadeGraphWorkspace<KeyType, NodeTemplateData, NodeFetchData, EdgeTemplateData, NodeWorkingData>) => Promise<CascadeGraphWorkspace<KeyType, NodeTemplateData, NodeFetchData, EdgeTemplateData, NodeWorkingData>>;
    }) {
        this._template = props.template
        this._fetch = props.fetch
        this._unprocessed = props.unprocessed
        this._process = props.process
        this._circular = props.circular
        this._aggregate = props.aggregate
    }

    async execute(): Promise<void> {
        const generationOrderOutput = this._template.generationOrder()
        const stronglyConnectedComponentByContents = generationOrderOutput.flat(1).reduce<Partial<Record<KeyType, KeyType>>>(
            (previous, stronglyConnectedComponent) => (stronglyConnectedComponent.reduce<Partial<Record<KeyType, KeyType>>>((aggregator, key) => ({ ...aggregator, [key]: stronglyConnectedComponent[0] }), previous)),
            {}
        )

        let resultPromises: Partial<Record<KeyType, Promise<NodeWorkingData>>> = {}
        const workspace = new CascadeGraphWorkspace<KeyType, NodeTemplateData, NodeFetchData, EdgeTemplateData, NodeWorkingData>({
            template: this._template,
        })
        for (const generation of generationOrderOutput) {
            const fetchedNodes = await this._fetch(unique(generation.flat(1)).filter((key) => (workspace._template.nodes[key]?.needsFetch ?? true)))
            fetchedNodes.forEach(({ key, ...nodeData }) => {
                workspace._working.setNode(key, { key, fetch: nodeData as unknown as NodeFetchData })
            })
            for (const stronglyConnectedComponent of generation) {
                //
                // Find all Edges leading from *outside* keys to *inside* keys. By definition of generationOrder,
                // all those exits should lead to keys that have already been processed, and (therefore) have promises
                // in the resultPromises records defined above.  Collect all unique SCC representatives that this new set of
                // keys depends from, and deliver the saved Previous outputs to the callback.
                //
                if (stronglyConnectedComponent.length === 0) {
                    throw new Error('CascadeGraph error, empty strongly-connected-component encountered')
                }
                //
                // TODO: Refactor for more generalized case, where processing of circular-dependent items
                // can take into account all of the other items (at least their fetch values)
                //
                if (stronglyConnectedComponent.length > 1) {
                    stronglyConnectedComponent.forEach((key) => {
                        if (!this._circular) {
                            throw new Error('CascadeGraph error, unhandled circular dependency encountered')
                        }
                        const nodeTemplateData = this._template.nodes[key]
                        const nodeFetchData = workspace._working.nodes[key]?.fetch
                        const circularArguments = {
                            template: nodeTemplateData as { key: KeyType } & NodeTemplateData,
                            fetch: nodeFetchData
                        }
                        resultPromises[key] = this._circular(circularArguments).then((results: NodeWorkingData) => {
                            workspace._working.setNode(key, { key, result: results })
                            return results
                        })
                    })
                }
                else {
                    //
                    // Typical case: A strongly-connect-component of one, indicating no circular dependencies
                    //
                    resultPromises[stronglyConnectedComponent[0]] = (async (): Promise<NodeWorkingData> => {
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
                        const nodeFetchData = workspace._working.nodes[key]?.fetch
                        if (typeof nodeTemplateData === 'undefined') {
                            throw new Error('CascadeGraph error, internal key call out of bounds')
                        }
                        const processArguments = {
                            template: nodeTemplateData as { key: KeyType } & NodeTemplateData,
                            fetch: nodeFetchData,
                            priors: dependencyEdges.map(({ from, to, ...edge }) => {
                                const workingItem = workspace._working.nodes[from]
                                if (!workingItem) {
                                    throw new Error('CascadeGraph error, dependent item has not been worked')
                                }
                                return {
                                    key: from,
                                    fetch: workingItem.fetch,
                                    edge: edge.data || {} as unknown as EdgeTemplateData,
                                    result: workingItem.result
                                }
                            })
                        }

                        if (nodeTemplateData.needsProcessing ?? true) {
                            return await this._process(processArguments).then((results: NodeWorkingData) => {
                                    workspace._working.setNode(key, { key, result: results })
                                    return results
                                })
                        }
                        else {
                            const returnValue = this._unprocessed(processArguments)
                            workspace._working.setNode(key, { key, result: returnValue })
                            return returnValue
                        }
                    })()
                }
            }
        }
        await Promise.all(Object.values(resultPromises))
    }
}

export default CascadeGraph