import { App, Setting, Modal } from 'obsidian';
import { VaultCampaign } from "../data/VaultCampaign";
import { fragWithHTML } from 'utils';
import { TagService } from 'client/TagService';

export class KanKonnectorSettingAdvancedModal extends Modal {
	private campaign: VaultCampaign;
	private onSubmit: () => void;

	constructor(app: App, campaign: VaultCampaign, onSubmit: () => void) {
		super(app);
		this.campaign = campaign;
		this.onSubmit = onSubmit;
	}

	onOpen(): void {
		this.titleEl.setText(`${this.campaign.name} Advanced Settings`);

		new Setting(this.contentEl)
			.setName("Content Glob")
			.addText((text) => text.setPlaceholder('**/*.md')
				.setValue(this.campaign.glob ?? '')
				.onChange((value) => {
					this.campaign.glob = value || undefined;
				}))
			.nameEl.append(
				fragWithHTML(`<a class="info-link" title="Contant matching glob. To select only certain files within the Campaign folder." href="https://en.wikipedia.org/wiki/Glob_(programming)">❔</a>`)
			);

		new Setting(this.contentEl)
			.addTextArea(ta => ta
				.setDisabled(true)
				.setValue(JSON.stringify(TagService.GetTagsFor(this.campaign)))
			);

	}

	onClose() {
		this.titleEl.empty();
		this.contentEl.empty();
		this.onSubmit();
	}
}
