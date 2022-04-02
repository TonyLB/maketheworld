export function mockFunction<T extends (...args: any[]) => any>(fn: T): jest.MockedFunction<T> {
    return fn as jest.MockedFunction<T>;
}

export function mockClass <T extends { new (...args: any): any }>(item: T): jest.MockedClass<typeof item> {
    return item as jest.MockedClass<typeof item>
}
