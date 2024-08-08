type CreateEntryArgs = {}

export const createEntry = async (args: CreateEntryArgs) => {
    console.log(`Create backup entry: ${JSON.stringify(args, null, 4)}`)
}

export default createEntry
