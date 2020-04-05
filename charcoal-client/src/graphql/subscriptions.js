/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const changedCharacter = /* GraphQL */ `
  subscription ChangedCharacter {
    changedCharacter {
      PlayerName
      Name
      CharacterId
      Pronouns
      FirstImpression
      Outfit
      OneCoolThing
    }
  }
`;
export const addedCharacterInPlay = /* GraphQL */ `
  subscription AddedCharacterInPlay {
    addedCharacterInPlay {
      CharacterId
      Character {
        PlayerName
        Name
        CharacterId
        Pronouns
        FirstImpression
        Outfit
        OneCoolThing
      }
      RoomId
      ConnectionId
    }
  }
`;
export const deletedCharacterInPlay = /* GraphQL */ `
  subscription DeletedCharacterInPlay {
    deletedCharacterInPlay {
      CharacterId
      Character {
        PlayerName
        Name
        CharacterId
        Pronouns
        FirstImpression
        Outfit
        OneCoolThing
      }
      RoomId
      ConnectionId
    }
  }
`;
export const changedCharacterInPlay = /* GraphQL */ `
  subscription ChangedCharacterInPlay {
    changedCharacterInPlay {
      CharacterId
      Character {
        PlayerName
        Name
        CharacterId
        Pronouns
        FirstImpression
        Outfit
        OneCoolThing
      }
      RoomId
      ConnectionId
    }
  }
`;
