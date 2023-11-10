import { Notice, Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, Settings } from "settings/Settings";
import KanKonnectorSettingTab from 'settings/KanKonnectorSettingTab';
import SyncEngine from 'client/SyncEngine';

/*
Zicon#4957
Azurewren#3751

https://kanka.io/en/campaign/194416/entities/4541700/entry

https://github.com/showdownjs/showdown/wiki/Extensions

https://github.com/jenningsb2/copy-as-html/blob/master/main.ts

https://forum.obsidian.md/t/inter-plugin-communication-expose-api-to-other-plugins/23618
https://www.reddit.com/r/ObsidianMD/comments/xzv7zv/how_to_call_functionscommands_of_one_plugin_from/

https://help.obsidian.md/Editing+and+formatting/Obsidian+Flavored+Markdown
https://github.com/commonmark/commonmark-spec/wiki/List-of-CommonMark-Implementations
https://github.com/syntax-tree/mdast-util-gfm
https://github.com/AnyhowStep/flavormark
https://github.com/markdown-it/markdown-it
*/

export default class KanKonnector extends Plugin {
	settings: Settings;
	engine: SyncEngine;

	async onload() {
		this.settings = await this.loadSettings();
		this.engine = new SyncEngine(this);

		this.addSettingTab(new KanKonnectorSettingTab(this));

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'upload',
			name: 'Upload Vault to Kanka',
			callback: this.engine.syncVaultCampaigns.bind(this),
		});

		// This creates an icon in the left ribbon
		const ribbonIconEl = this.addRibbonIcon(
			'dice',
			'KanKonnector - Sync Current (Sync All)',
			async (evt: MouseEvent) => {
				console.clear();
				switch (evt.button) {
					case 0:
					case 1:
						new Notice('Syncing current note...', 1500);
						try {
							const file = app.workspace.getActiveFile();
							if (!file) throw 'No active file!';
							await this.engine.syncVaultCampaigns([file]);
						} catch (error) {
							console.log(error);
							new Notice(`Syncing current note failed: ${error.message}`);
						}
						break;
					case 2:
						new Notice('Syncing all campaigns in vault...', 3000);
						try {
							return await this.engine.syncVaultCampaigns();
						} catch (error) {
							console.log(error);
							new Notice(`Syncing vault failed: ${error.message}`);
						}
						break;
				}
			});

		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds an editor command that can perform some operation on the current editor instance
		//   this.addCommand({
		//   	id: 'sample-editor-command',
		//   	name: 'Sample editor command',
		//   	editorCallback: (editor: Editor, view: MarkdownView) => {
		//   		console.log(editor.getSelection());
		//   		editor.replaceSelection('Sample Editor Command');
		//   	}
		//   });

		// This adds a complex command that can check whether the current state of the app allows execution of the command
		//   this.addCommand({
		//   	id: 'open-sample-modal-complex',
		//   	name: 'Open sample modal (complex)',
		//   	checkCallback: (checking: boolean) => {
		//   		// Conditions to check
		//   		return true;
		//   	}
		//   });


		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		//   this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
		// 	  console.log('click', evt);
		//   });

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		//   this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {
	}

	async loadSettings() {
		return Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	public saveSettings = async () => await this.saveData.bind(this)(this.settings);
}
