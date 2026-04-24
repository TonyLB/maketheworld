type DefaultedEqualsComparable<T> = {
    isEmpty(): boolean;
    equals(other: T): boolean;
}

const isVacuous = <T extends DefaultedEqualsComparable<T>>(value: T | undefined): boolean => (
    value === undefined || value.isEmpty()
)

/**
 * Semantic equality helper for optional content fields where undefined and
 * semantic-empty values are intentionally equivalent.
 */
export const defaultedEquals = <T extends DefaultedEqualsComparable<T>>(left: T | undefined, right: T | undefined): boolean => {
    const leftVacuous = isVacuous(left)
    const rightVacuous = isVacuous(right)
    if (leftVacuous && rightVacuous) {
        return true
    }
    if (leftVacuous || rightVacuous) {
        return false
    }
    return left!.equals(right!)
}

