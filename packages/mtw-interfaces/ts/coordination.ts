import { checkTypes } from "./utils";

export type CoordinationClientProgressMessage = {
    messageType: 'Progress';
    RequestId?: string;
    progress: number;
    of: number;
}

export type CoordinationClientSuccessMessage = {
    messageType: 'Success';
    RequestId?: string;
}

export type CoordinationClientErrorMessage = {
    messageType: 'Error';
    RequestId?: string;
    error?: string;
}

export type CoordinationClientMessage = CoordinationClientSuccessMessage |
    CoordinationClientErrorMessage |
    CoordinationClientProgressMessage

    export const isCoordinationClientMessage = (message: any): message is CoordinationClientMessage => {
        if (!('messageType' in message && typeof message.messageType === 'string')) {
            return false
        }
        switch(message.messageType) {
            case 'Progress':
                return checkTypes(
                    message,
                    {
                        progress: 'number',
                        of: 'number'
                    },
                    {
                        RequestId: 'string'
                    }
                )
            case 'Success':
                return checkTypes(
                    message,
                    {},
                    {
                        RequestId: 'string'
                    }
                )
            case 'Error':
                return checkTypes(
                    message,
                    {},
                    {
                        RequestId: 'string',
                        error: 'string'
                    }
                )
            default: return false
        }
    
    }