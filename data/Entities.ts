import { EntityType } from "./EntityType";

export type EntityMetadata = {
    [index: string]: any;
    EntityType: EntityType;
    id?: number;
    entity_id?: number;
    name?: string;
    image?: string;
    is_private?: boolean;
    is_template?: boolean;
    last_update?: Date;
    tags?: string[];
    tagIDs?: number[];
};

type KankaEntity = EntityMetadata
    & {
        entry: string
        created_at: Date
        created_by: number
        updated_at: Date
        updated_by: number
    };

type HasFamily = { family_id?: number };
type HasImage = { image_url?: string };
type HasLocation = { location_id?: number };
type HasType = { type?: string };

export type KankaCharacter = KankaEntity
    & {
        EntityType: 'character'
        title?: string
        age?: number
        sex?: string
        pronouns?: string
        races?: number[]
        families?: number[]
        is_dead: boolean
    }
    & HasLocation
    & HasFamily
    & HasImage;

export type KankaLocation = KankaEntity
    & {
        EntityType: 'location'
        parent_location_id?: number
    }
    & HasType
    & HasLocation
    & HasImage;

export type KankaFamily = KankaEntity
    & {
        EntityType: 'family'
    }
    & HasType
    & HasLocation
    /// parent
    & HasFamily
    & HasImage;

export type KankaNote = KankaEntity
    & {
        EntityType: 'note'
        /// parent
        note_id?: number
    }
    & HasType
    & HasLocation
    & HasImage;

export type KankaItem = KankaEntity
    & {
        EntityType: 'item'
        character_id?: number
        price?: string
        size?: string
        /// parent
        item_id?: number
    }
    & HasType
    & HasLocation
    & HasImage;

export type KankaOrg = KankaEntity
    & {
        EntityType: 'organisation'
        /// parent
        organisation_id?: number
        is_defunct: boolean
    }
    & HasType
    & HasLocation
    & HasImage;

export type KankaCreature = KankaEntity
    & {
        EntityType: 'creature'
        /// parent
        creature_id?: number
        locations: number[]
    }
    & HasType
    & HasImage;

export type KankaRace = KankaEntity
    & {
        EntityType: 'race'
        /// parent
        race_id?: number
    }
    & HasType
    & HasImage;

export type KankaQuest = KankaEntity
    & {
        EntityType: 'quest'
        /// parent
        quest_id?: number
        character_id?: number
    }
    & HasType
    & HasImage;

export type KankaJournal = KankaEntity
    & {
        EntityType: 'journal'
        date: string
        /// parent
        journal_id?: number
        author_id?: number
    }
    & HasType
    & HasImage;

export type KankaTag = KankaEntity
    & {
        EntityType: 'tag'
        colour: string
        /// parent
        tag_id?: number
        is_auto_applied: boolean
        is_hidden: boolean
    }
    & HasType
    & HasImage;

