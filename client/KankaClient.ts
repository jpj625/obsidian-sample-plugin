import { requestUrl, RequestUrlResponse } from "obsidian";
import { VaultCampaign } from "data/VaultCampaign";
import { KankaTag } from "data/Entities";
import { VaultNote } from "data/VaultNote";
import { VaultNotePost } from "data/VaultNotePost";
import { EntityType } from "data/EntityType";
import { KankaCampaign } from "data/KankaCampaign";
import { IEntityResponse } from "data/IEntityResponse";

const appJSON = 'application/json';

export default class KankaClient {
    static parameters: Record<string, string>;

    ROOT = 'https://api.kanka.io/1.0/campaigns';

    routes: { [type in EntityType]: string } = {
        'character': 'characters',
        entity: 'entities',
        // entity_asset: 'entity_assets',
        // attribute: 'attributes', // entities/{entity.id}/attributes
        note: 'notes',
        post: 'posts',  // entities/{entity.id}/notes
        // relation: 'relations',
        event: 'events',
        creature: 'creatures',
        family: 'families',
        item: 'items',
        journal: 'journals',
        location: 'locations',
        // organisation_member: 'organisation_members',
        organisation: 'organisations',
        quest: 'quests',
        race: 'races',
        tag: 'tags',
        UNDEFINED: 'UNDEFINED',
    };

    constructor(kankaApiKey: string) {
        KankaClient.parameters = {
            Accept: appJSON,
            Authorization: `Bearer ${kankaApiKey}`,
        };
    }

    public async getCampaigns(): Promise<KankaCampaign[]> {
        return await requestUrl({
            url: [this.ROOT].join('/'),
            method: 'GET',
            headers: KankaClient.parameters,
            throw: false,
        }).then(response => response.json.data);
    }

    public async getTags(campaign: VaultCampaign): Promise<Record<string, number>> {
        const req = {
            url: [this.ROOT, campaign.campaignID, this.routes['tag']].join('/'),
            method: 'GET',
            headers: KankaClient.parameters,
            contentType: appJSON,
        };
        console.log({ req });

        let response: IEntityResponse<KankaTag[]> | null = null;

        const tags: Record<string, number> = {};
        do {
            if (!!response?.json?.links?.next) {
                req.url = response.json.links.next;
            }

            response = await requestUrl(req);
            console.log({ response });
            if (!response || response.status >= 400) {
                console.error(response);
                break;
            }

            response.json.data.forEach(tag => tags[tag.name!] = tag.id!);
        } while (!!response.json.links.next)

        console.log(campaign.name, this.getTags.name, tags);
        return tags;
    }

    public async sync(note: VaultNote) {
        // console.warn(this.sync.name, note);
        return await this.send(!!note.metadata?.id ? 'PATCH' : 'POST', note);
    }

    public async syncPost(entity: VaultNote, post: VaultNotePost): Promise<RequestUrlResponse> {
        // console.warn(this.syncPost.name, entity, post);
        return await this.sendPost(post.id ? 'PATCH' : 'POST', entity, post);
    }

    private async sendPost(verb: 'POST' | 'PATCH' | 'GET', entity: VaultNote, post: VaultNotePost): Promise<RequestUrlResponse> {
        // console.warn(this.sendPost.name, verb, entity, post);
        const req = {
            url: [
                this.ROOT, entity.campaign.campaignID,
                this.routes['entity'], entity.metadata.entity_id,
                this.routes['post'], post.id
            ]
                .filter(o => o) // removes empty elements cleanly (e.g. no ID)
                .join('/'),
            method: verb,
            headers: KankaClient.parameters,
            contentType: appJSON,
            body: JSON.stringify({
                name: post.name,
                entry: post.content,
                entity_id: entity.metadata.entity_id,
                position: post.order,
                visibility_id: 1, // TODO - allow setting visibility
                /* 1 for all, 2 self, 3 admin, 4 self-admin or 5 members. */
            }),
        };

        // console.log({ req });
        const response = await requestUrl(req);
        // console.log({ response });
        return response;
    }

    private async send(verb: 'POST' | 'PATCH' | 'GET', note: VaultNote): Promise<RequestUrlResponse> {
        // console.warn(this.send.name, verb, note);
        const req = {
            url: [
                this.ROOT, note.campaign.campaignID,
                this.routes[note.metadata.EntityType!], note.metadata.id
            ]
                .filter(o => o) // removes empty elements cleanly (e.g. no ID)
                .join('/'),
            method: verb,
            headers: KankaClient.parameters,
            contentType: appJSON,
            body: JSON.stringify({
                name: note.metadata.name,
                entry: note.body,
                is_private: note.metadata.is_private,
                is_template: note.metadata.is_template,
                tags: note.metadata.tagIDs,
            }),
        };

        // console.log({ req });
        const response = await requestUrl(req);
        // console.log({ response });
        return response;
    }
}


