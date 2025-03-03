import { StandardEditableData } from '@tonylb/mtw-base/ts/editable';
import { StandardEditablePayload, standardEditableFactory, StandardEditableFactoryProps, StandardEditableWrapper, StandardEditablePayloadDelta } from './index';
import { MergeConflictError } from '@tonylb/mtw-base/ts/standardize';

interface TestData {
    id: number;
    name: string;
}

const testTypeguard = (value: any): value is TestData => {
    return typeof value === 'object' && value !== null && typeof value.id === 'number' && typeof value.name === 'string';
}

class testClass implements StandardEditablePayload<TestData> {
    data: TestData;
    schema = [];
    constructor(data: TestData) {
        this.data = data
    }
    clone() {
        return new testClass(this.data)
    }
    toJSON() {
        return { ...this.data }
    }
    add(base, incoming) {
        return { id: this.data.id, name: `${base.name}${incoming.name}` }
    }
    subtract(base, incoming) {
        if (base.name === incoming.name) {
            return {}
        }
        else {
            if (base.name.length > incoming.name.length) {
                if (base.name.endsWith(incoming.name)) {
                    return { add: { id: base.id, name: base.name.slice(0, base.name.length - incoming.name.length) } }
                }
            }
            else {
                if (incoming.name.startsWith(base.name)) {
                    return { remove: { id: base.id, name: incoming.name.slice(base.name.length) } }
                }
            }
        }
        throw new MergeConflictError()
    }
    addDelta(base, incoming): StandardEditablePayloadDelta<TestData> {
        const { add: baseAdd, remove: baseRemove } = base
        const { add: incomingAdd, remove: incomingRemove } = incoming
        if (baseRemove && incomingAdd) {
            const cancelledDelta = this.subtract(baseRemove, incomingAdd)
            return this.addDelta(
                { add: baseAdd, remove: cancelledDelta.add },
                { add: cancelledDelta.remove, remove: incomingRemove }
            )
        }
        if (baseAdd && incomingRemove) {
            const cancelledDelta = this.subtract(baseAdd, incomingRemove)
            return this.addDelta(
                { add: cancelledDelta.add, remove: baseRemove },
                { add: incomingAdd, remove: cancelledDelta.remove }
            )
        }
        if (baseRemove && incomingRemove) {
            return {
                add: baseAdd,
                remove: new testClass(this.add(incomingRemove, baseRemove))
            }
        }
        if (baseAdd && incomingAdd) {
            return {
                add: new testClass(this.add(baseAdd, incomingAdd)),
                remove: baseRemove
            }
        }
        return {
            add: baseAdd ?? incomingAdd,
            remove: baseRemove ?? incomingRemove
        }
    }
    merge(incoming: { remove?: StandardEditablePayload<TestData>; add?: StandardEditablePayload<TestData>; }) {
        const { remove, add } = incoming
        return this.addDelta({ add: this.toJSON(), remove: undefined }, { add: add?.toJSON(), remove: remove?.toJSON() })
    }
    diff(incoming: StandardEditablePayload<TestData>) {
        return undefined
    }
    get plain() {
        return this
    }
    get payload() {
        return this.data
    }
}

const testPayloadFactory = (props: StandardEditableData<TestData>): StandardEditablePayload<TestData> | undefined => {
    if (testTypeguard(props)) {
        return new testClass(props);
    }
    return undefined;
}

const factoryProps: StandardEditableFactoryProps<TestData> = {
    typeguard: testTypeguard,
    payloadFactory: testPayloadFactory
};

const { factory, typeguard } = standardEditableFactory(factoryProps);

describe('standardEditableFactory', () => {
    it('should create a valid TestEditable object when given valid data', () => {
        const data: TestData = { id: 1, name: 'Test' };
        const result = factory(data);
        expect(result?.toJSON()).toEqual(data);
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

    it('should return remove class when given valid remove data', () => {
        const data = { tag: 'Remove' as const, match: { id: 1, name: 'Test' } };
        const result = factory(data);
        expect(result?.toJSON()).toEqual(data);
    });

    it('should return undefined for Replace tag without implementation', () => {
        const data = { tag: 'Replace' as const, match: { id: 1, name: 'Test' }, payload: { id: 2, name: 'Test2' } };
        const result = factory(data);
        expect(result).toBeUndefined();
    });

    it('should correctly merge two content tags', () => {
        const data1 = { id: 1, name: 'Test' };
        const data2 = { id: 2, name: 'Test2' };
        const editable1 = factory(data1);
        const editable2 = factory(data2);
        expect(editable2).toBeDefined();
        if (editable2) {
            const merged = editable1?.merge(editable2);
            expect(merged?.toJSON()).toEqual({ id: 1, name: 'TestTest2' });
        }
    })

    it('should correctly merge a remove into a content tag', () => {
        const data1 = { id: 1, name: 'Test' };
        const data2 = { tag: 'Remove' as const, match: { id: 1, name: 'Test' } };
        const editable1 = factory(data1);
        const editable2 = factory(data2);
        const merged = editable1?.merge(editable2!);
        expect(merged?.toJSON()).toBeUndefined();
    })

    it('should correctly merge partial remove into a content tag', () => {
        const data1 = { id: 1, name: 'TestOne' };
        const data2 = { tag: 'Remove' as const, match: { id: 1, name: 'One' } };
        const editable1 = factory(data1);
        const editable2 = factory(data2);
        const merged = editable1?.merge(editable2!);
        expect(merged?.toJSON()).toEqual({ id: 1, name: 'Test' });
    })
});