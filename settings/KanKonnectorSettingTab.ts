import { Notice, PluginSettingTab, Setting, TFolder } from 'obsidian';
import type KanKonnector from "main";
import FolderSuggester from './FolderSuggester';
import { VaultCampaign } from "../data/VaultCampaign";
import { KanKonnectorSettingAdvancedModal } from './KanKonnectorSettingAdvancedModal';
import { fragWithHTML } from 'utils';
import { KankaCampaign } from 'data/KankaCampaign';

export default class KanKonnectorSettingTab extends PluginSettingTab {
	plugin: KanKonnector;

	constructor(plugin: KanKonnector) {
		super(app, plugin);
		this.plugin = plugin;
	}

	public async addCampaign() {
		this.plugin.settings.campaigns.push(new VaultCampaign());
	}

	public async fetchAndMergeKankaCampaigns(): Promise<void> {

		const campaignData = await this.plugin.engine.getKankaCampaigns();

		console.log({ campaignData });

		this.plugin.settings.campaigns = this.mergeArrays(this.plugin.settings.campaigns, campaignData)
			.sort((a, b) => a.name == b.name ? 0 : (a.name > b.name ? 1 : -1));

		const campaignsMissingFolder = this.plugin.settings.campaigns
			.filter(c => !!c.campaignID)
			.filter(c => !c.path);

		console.groupCollapsed('Campaigns')
		console.table(campaignData);

		// fill missing paths with matching folder, if any
		if (!!campaignsMissingFolder.length) {
			const folders = [] as TFolder[];
			function collectAllFolders(root: TFolder) {
				for (const child of root.children) {
					if (child instanceof TFolder) {
						folders.push(child);
						collectAllFolders(child);
					}
				}
			}
			collectAllFolders(this.app.vault.getRoot());
			console.log({ folders });

			campaignsMissingFolder.forEach(c => {
				const matches = folders.filter(f => f.name == c.name);
				if (matches.length == 1)
					c.path = matches[0].path;
				c.isEnabled = !!c.path;
			});
		}

		console.table(this.plugin.settings.campaigns);
		console.groupEnd();
	}

