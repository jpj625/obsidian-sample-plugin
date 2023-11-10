import { VaultCampaign } from "data/VaultCampaign";
import { EntityMetadata } from "data/Entities";

export class VaultNote {
    campaign: VaultCampaign;
    metadata: EntityMetadata;
    body?: string;

    constructor(campaign: VaultCampaign, metadata: EntityMetadata, body?: string) {
        this.campaign = campaign;
        this.metadata = metadata;
        this.body = body;
    }
}
