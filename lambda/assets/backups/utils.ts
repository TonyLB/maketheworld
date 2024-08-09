export const getCurrentDateString = (): string => {
    return new Date().toISOString().split('T')[0]
}