	public display(): void {
		const { containerEl } = this;

		containerEl.empty();
		containerEl.addClass('kankonnector-settings');
		this.plugin.loadSettings();

		// sort campaigns either alpha/num for presentation
		this.plugin.settings.campaigns.sort((c1, c2) => {
			return (c1.name == c1.campaignID.toString() && c2.name == c2.campaignID.toString())
				? c1.campaignID - c2.campaignID
				: c1.name.localeCompare(c2.name);
		});

		containerEl.createEl('h1', { text: 'KanKonnector' });

		const settings = {
			apiKey: new Setting(containerEl)
				.setName('Kanka API Key')
				.setDesc(fragWithHTML(`Uses the official Kanka API (<a href='https://app.kanka.io/api-docs/1.0/overview'>docs 🔗</a>) to perform actions.<br/>
					Visit your <a href='https://app.kanka.io/settings/api'>Kanka Settings</a> to create a new API Key.`))
				.addTextArea(text => text
					.setPlaceholder('eyJ0...')
					.setValue(this.plugin.settings.kankaApiKey)
					.onChange(async (value) => {
						this.plugin.settings.kankaApiKey = value;
						await this.plugin.saveSettings();
						this.display();
					})
				),

			action: new Setting(containerEl)
				.setHeading()
				.setName('Actions')

				.addButton(btn => btn
					.setButtonText('Fetch Campaigns')
					.setDisabled(!this.plugin.settings.kankaApiKey)
					.onClick(async () => {
						campaignTable.style.opacity = '0.4';
						await this.fetchAndMergeKankaCampaigns();
						await this.plugin.saveSettings();
						this.display();
					}))

				.addButton(btn => btn
					.setButtonText('Sync!')
					.setDisabled(!this.plugin.settings.kankaApiKey)
					.setCta() // call to action - make primary
					.setTooltip("Puts the lime in the coconut and shakes it ALL up.")
					.onClick(this.plugin.engine.syncVaultCampaigns.bind(this.plugin)))

				.addExtraButton(btn2 => btn2
					.setIcon('dice')
					.setTooltip("sir and/or ma'am this is a wendys")
					.onClick(async () => {
						new Notice(`I'm also trying!!`);
					})),

			campaignHeader: new Setting(containerEl)
				.setHeading()
				.setName(fragWithHTML('<h3>Campaign Folders</h3>'))
				.setDesc('Add or remove campaign folder mappings.')
				.addButton((button) => {
					button
						.setButtonText('Add Campaign')
						.onClick(async () => {
							this.addCampaign();
							await this.plugin.saveSettings();
							this.display();
						});
				}),
		};

		const campaignDiv = containerEl.createDiv();
		const campaignTable = campaignDiv.createEl('table');
		campaignTable.className = 'campaign-table';

		const headerRow = campaignTable.createEl('tr');
		new Setting(headerRow.createEl('th'))
			.setName('Name');

		new Setting(headerRow.createEl('th'))
			.setName('Folder')
			.setTooltip('The vault folder that maps to a Kanka campaign');

		new Setting(headerRow.createEl('th'))
			.setName('Campaign ID')
			.setTooltip('The campaign ID from Kanka: https://app.kanka.io/w/{campaignID}');

		new Setting(headerRow.createEl('th')).setName('Boosted')
			.nameEl.append(
				fragWithHTML(`<a class="info-link" title="Campaign Boosted status. Impacts API rate limits." href="https://kanka.io/en/settings/boosters">❔</a>`)
			);

		new Setting(headerRow.createEl('th')).setName('Enabled')
			.nameEl.append(
				fragWithHTML(`<a class="info-link" title="If disabled, notes will not be synced to Kanka.">❔</a>`)
			);

		new Setting(headerRow.createEl('th')).setName('');
		new Setting(headerRow.createEl('th')).setName('');

		this.plugin.settings.campaigns
			.map((vaultCampaign, index) => {
				const campaignRow = campaignTable.createEl('tr');

				new Setting(campaignRow.createEl('td'))
					.setName(vaultCampaign.name);

				new Setting(campaignRow.createEl('td'))
					.setTooltip('Enter the path to a campaign folder.')
					.setClass('campaign-folder')
					.addSearch((search) => {
						new FolderSuggester(this.app, search.inputEl);
						search
							.setPlaceholder('path/to/folder')
							.setValue(vaultCampaign.path)
							.onChange((value) => {
								const campaign = this.plugin.settings.campaigns[index];
								campaign.path = value.replace(/\/$/, '');
								campaign.name = campaign.path.split('/')?.last() || '';
								this.plugin.saveSettings();
								this.display();
							});
					});

				new Setting(campaignRow.createEl('td'))
					.setTooltip('Enter the ID of the Campaign on Kanka.')
					.setClass('campaign-id')
					.addText((text) => text
						.setPlaceholder('campaignID')
						.setValue(vaultCampaign.campaignID?.toString() ?? '')
						.onChange((value) => {
							const num = parseInt(value);
							if (!isNaN(num)) {
								this.plugin.settings.campaigns[index].campaignID = num;
								this.plugin.saveSettings();
							}
						})
					);

				new Setting(campaignRow.createEl('td'))
					.addToggle(check => check
						.setTooltip('Does Kanka show this Campaign as boosted/premium?')
						.setValue(vaultCampaign.isBoosted)
						.setDisabled(true)
					);

				new Setting(campaignRow.createEl('td'))
					// .setName('Enabled')
					.addToggle(check => check
						.setTooltip('Enable syncing this campaign?')
						.setValue(vaultCampaign.isEnabled)
						.onChange(checked => {
							this.plugin.settings.campaigns[index].isEnabled = checked;
							this.plugin.saveSettings();
							this.display();
						})
					);

				new Setting(campaignRow.createEl('td'))
					.addExtraButton(btn => btn
						.setIcon('gear')
						.setDisabled(!vaultCampaign.isEnabled)
						.setTooltip('Campaign-specific Advanced Settings')
						.onClick(() =>
							new KanKonnectorSettingAdvancedModal(app, this.plugin.settings.campaigns[index], this.plugin.saveSettings).open()
						)
					);

				new Setting(campaignRow.createEl('td'))
					.addExtraButton(btn => btn
						.setIcon('cross')
						.setTooltip('Remove Campaign linkage')
						.onClick(() => {
							if (confirm('This will remove the campaign connection settings, but not any content. Continue?')) {
								this.plugin.settings.campaigns.splice(index, 1);
								this.plugin.saveSettings();
								this.display();
							}
						})
					);
			});


		function isAnyPathNested(paths: string[]): boolean {
			for (let i = 0; i < paths.length; i++) {
				for (let j = 0; j < paths.length; j++) {
					if (i !== j && paths[j].startsWith(paths[i])) {
						return true;
					}
				}
			}
			return false;
		}

		const paths = this.plugin.settings.campaigns.map(c => c.path);

		const isDupe = paths.length !== paths.unique().length;
		const isNested = isAnyPathNested(paths);

		function showError(msg: string) {
			const errorDiv = containerEl.createDiv();
			const err = errorDiv.createEl('h5');
			err.style.color = 'maroon';
			err.style.backgroundColor = 'silver';
			err.style.padding = '4px';
			err.innerHTML = msg;
		}

		if (isDupe) showError('More than one Campaign specifies the same folder.<br>This probably won\'t work and may have unintended consequences.');
		if (isNested) showError('At least one folder is nested under another.<br>This probably won\'t work and may have unintended consequences.');
	}

	private mergeArrays(
		configuredCampaigns: VaultCampaign[],
		downloadedCampaigns: KankaCampaign[]
	): VaultCampaign[] {
		console.log({ configuredCampaigns, downloadedCampaigns });
		const merged: VaultCampaign[] = [];
		const mergedIDs = new Set<number>();

		const campaignMap = new Map(configuredCampaigns.map(c => [c.campaignID, c]));

		for (const downloadedCampaign of downloadedCampaigns) {
			const convertedCampaign = VaultCampaign.convert(downloadedCampaign);

			if (campaignMap.has(convertedCampaign.campaignID)) {
				const currentCampaign = campaignMap.get(convertedCampaign.campaignID)!;
				merged.push(currentCampaign);
				mergedIDs.add(currentCampaign.campaignID);
			} else {
				campaignMap.set(convertedCampaign.campaignID, convertedCampaign);
				merged.push(convertedCampaign);
				mergedIDs.add(convertedCampaign.campaignID);
			}
		}

		// for (const campaign of configuredCampaigns.concat(
		// 	downloadedCampaigns.map(VaultCampaign.convert))
		// ) {
		// 	if (!campaign.campaignID) {
		// 		// incomplete, just leave it alone
		// 		merged.push(campaign);
		// 		continue;
		// 	}

		// 	const id = campaign.campaignID;
		// 	if (!mergedIDs.has(id)) {
		// 		mergedIDs.add(id);
		// 		merged.push(campaign);
		// 	} else {
		// 		const existingObj = merged.find(o => o.campaignID === id);
		// 		if (existingObj) {
		// 			Object.assign(existingObj, campaign);
		// 		}
		// 	}
		// }

		return merged;
	}
}
