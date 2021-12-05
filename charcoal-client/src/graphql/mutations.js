/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const updateMessages = /* GraphQL */ `
  mutation UpdateMessages($Updates: [MessageUpdateInput]) {
    updateMessages(Updates: $Updates)
  }
`;
export const broadcastMessage = /* GraphQL */ `
  mutation BroadcastMessage($Message: MessageInput) {
    broadcastMessage(Message: $Message) {
      MessageId
      CreatedTime
      ExpirationTime
      DisplayProtocol
      Target
      RoomId
      WorldMessage {
        Message
      }
      CharacterMessage {
        Message
        CharacterId
      }
      DirectMessage {
        Message
        CharacterId
        Title
        Recipients
      }
      AnnounceMessage {
        Message
        Title
      }
      RoomDescription {
        RoomId
        Name
        Description
        Ancestry
        Exits {
          RoomId
          Name
          Visibility
        }
        Characters {
          CharacterId
          Name
          Pronouns
          FirstImpression
          OneCoolThing
          Outfit
        }
      }
    }
  }
`;
