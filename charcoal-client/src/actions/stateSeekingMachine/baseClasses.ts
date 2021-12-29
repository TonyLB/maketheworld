interface ISSMWrappedAction<D extends Record<string, any>> {
    (dispatch: any, getState: any): Promise<Partial<D>>;
}

export interface ISSMAction<D extends Record<string, any>> {
    (data: D): ISSMWrappedAction<D>
}

export interface ISSMChoiceState<K> {
    key: K;
    stateType: 'CHOICE';
    choices: Array<K>;
}

export interface ISSMAttemptState<K, D extends Record<string, any>> {
    key: K;
    stateType: 'ATTEMPT';
    action: ISSMAction<D>;
    resolve: K;
    reject: K;
}

export interface ISSMHoldCondition<D extends Record<string, any>> {
    (data: D, getState: any): Boolean;
}

export interface ISSMHoldState<K, D extends Record<string, any>> {
    key: K;
    stateType: 'HOLD';
    condition: ISSMHoldCondition<D>;
    next: K;
}

export type ISSMPotentialState<K, D extends Record<string, any>> = ISSMChoiceState<K> | ISSMAttemptState<K, D> | ISSMHoldState<K, D>

export interface ISSMTemplateAbstract<K extends string, D extends Record<string, any>> {
    initialState: K;
    initialData: D;
    states: Record<K, ISSMPotentialState<K, D>>;
}

export interface IStateSeekingMachineAbstract<K extends string, D extends Record<string, any>, T extends ISSMTemplateAbstract<K, D>> {
    key: string;
    template: T;
    currentState: K;
    desiredState: K;
    data: D;
}

export type testKeys = 'INITIAL' | 'CONNECTING' | 'CONNECTED'
export class TestData {
    valOne: string = ''
    valTwo: string = ''
}

export type ITestState = ISSMPotentialState<testKeys, TestData>

export interface ITestSSM extends ISSMTemplateAbstract<testKeys, TestData> {
    ssmType: 'Test'
}

export class TestTemplate implements ITestSSM {
    ssmType: 'Test' = 'Test'
    initialState: testKeys = 'INITIAL'
    initialData: TestData = new TestData()
    states: Record<testKeys, ITestState> = {
        INITIAL: {
            stateType: 'CHOICE',
            key: 'INITIAL',
            choices: ['CONNECTING']
        },
        CONNECTING: {
            stateType: 'ATTEMPT',
            key: 'CONNECTING',
            action: jest.fn(),
            resolve: 'CONNECTED',
            reject: 'INITIAL'
        },
        CONNECTED: {
            stateType: 'CHOICE',
            key: 'CONNECTED',
            choices: []
        }
    }
}

export type TestSSM = IStateSeekingMachineAbstract<testKeys, TestData, TestTemplate>
