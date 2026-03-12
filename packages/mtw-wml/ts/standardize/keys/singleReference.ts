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
    // NOTE: This getter/setter pair is a convenience experiment for SingleReference.
    // Other payload types in this codebase generally expose methods (merge, diff,
    // fromJSON, etc.) rather than a direct "value" setter that replaces internal
    // structure. When adopting SingleReference in components, prefer whatever usage
    // keeps the code simplest and most readable; do not contort call sites just to
    // use the setter by preference.
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

    override diff(incoming: SingleReference): SingleReference {
        const raw = super.diff(incoming)
        return new SingleReference(raw ? raw.payload : [])
    }

    override merge(diff: SingleReference): SingleReference {
        const raw = super.merge(diff)
        return new SingleReference(raw ? raw.payload : [])
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

