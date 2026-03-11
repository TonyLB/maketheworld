import { ReferenceList } from "./referenceList"
import StandardReference from "./reference"
import { ReferenceListData, StandardReferenceData } from "./dataTypes/reference"

const isPositiveRef = (ref: number | undefined): boolean => (ref ?? 1) > 0
const isNegativeRef = (ref: number | undefined): boolean => (ref ?? 1) < 0

/**
 * SingleReference: ReferenceList subclass enforcing 0-or-1 semantics.
 *
 * The underlying representation is still list-shaped so it can participate
 * in existing ReferenceList-based machinery, but the envelope for legal
 * shapes is much narrower.
 */
export class SingleReference extends ReferenceList {
    constructor(
        args: any
    ) {
        super(args)
        this._enforceEnvelope()
    }

    //
    // Core value API
    //

    get value(): StandardReference | undefined {
        const positives = this._items.filter((item) => isPositiveRef(item.ref))
        if (!positives.length) {
            return undefined
        }
        return positives[0]
    }

    set value(next: StandardReference | StandardReferenceData | undefined) {
        if (typeof next === "undefined") {
            this._items = []
            return
        }
        const ref = next instanceof StandardReference ? next : new StandardReference(next)
        const positive = isPositiveRef(ref.ref) ? ref : ref.withRef(1)
        this._items = [positive]
        this._enforceEnvelope()
    }

    //
    // Factory helpers
    //

    static fromReferenceList(list: ReferenceList): SingleReference {
        return new SingleReference(list.payload)
    }

    static fromData(data?: ReferenceListData): SingleReference {
        const items = (data ?? []).map((item) => new StandardReference(item))
        return new SingleReference(items)
    }

    static fromValue(value: StandardReference | StandardReferenceData | undefined): SingleReference {
        if (typeof value === "undefined") {
            return new SingleReference([])
        }
        const ref = value instanceof StandardReference ? value : new StandardReference(value)
        return new SingleReference([ref])
    }

    //
    // Merge and diff
    //

    /**
     * Diff between two SingleReference states.
     *
     * Returns a SingleReference in "diff" mode whose payload is:
     * - empty when values are equal (including both undefined)
     * - [+B] when base is undefined and incoming is B
     * - [-A] when base is A and incoming is undefined
     * - [-A, +B] when base is A and incoming is B (A != B)
     */
    override diff(incoming: SingleReference): SingleReference {
        const baseValue = this.value
        const incomingValue = incoming.value

        if (!baseValue && !incomingValue) {
            return new SingleReference([])
        }

        if (!baseValue && incomingValue) {
            const positive = isPositiveRef(incomingValue.ref) ? incomingValue : incomingValue.withRef(1)
            return new SingleReference([positive])
        }

        if (baseValue && !incomingValue) {
            const negative = isNegativeRef(baseValue.ref) ? baseValue : baseValue.withRef(-1)
            return new SingleReference([negative])
        }

        if (!baseValue || !incomingValue) {
            return new SingleReference([])
        }

        if (baseValue.sameKey(incomingValue)) {
            if (baseValue.ref === incomingValue.ref) {
                return new SingleReference([])
            }
            const diffRef = incomingValue.ref - baseValue.ref
            if (diffRef === 0) {
                return new SingleReference([])
            }
            const diffItem = baseValue.withRef(diffRef)
            return new SingleReference([diffItem])
        }

        const negative = isNegativeRef(baseValue.ref) ? baseValue : baseValue.withRef(-1)
        const positive = isPositiveRef(incomingValue.ref) ? incomingValue : incomingValue.withRef(1)
        return new SingleReference([negative, positive])
    }

    /**
     * Merge a diff SingleReference into this state SingleReference.
     *
     * The diff instance must satisfy the SingleReference diff envelope:
     * - at most one positive item
     * - at most one negative item
     *
     * Semantics:
     * - Negative only (-A): clear the slot if current value is A; otherwise no-op.
     * - Positive only (+B): set the slot to B, regardless of current value.
     * - Negative A and positive B (-A, +B): replace A with B (swap).
     */
    override merge(diff: SingleReference): SingleReference {
        const baseValue = this.value
        const items = diff._items
        const positives = items.filter((item) => isPositiveRef(item.ref))
        const negatives = items.filter((item) => isNegativeRef(item.ref))

        if (!positives.length && !negatives.length) {
            return SingleReference.fromValue(baseValue)
        }

        let result: StandardReference | undefined = baseValue

        const negative = negatives[0]
        if (negative && baseValue && negative.sameKey(baseValue)) {
            result = undefined
        }

        const positive = positives[0]
        if (positive) {
            const normalizedPositive = isPositiveRef(positive.ref) ? positive : positive.withRef(1)
            result = normalizedPositive
        }

        return SingleReference.fromValue(result)
    }

    //
    // Internal helpers
    //

    private _enforceEnvelope(): void {
        const positives = this._items.filter((item) => isPositiveRef(item.ref))
        const negatives = this._items.filter((item) => isNegativeRef(item.ref))

        if (positives.length > 1) {
            throw new Error("SingleReference must not contain more than one positive ref")
        }
        if (negatives.length > 1) {
            throw new Error("SingleReference must not contain more than one negative ref")
        }

        if (positives.length === 1 && negatives.length === 1) {
            const positive = positives[0]
            const negative = negatives[0]
            if (positive.sameKey(negative) && positive.ref === 1 && negative.ref === -1) {
                this._items = []
            }
        }
    }
}

export default SingleReference

