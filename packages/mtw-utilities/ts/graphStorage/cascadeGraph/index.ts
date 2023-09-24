import { unique } from "../../lists";
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
        EdgeTemplateData extends {},
        NodeFetchData extends {},
        NodeWorkingData extends {}
    > {
    _template: Graph<KeyType, { key: KeyType } & NodeTemplateData, EdgeTemplateData>;
    _working?: Graph<KeyType, { key: KeyType } & ({} | NodeFetchData | (NodeFetchData & NodeWorkingData)), {}>;

    constructor(props: {
        template: Graph<KeyType, { key: KeyType } & NodeTemplateData, EdgeTemplateData>;
        nodeData: ({ key: KeyType } & NodeFetchData)[];
    }) {
        this._template = props.template.filter({ keys: props.nodeData.map(({ key }) => (key)) })
        this._working = new Graph<KeyType, { key: KeyType } & ({} | NodeFetchData | (NodeFetchData & NodeWorkingData)), {}>(
            Object.assign({}, ...props.nodeData.map(({ key, ...rest }) => ({ [key]: { key, ...rest }}))),
            [],
            {} as Omit<{ key: KeyType }, "key">
        )
    }

}
export class CascadeGraph<KeyType extends string, NodeTemplateData extends {}, NodeFetchData extends {}, EdgeTemplateData extends {}, NodeWorkingData extends {}> {
    _template: Graph<KeyType, { key: KeyType } & NodeTemplateData, EdgeTemplateData>
    _fetch: (nodes: KeyType[]) => Promise<{ key: KeyType } & NodeFetchData>[];
    _process: (props: {
            template: { key: KeyType } & NodeTemplateData;
            fetch: NodeFetchData;
            priors: CascadeGraphPriorResult<KeyType, NodeTemplateData, NodeFetchData, EdgeTemplateData, NodeWorkingData>[];
        }) => Promise<NodeWorkingData>;
    _aggregate: (graph: CascadeGraphWorkspace<KeyType, NodeTemplateData, NodeFetchData, EdgeTemplateData, NodeWorkingData>) => Promise<CascadeGraphWorkspace<KeyType, NodeTemplateData, NodeFetchData, EdgeTemplateData, NodeWorkingData>>;

    constructor(props: {
        template: Graph<KeyType, { key: KeyType } & NodeTemplateData, EdgeTemplateData>;
        fetch: (nodes: KeyType[]) => Promise<{ key: KeyType } & NodeFetchData>[];
        process: (props: {
                template: { key: KeyType } & NodeTemplateData;
                fetch: NodeFetchData;
                priors: CascadeGraphPriorResult<KeyType, NodeTemplateData, NodeFetchData, EdgeTemplateData, NodeWorkingData>[];
            }) => Promise<NodeWorkingData>;
        aggregate: (graph: CascadeGraphWorkspace<KeyType, NodeTemplateData, NodeFetchData, EdgeTemplateData, NodeWorkingData>) => Promise<CascadeGraphWorkspace<KeyType, NodeTemplateData, NodeFetchData, EdgeTemplateData, NodeWorkingData>>;
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
        let resultPromises: Partial<Record<KeyType, Promise<Previous>>> = {}
        for (const generation of generationOrderOutput) {
            for (const stronglyConnectedComponent of generation) {
                //
                // Find all Edges leading from *outside* keys to *inside* keys. By definition of generationOrder,
                // all those exits should lead to keys that have already been processed, and (therefore) have promises
                // in the resultPromises records defined above.  Collect all unique SCC representatives that this new set of
                // keys depends from, and deliver the saved Previous outputs to the callback.
                //
                resultPromises[stronglyConnectedComponent[0]] = (async (): Promise<Previous> => {
                    if (stronglyConnectedComponent.length === 0) {
                        throw new Error('sortedWalk error, empty strongly-connected-component encountered')
                    }
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
                    const dependencyResults: Previous[] = (await Promise.all(dependencyResultPromises)).filter((results) => (typeof results !== 'undefined')) as Previous[]
                    return await callback({ keys: stronglyConnectedComponent, previous: dependencyResults })
                })()
            }
        }
        await Promise.all(Object.values(resultPromises))
    }
}