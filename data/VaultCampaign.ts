import Bottleneck from "bottleneck";
import { KankaCampaign } from "./KankaCampaign";

export class VaultCampaign  {
	campaignID: number;
	name: string;
	path: string;
	glob?: string;
	isEnabled: boolean;
	isBoosted: boolean;

	constructor() {
		this.name = '';
		this.path = '';
		this.isEnabled = false;
	}

	static convert(campaign: KankaCampaign) {
		const vc = new VaultCampaign();
		vc.campaignID = campaign.id;
		vc.isBoosted = campaign.boosted || campaign.superboosted || campaign.premium;
		vc.name = campaign.slug;
		return vc;
	}
}
