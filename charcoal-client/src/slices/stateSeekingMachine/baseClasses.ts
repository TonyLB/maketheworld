export type ISSMData = Record<string, any>

export interface ISSMDataLayout<I extends ISSMData, D extends ISSMData> {
    internalData: Partial<I>;
    publicData: Partial<D>;
}

export interface ISSMDataReturn<I extends ISSMData, D extends ISSMData> {
    internalData?: Partial<I>;
    publicData?: Partial<D>;
}

interface ISSMWrappedAction<I extends ISSMData, D extends ISSMData> {
    (dispatch: any, getState: any): Promise<ISSMDataReturn<I, D>>;
}

export interface ISSMAction<I extends ISSMData, D extends ISSMData> {
    (data: ISSMDataLayout<I, D>): ISSMWrappedAction<I, D>
}

export interface ISSMChoiceNode {
    stateType: 'CHOICE';
}

export type ISSMChoiceState<K> = ISSMChoiceNode & {
    choices: Array<K>;
}

export interface ISSMAttemptNode<I extends ISSMData, D extends ISSMData> {
    stateType: 'ATTEMPT';
    action: ISSMAction<I, D>;
}

export type ISSMAttemptState<K, I extends ISSMData, D extends ISSMData> = ISSMAttemptNode<I, D> & {
    resolve: K;
    reject: K;
}

export interface ISSMHoldCondition<I extends ISSMData, D extends ISSMData> {
    (data: ISSMDataLayout<I, D>, getState: any): Boolean;
}

export interface ISSMHoldNode<I extends ISSMData, D extends ISSMData> {
    stateType: 'HOLD';
    condition: ISSMHoldCondition<I, D>;
}

export type ISSMHoldState<K, I extends ISSMData, D extends ISSMData> = ISSMHoldNode<I, D> & {
    next: K;
}

//
// Map each type to its inferred internal and public data types
//
type InferredInternalDataTypeFromNodes<Nodes extends Record<string, any>> = {
    [Node in keyof Nodes]: Nodes[Node] extends ISSMAttemptNode<infer I, infer D>
        ? I
        : Nodes[Node] extends ISSMHoldNode<infer I, infer D>
            ? I
            : never
}

type InferredPublicDataTypeFromNodes<Nodes extends Record<string, any>> = {
    [Node in keyof Nodes]: Nodes[Node] extends ISSMAttemptNode<infer I, infer D>
        ? D
        : Nodes[Node] extends ISSMHoldNode<infer I, infer D>
            ? D
            : never
}

//
// Union the inferred types to create a single data type that will handle
// anything the provided nodes can throw at it (ideally this will boil down
// to just unioning the same type a bunch of times, but better safe than
// sorry)
//
type InferredInternalDataTypeAggregateFromNodes<Nodes extends ISSMData> =
    InferredInternalDataTypeFromNodes<Nodes>[keyof InferredInternalDataTypeFromNodes<Nodes>]

export type InferredPublicDataTypeAggregateFromNodes<Nodes extends ISSMData> =
    InferredPublicDataTypeFromNodes<Nodes>[keyof InferredPublicDataTypeFromNodes<Nodes>]

export type StringKeys<Nodes> = Extract<keyof Nodes, string>

export type InferredDataTypeAggregateFromNodes<Nodes extends ISSMData> = {
    internalData: InferredInternalDataTypeAggregateFromNodes<Nodes>;
    publicData: InferredPublicDataTypeFromNodes<Nodes>[keyof InferredPublicDataTypeFromNodes<Nodes>];
}

export type PartialDataTypeAggregateFromNodes<Nodes extends ISSMData> = {
    internalData?: Partial<InferredInternalDataTypeAggregateFromNodes<Nodes>>;
    publicData?: Partial<InferredPublicDataTypeFromNodes<Nodes>[keyof InferredPublicDataTypeFromNodes<Nodes>]>;
}

export type GraphFromNodes<Nodes extends Record<string, any>> = {
    [Node in keyof Nodes]:
        Nodes[Node] extends ISSMAttemptNode<infer I, infer D>
            ? ISSMAttemptState<
                keyof Nodes,
                InferredInternalDataTypeAggregateFromNodes<Nodes>,
                InferredPublicDataTypeAggregateFromNodes<Nodes>
            >
            : Nodes[Node] extends ISSMHoldNode<infer I, infer D>
                ? ISSMHoldState<
                    keyof Nodes,
                    InferredInternalDataTypeAggregateFromNodes<Nodes>,
                    InferredPublicDataTypeAggregateFromNodes<Nodes>
                >
                : Nodes[Node] extends ISSMChoiceNode
                    ? ISSMChoiceState<keyof Nodes>
                    : never
}

export type TemplateFromNodes<Nodes extends Record<string, any>> = {
    initialState: keyof Nodes;
    initialData: InferredDataTypeAggregateFromNodes<Nodes>;
    states: GraphFromNodes<Nodes>;
}

export type ISSMPotentialState<K, I extends ISSMData, D extends ISSMData> = ISSMChoiceState<K> | ISSMAttemptState<K, I, D> | ISSMHoldState<K, I, D>

export type PotentialStateFromNodes<Nodes extends Record<string, any>> = ISSMPotentialState<
    keyof Nodes,
    InferredInternalDataTypeAggregateFromNodes<Nodes>,
    InferredPublicDataTypeAggregateFromNodes<Nodes>
>

export interface ISSMTemplateAbstract<K extends string, I extends ISSMData, D extends ISSMData> {
    initialState: K;
    initialData: ISSMDataLayout<I, D>;
    states: Record<K, ISSMPotentialState<K, I, D>>;
}

export interface IStateSeekingMachineAbstract<K extends string, I extends ISSMData, D extends ISSMData, T extends ISSMTemplateAbstract<K, I, D>> {
    key: string;
    template: T;
    currentState: K;
    desiredState: K;
    data: ISSMDataLayout<I, D>;
}

export type testKeys = 'INITIAL' | 'CONNECTING' | 'CONNECTED'
export class TestInternal {}
export class TestData {
    valOne: string = ''
    valTwo: string = ''
}

export type ITestState = ISSMPotentialState<testKeys, TestInternal, TestData>

export interface ITestSSM extends ISSMTemplateAbstract<testKeys, TestInternal, TestData> {
    ssmType: 'Test'
}

export class TestTemplate implements ITestSSM {
    ssmType: 'Test' = 'Test'
    initialState: testKeys = 'INITIAL'
    initialData: ISSMDataLayout<TestInternal, TestData> = {
        internalData: new TestInternal,
        publicData: new TestData()
    }
    states: Record<testKeys, ITestState> = {
        INITIAL: {
            stateType: 'CHOICE',
            choices: ['CONNECTING']
        },
        CONNECTING: {
            stateType: 'ATTEMPT',
            action: jest.fn(),
            resolve: 'CONNECTED',
            reject: 'INITIAL'
        },
        CONNECTED: {
            stateType: 'CHOICE',
            choices: []
        }
    }
}

export type TestSSM = IStateSeekingMachineAbstract<testKeys, TestInternal, TestData, TestTemplate>

export type ssmMeta<K> = {
    currentState: K;
    desiredState: K;
    inProgress: K | null;
}
