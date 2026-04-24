import { StandardLiteral } from "./literal"
import { ReferenceList } from "./keys/referenceList"
import StandardReference from "./keys/reference"
import { MarkFacetList, StandardMarkFacet } from "./keys/facets/mark"
import { StandardRender } from "./render"
import { defaultedEquals } from "./components/utils/defaultedEquals"

type SemanticFactory<T> = {
    empty: () => T;
    equalA: () => T;
    equalB: () => T;
    different: () => T;
}

const assertDefaultedEqualsMatrix = <T extends { isEmpty(): boolean; equals(other: T): boolean }>(
    label: string,
    factory: SemanticFactory<T>
) => {
    describe(label, () => {
        it("treats undefined and empty as vacuous", () => {
            expect(defaultedEquals(undefined, undefined)).toBe(true)
            expect(defaultedEquals(undefined, factory.empty())).toBe(true)
            expect(defaultedEquals(factory.empty(), undefined)).toBe(true)
            expect(defaultedEquals(factory.empty(), factory.empty())).toBe(true)
        })

        it("distinguishes vacuous from non-vacuous values", () => {
            expect(defaultedEquals(undefined, factory.equalA())).toBe(false)
            expect(defaultedEquals(factory.equalA(), undefined)).toBe(false)
            expect(defaultedEquals(factory.empty(), factory.equalA())).toBe(false)
            expect(defaultedEquals(factory.equalA(), factory.empty())).toBe(false)
        })

        it("delegates non-vacuous comparisons to equals semantics", () => {
            expect(defaultedEquals(factory.equalA(), factory.equalB())).toBe(true)
            expect(defaultedEquals(factory.equalA(), factory.different())).toBe(false)
        })
    })
}

describe("defaultedEquals", () => {
    assertDefaultedEqualsMatrix("StandardRender", {
        empty: () => new StandardRender([]),
        equalA: () => new StandardRender(["alpha"]),
        equalB: () => new StandardRender(["alpha"]),
        different: () => new StandardRender(["beta"]),
    })

    assertDefaultedEqualsMatrix("StandardLiteral", {
        empty: () => new StandardLiteral(""),
        equalA: () => new StandardLiteral("alpha"),
        equalB: () => new StandardLiteral("alpha"),
        different: () => new StandardLiteral("beta"),
    })

    assertDefaultedEqualsMatrix("ReferenceList", {
        empty: () => new ReferenceList([]),
        equalA: () => new ReferenceList([new StandardReference({ tag: "Room", key: "room1", ref: 1 })]),
        equalB: () => new ReferenceList([new StandardReference({ tag: "Room", key: "room1", ref: 1 })]),
        different: () => new ReferenceList([new StandardReference({ tag: "Room", key: "room2", ref: 1 })]),
    })

    assertDefaultedEqualsMatrix("MarkFacetList", {
        empty: () => new MarkFacetList([]),
        equalA: () => new MarkFacetList([
            new StandardMarkFacet({
                reference: { tag: "Mark", key: "mark1", ref: 1 },
                payload: "dark",
            }),
        ]),
        equalB: () => new MarkFacetList([
            new StandardMarkFacet({
                reference: { tag: "Mark", key: "mark1", ref: 1 },
                payload: "dark",
            }),
        ]),
        different: () => new MarkFacetList([
            new StandardMarkFacet({
                reference: { tag: "Mark", key: "mark1", ref: 1 },
                payload: "light",
            }),
        ]),
    })
})

