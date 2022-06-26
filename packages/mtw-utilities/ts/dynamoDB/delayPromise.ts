export const delayPromise = (delay: number): Promise<void> => {
    return new Promise<void>((resolve: () => void) => {
        setTimeout(() => { resolve() }, delay)
    })
}

export default delayPromise
