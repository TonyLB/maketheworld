import { Graph } from "../utils/graph";

type CascadeGraphPriorResult<KeyType extends string, NodeTemplateData extends {}, EdgeTemplateData extends {}, NodeWorkingData extends {}> = {
    key: KeyType;
    edge: EdgeTemplateData;
    node: NodeWorkingData;
}

export class CascadeGraphWorkspace<KeyType extends string, NodeTemplateData extends {}, EdgeTemplateData extends {}, NodeWorkingData extends {}> {
    _template: Graph<KeyType, { key: KeyType } & NodeTemplateData, EdgeTemplateData>;
    _working: Graph<KeyType, { key: KeyType } & Partial<NodeWorkingData>, {}>;

    constructor(props: {
        template: Graph<KeyType, { key: KeyType } & NodeTemplateData, EdgeTemplateData>;
        nodeData: ({ key: KeyType } & Partial<NodeWorkingData>)[];
    }) {
        this._template = props.template.filter({ keys: props.nodeData.map(({ key }) => (key)) })
        this._working = new Graph<KeyType, { key: KeyType } & Partial<NodeWorkingData>, {}>(
            Object.assign({}, ...props.nodeData.map(({ key, ...rest }) => ({ [key]: { key, ...rest }}))),
            [],
            {} as Omit<{ key: KeyType } & Partial<NodeWorkingData>, "key">
        )
    }

}
export class CascadeGraph<KeyType extends string, NodeTemplateData extends {}, EdgeTemplateData extends {}, NodeWorkingData extends {}> {
    _template: Graph<KeyType, { key: KeyType } & NodeTemplateData, EdgeTemplateData>
    _preProcess: (props: {
        template: { key: KeyType } & NodeTemplateData;
        priors: ({ key: KeyType } & EdgeTemplateData)[];
    }) => Promise<NodeWorkingData>;
    _process: (props: {
            template: { key: KeyType } & NodeTemplateData;
            working: NodeWorkingData;
            priors: CascadeGraphPriorResult<KeyType, NodeTemplateData, EdgeTemplateData, NodeWorkingData>[];
        }) => Promise<NodeWorkingData>;
    _aggregate: (graph: CascadeGraphWorkspace<KeyType, NodeTemplateData, EdgeTemplateData, NodeWorkingData>) => Promise<CascadeGraphWorkspace<KeyType, NodeTemplateData, EdgeTemplateData, NodeWorkingData>>;

    constructor(props: {
        template: Graph<KeyType, { key: KeyType } & NodeTemplateData, EdgeTemplateData>;
        preProcess: (props: {
            template: { key: KeyType } & NodeTemplateData;
            priors: ({ key: KeyType } & EdgeTemplateData)[];
        }) => Promise<NodeWorkingData>;
        process: (props: {
                template: { key: KeyType } & NodeTemplateData;
                working: NodeWorkingData;
                priors: CascadeGraphPriorResult<KeyType, NodeTemplateData, EdgeTemplateData, NodeWorkingData>[];
            }) => Promise<NodeWorkingData>;
        aggregate: (graph: CascadeGraphWorkspace<KeyType, NodeTemplateData, EdgeTemplateData, NodeWorkingData>) => Promise<CascadeGraphWorkspace<KeyType, NodeTemplateData, EdgeTemplateData, NodeWorkingData>>;
    }) {
        this._template = props.template
        this._preProcess = props.preProcess
        this._process = props.process
        this._aggregate = props.aggregate
    }

    async execute(): Promise<void> {

    }
}