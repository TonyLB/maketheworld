import { StandardEditableData } from '@tonylb/mtw-base/ts/editable';
import { StandardEditable, standardEditableFactory, StandardEditableFactoryProps } from './index';

interface TestData {
    id: number;
    name: string;
}

interface TestEditable extends StandardEditable<TestData> {
    data: TestData;
}

const testTypeguard = (value: any): value is TestData => {
    return typeof value === 'object' && value !== null && typeof value.id === 'number' && typeof value.name === 'string';
}

const testPayloadFactory = (props: StandardEditableData<TestData>): TestEditable | undefined => {
    if (testTypeguard(props)) {
        return { data: props };
    }
    return undefined;
}

const factoryProps: StandardEditableFactoryProps<TestData, TestEditable> = {
    typeguard: testTypeguard,
    payloadFactory: testPayloadFactory
};

const { factory, typeguard } = standardEditableFactory(factoryProps);

describe('standardEditableFactory', () => {
    it('should create a valid TestEditable object when given valid data', () => {
        const data: TestData = { id: 1, name: 'Test' };
        const result = factory(data);
        expect(result).toEqual({ data });
    });

    it('should return undefined when given invalid data', () => {
        const data = { id: 'invalid', name: 'Test' };
        const result = factory(data as any);
        expect(result).toBeUndefined();
    });

    it('should correctly identify valid StandardEditableData', () => {
        const data: TestData = { id: 1, name: 'Test' };
        expect(typeguard(data)).toBe(true);
    });

    it('should correctly identify invalid StandardEditableData', () => {
        const data = { id: 'invalid', name: 'Test' };
        expect(typeguard(data)).toBe(false);
    });

    it('should correctly identify Remove tag with valid match', () => {
        const data = { tag: 'Remove', match: { id: 1, name: 'Test' } };
        expect(typeguard(data)).toBe(true);
    });

    it('should correctly identify Replace tag with valid match and payload', () => {
        const data = { tag: 'Replace', match: { id: 1, name: 'Test' }, payload: { id: 2, name: 'Test2' } };
        expect(typeguard(data)).toBe(true);
    });

    it('should return undefined for Remove tag without implementation', () => {
        const data = { tag: 'Remove' as const, match: { id: 1, name: 'Test' } };
        const result = factory(data);
        expect(result).toBeUndefined();
    });

    it('should return undefined for Replace tag without implementation', () => {
        const data = { tag: 'Replace' as const, match: { id: 1, name: 'Test' }, payload: { id: 2, name: 'Test2' } };
        const result = factory(data);
        expect(result).toBeUndefined();
    });
});