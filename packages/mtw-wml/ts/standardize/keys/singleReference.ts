import { ReferenceList } from "./referenceList"
import StandardReference from "./reference"
import { ReferenceListData, StandardReferenceData } from "./dataTypes/reference"

type SingleReferenceMode = "state" | "diff"

const isPositiveRef = (ref: number | undefined): boolean => (ref ?? 1) > 0
const isNegativeRef = (ref: number | undefined): boolean => (ref ?? 1) < 0

/**
 * SingleReference: ReferenceList subclass enforcing 0-or-1 semantics.
 *
 * Two usage modes:
 * - "state": represents the current value of a single-reference slot (0 or 1 positive item, no negatives)
 * - "diff": represents a diff on a single-reference slot (0 or 1 positive, 0 or 1 negative)
 *
 * The underlying representation is still list-shaped so it can participate
 * in existing ReferenceList-based machinery, but the envelope for legal
 * shapes is much narrower.
 */
export class SingleReference extends ReferenceList {
    private _mode: SingleReferenceMode

    constructor(
        args: any,
        options?: {
            mode?: SingleReferenceMode
        }
    ) {
        super(args)
        this._mode = options?.mode ?? "state"
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
            this._mode = "state"
            return
        }
        const ref = next instanceof StandardReference ? next : new StandardReference(next)
        const positive = isPositiveRef(ref.ref) ? ref : ref.withRef(1)
        this._items = [positive]
        this._mode = "state"
        this._enforceEnvelope()
    }

    //
    // Factory helpers
    //

    static fromReferenceList(list: ReferenceList, options?: { mode?: SingleReferenceMode }): SingleReference {
        return new SingleReference(list.payload, { mode: options?.mode ?? "state" })
    }

    static fromData(data?: ReferenceListData, options?: { mode?: SingleReferenceMode }): SingleReference {
        const items = (data ?? []).map((item) => new StandardReference(item))
        return new SingleReference(items, { mode: options?.mode ?? "state" })
    }

    static fromValue(value: StandardReference | StandardReferenceData | undefined): SingleReference {
        if (typeof value === "undefined") {
            return new SingleReference([], { mode: "state" })
        }
        const ref = value instanceof StandardReference ? value : new StandardReference(value)
        return new SingleReference([ref], { mode: "state" })
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
            return new SingleReference([], { mode: "diff" })
        }

        if (!baseValue && incomingValue) {
            const positive = isPositiveRef(incomingValue.ref) ? incomingValue : incomingValue.withRef(1)
            return new SingleReference([positive], { mode: "diff" })
        }

        if (baseValue && !incomingValue) {
            const negative = isNegativeRef(baseValue.ref) ? baseValue : baseValue.withRef(-1)
            return new SingleReference([negative], { mode: "diff" })
        }

        if (!baseValue || !incomingValue) {
            return new SingleReference([], { mode: "diff" })
        }

        if (baseValue.sameKey(incomingValue)) {
            if (baseValue.ref === incomingValue.ref) {
                return new SingleReference([], { mode: "diff" })
            }
            const diffRef = incomingValue.ref - baseValue.ref
            if (diffRef === 0) {
                return new SingleReference([], { mode: "diff" })
            }
            const diffItem = baseValue.withRef(diffRef)
            return new SingleReference([diffItem], { mode: "diff" })
        }

        const negative = isNegativeRef(baseValue.ref) ? baseValue : baseValue.withRef(-1)
        const positive = isPositiveRef(incomingValue.ref) ? incomingValue : incomingValue.withRef(1)
        return new SingleReference([negative, positive], { mode: "diff" })
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

        if (this._mode === "state") {
            if (negatives.length > 0) {
                throw new Error("SingleReference state must not contain negative refs")
            }
            if (positives.length > 1) {
                throw new Error("SingleReference state must not contain more than one positive ref")
            }
            return
        }

        if (positives.length > 1) {
            throw new Error("SingleReference diff must not contain more than one positive ref")
        }
        if (negatives.length > 1) {
            throw new Error("SingleReference diff must not contain more than one negative ref")
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

