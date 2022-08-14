let generatedKeys: Record<string, string> = {}

export const clearGeneratedKeys = () => {
    generatedKeys = {}
}

export const nextGeneratedKey = (tag: string): string => {
    const currentValues = Object.keys(generatedKeys)
        .filter((key) => (key.startsWith(`${tag}-`)))
        .map((key) => (key.slice(`${tag}-`.length)))
    const maxValue = currentValues.reduce((previous, value) => {
        const numericValue = parseInt(value) ?? -1
        return (numericValue > previous) ? numericValue : previous
    }, -1)
    return `${tag}-${maxValue + 1}`
}

export const keyForValue = (tag: string, value: string): string => {
    const [foundKey] = Object.entries(generatedKeys)
        .find(([key, checkValue]) => (
            key.startsWith(`${tag}-`) &&
            (checkValue === value)
        )) || [null]
    if (foundKey) {
        return foundKey
    }
    const syntheticKey = nextGeneratedKey(tag)
    generatedKeys[syntheticKey] = value
    return syntheticKey
}
