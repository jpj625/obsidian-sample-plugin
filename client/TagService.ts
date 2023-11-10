import KankaClient from "./KankaClient";
import { EntityMetadata, KankaTag } from "data/Entities";
import { VaultCampaign } from "data/VaultCampaign";
import { VaultNote } from "data/VaultNote";
import { IEntityResponse } from "data/IEntityResponse";

export class TagService {
    static client: KankaClient;

    public static init(client: KankaClient) {
        TagService.client = client;
        // client.getCampaigns()
        //     .then(campaigns => campaigns
        //         .map(VaultCampaign.convert)
        //         .forEach(TagService.FetchTagsFor));
    }

    private static _tags: Map<number, Record<string, number>> = new Map();
    private static _calls: Record<number, number> = {};

    public static GetTagsFor(campaign: VaultCampaign): Record<string, number> {
        if (!this._tags.has(campaign.campaignID)) this.SetTagsFor(campaign);
        return this._tags.get(campaign.campaignID)!;
    }

    private static SetTagsFor(campaign: VaultCampaign, tags: Record<string, number> = {}) {
        return this._tags.set(campaign.campaignID, tags);
    }

    public static async FetchTagsFor(campaign: VaultCampaign) {
        console.log(this.FetchTagsFor.name, campaign.name);
        
        const now = Date.now();
        const last = TagService._calls[campaign.campaignID] || Number.NEGATIVE_INFINITY;
        const diff = now - last;
        // console.log({now, last, diff});
        
        if (diff > 1000 * 60 * 5) {
            TagService._calls[campaign.campaignID] = now;
            // console.log('GET');
            return TagService.SetTagsFor(campaign, await TagService.client.getTags(campaign));
        }

        // console.log('cache');
        return TagService.GetTagsFor(campaign);
    }

    public static async convertVaultNamesToKankaIDs(campaign: VaultCampaign, tags: string[] = []): Promise<number[]> {
        const tagIDs: number[] = [];
        const campaignTags = TagService.GetTagsFor(campaign)!;

        for (const tagName of tags?.map(String)) {
            if (!(tagName in campaignTags)) {
                const tag = new VaultNote(campaign, { EntityType: 'tag', name: tagName });
                const response = await TagService.client.sync(tag) as IEntityResponse<KankaTag>;
                campaignTags[tagName] = response.json.data.id!;
            }

            console.log(`found tag [${tagName}:${campaignTags[tagName]}]`);
            tagIDs.push(campaignTags[tagName]);
        };

        console.log({campaignTags, cache: TagService.GetTagsFor(campaign)});

        return tagIDs;
    }

    public static convertKankaIDsToVaultNames(campaign: VaultCampaign, metadata: EntityMetadata) {
        const tagIDs = new Set(metadata?.tagIDs);
        const campaignTags = TagService.GetTagsFor(campaign)!;
        const existingTagPairs = Object.entries(campaignTags);

        return existingTagPairs
            .filter(tag => tagIDs.has(tag[1]))
            .map(tag => tag[0])
            .map(String);
    }
}

