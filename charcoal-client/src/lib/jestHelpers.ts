import { MockedFunction, MockedClass } from 'vitest'

export function mockFunction<T extends (...args: any[]) => any>(fn: T): MockedFunction<T> {
    return fn as MockedFunction<T>;
}

export function mockClass <T extends { new (...args: any): any }>(item: T): MockedClass<typeof item> {
    return item as MockedClass<typeof item>
}
