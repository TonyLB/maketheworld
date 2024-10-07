export type ApplyEditArguments = {
    schema: string;
}

export const applyEdit = async (args: ApplyEditArguments): Promise<Record<string, any>> => {
    return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Success' })
    }
}

export default applyEdit
