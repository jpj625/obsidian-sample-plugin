import { App, HeadingCache, Notice, RequestUrlResponse, TFile, Vault } from "obsidian";
import KanKonnector from "main";
import { minimatch } from "minimatch";
import KankaClient from "./KankaClient";
import { EntityMetadata } from "data/Entities";
import { VaultCampaign } from "data/VaultCampaign";
import { VaultNote } from "data/VaultNote";
import { VaultNotePost } from "data/VaultNotePost";
import { KankaCampaign } from "data/KankaCampaign";
import Utils, { getRateLimiter } from "utils";
import { TagService } from "./TagService";
import { getegid, getuid } from "process";
import { randomUUID } from "crypto";

export default class SyncEngine {
    vault: Vault;
    client: KankaClient;
    campaigns: VaultCampaign[];
    app: App;

    private setStatus: (status: string) => void;

    constructor(plugin: KanKonnector) {
        this.client = new KankaClient(plugin.settings.kankaApiKey);
        this.app = plugin.app;
        this.vault = plugin.app.vault;
        this.campaigns = plugin.settings.campaigns;

        // no status bar on mobile apps
		this.setStatus = plugin.addStatusBarItem().setText;

        TagService.init(this.client);
    }

    public async getKankaCampaigns(): Promise<KankaCampaign[]> {
        return await this.client.getCampaigns();
    }

    public async getKankaTags(campaign: VaultCampaign): Promise<Record<string, number>> {
        return await this.client.getTags(campaign);
    }

    public async syncVaultCampaigns(files: TFile[] = []): Promise<PromiseSettledResult<void>[]> {
        let fileProgress = 0;
        let fileTotal = 0;

        function createProgressBarString(progress: number, total: number, length: number = 20): string {
            if (total <= 0 || progress < 0) { return `Calculating...`; }
            if (total === progress) { return `⭐ Completed! ⭐`; }
            const percentage = (progress / total) * 100;
            const completedLength = Math.round((length * progress) / total);
            return `[${'█'.repeat(completedLength)}${'░'.repeat(length - completedLength)}] (${progress}/${total}) ${percentage.toFixed(0)}%`;
        }
        const updateProgressBar = () => { this.setStatus(createProgressBarString(++fileProgress, fileTotal)); };
        updateProgressBar();

        const syncPromises: Promise<void>[] = [];

        for (const campaign of this.campaigns.filter(c => c.isEnabled)) {
            await TagService.FetchTagsFor(campaign);

            let campaignFiles = this.getVaultCampaignFiles(campaign);

            if (files.length) {
                const desiredFiles = new Set(files.map(f => f.path));
                campaignFiles = campaignFiles.filter(cf => desiredFiles.has(cf.path));
                // console.log({ desiredFiles, campaignFiles });
            }

            if (campaignFiles.length == 0) {
                new Notice(`⚠️ Campaign '${campaign.name}' has no files to sync.`, 15000);
                continue;
            }

            fileTotal += campaignFiles.length;
            const limiter = getRateLimiter(campaign);
            for (const file of campaignFiles) {
                const syncAndReport = async () => this.syncVaultCampaignFile(campaign, file).then(updateProgressBar);
                syncPromises.push(limiter.schedule(syncAndReport));
            }
        }

        setTimeout(() => this.setStatus(''), 10000);
        return await Promise.allSettled(syncPromises);
    }

    private async syncVaultCampaignFile(campaign: VaultCampaign, file: TFile) {
        console.log(this.syncVaultCampaignFile.name, `[${campaign.name}]`, file.name);

        const cachedFileContent = await this.vault.read(file);

        const msg = `Syncing: ${file.parent?.path}/${file.basename}...`;
        const toast = new Notice(msg + '      ');

        let metadata: EntityMetadata = { EntityType: 'UNDEFINED' };

        await app.fileManager.processFrontMatter(file,
            async (frontMatter: EntityMetadata) => {
                if (!frontMatter.name) frontMatter.name = file.basename;
                if (!frontMatter.campaign_id) frontMatter.campaign_id = campaign.campaignID;
                if (!frontMatter.campaign_name) frontMatter.campaign_name = campaign.name;
                Object.assign(metadata, frontMatter)
            });

        if (metadata.EntityType === 'UNDEFINED') return;

        console.groupCollapsed(`${TagService.convertVaultNamesToKankaIDs.name}:${metadata.name}`);
        // console.log('tags', { campaign: campaign.tags, metadata: metadata.tags});
        metadata.tagIDs = await TagService.convertVaultNamesToKankaIDs(campaign, metadata.tags);
        // console.log('metadata.tagIDs', metadata.tagIDs);
        console.groupEnd();

        const fileMetadata = this.app.metadataCache.getFileCache(file);
        const header1s = fileMetadata?.headings?.filter(hdr => hdr.level === 1) || [];

        if (header1s.length > 0) {
            const posts: VaultNotePost[] = [];
            const postByHeaderOffset = new Map<number, VaultNotePost>
            let entityEntry = cachedFileContent;
            let sequence = 0;

            // extract post content
            for (let i = 0; i < header1s.length; i++) {
                const hdr = header1s[i];
                const blockStart = hdr.position.start.offset;
                const bodyStart = hdr.position.end.offset + 1;
                const bodyEnd = i + 1 < header1s.length
                    ? header1s[i + 1].position.start.offset
                    : cachedFileContent.length;

                // the whole block, including H1 line
                const blockContent = cachedFileContent.substring(blockStart, bodyEnd);

                // the content under the H1, until end or next H1
                const postBody = cachedFileContent.substring(bodyStart, bodyEnd);

                // strip the post data out of the top-level entity entry
                entityEntry = entityEntry.replace(blockContent, '');

                // extract the title and ID from the H1 (# is left out of the hdr)
                const headingBits = hdr.heading.match(/^(?<title>.+?)(\s+?\^(?<id>\d+))?\s*$/);
                // console.log({ headingText, headingBits });
                if (!headingBits) {
                    throw 'wtf';
                    return;
                }

                // title the post without any ID, also capture the ID
                const post = new VaultNotePost(sequence++, headingBits.groups!['title'], Utils.ShowdownConverter.makeHtml(postBody));
                post.id = Number.parseInt(headingBits.groups?.['id'] || '🤔', 10) || undefined;

                postByHeaderOffset.set(hdr.position.start.offset, post);
                posts.push(post);
                // console.log('processed post', { post, text: { cachedFileContent, entityEntry, postBody } });
            }

            // upload entity without post content
            const entity = new VaultNote(campaign, metadata, Utils.ShowdownConverter.makeHtml(entityEntry));
            const entityResponse = await this.client.sync(entity);
            metadata = Object.assign(metadata, entityResponse?.json?.data || {});
            // console.log('posted entity', { entity, entityResponse, metadata });

            // upload each post in order
            posts.sort((postA, postB) => postA!.order - postB!.order);
            for (const post of posts) {
                const postResponse = await this.client.syncPost(entity, post);
                // console.log('posted post', { entity, post, postResponse });
                post.id = postResponse.json.data.id;
            }

            header1s.sort((hdrA, hdrB) => hdrB.position.start.offset - hdrA.position.start.offset);
            await this.app.vault.process(file, (liveFileContent) => {
                for (const hdr of header1s) {
                    const post = postByHeaderOffset.get(hdr.position.start.offset);
                    liveFileContent = [
                        liveFileContent.slice(0, hdr.position.start.offset),
                        '# ', post?.name, post?.id ? (` ^${post.id}`) : '',
                        liveFileContent.slice(hdr.position.end.offset)
                    ].join('');
                    // console.log('processed post id', { post, liveFileContent });
                };

                return liveFileContent;
            });
        } else {
            const entity = new VaultNote(campaign, metadata, Utils.ShowdownConverter.makeHtml(cachedFileContent));
            const entityResponse = await this.client.sync(entity);
            metadata = Object.assign(metadata, entityResponse?.json?.data || {});
            // console.log('posted entity', { entity, entityResponse, metadata });
        }

        await app.fileManager.processFrontMatter(file,
            (frontMatter: EntityMetadata) => {
                try {
                    if (!!metadata) {
                        // convert tag IDs back to tag strings for ease of use
                        console.groupCollapsed(`${TagService.convertKankaIDsToVaultNames.name}:${metadata.name}`);
                        frontMatter.tags = TagService.convertKankaIDsToVaultNames(campaign, metadata);
                        console.groupEnd();

                        const props: Record<string, { nested: boolean, force?: boolean }> = {
                            'entity_id': { nested: false, force: true },
                            'EntityType': { nested: false, force: true },
                            'id': { nested: false, force: true },
                            'name': { nested: false, force: true },
                            'created_at': { nested: true },
                            'created_by': { nested: true },
                            'updated_at': { nested: true },
                            'updated_by': { nested: true },
                            // 'image_full',
                            // 'image_thumb',
                            'is_private': { nested: false },
                            'location_id': { nested: true },
                            'urls': { nested: true },
                        };

                        for (const prop in props) {
                            const set = (value: any) => props[prop].nested
                                ? (frontMatter['kanka'] = frontMatter['kanka'] || {})[prop] = value
                                : frontMatter[prop] = value;
                            if (metadata[prop] == null && !props[prop].force) continue;
                            let value = metadata[prop];
                            switch (true) {
                                case typeof value === 'object': // dicts and
                                case Number.isInteger(Date.parse(value)): //  dates
                                    break; // are fine as-is

                                case /^true|false$/i.test(value): // bools
                                    value = /^true$/i.test(value); // get forced booly
                                    break;

                                case Number.isFinite(Number(value)): // just to be sure
                                    value = Number(value); break;
                            }
                            set(value);
                        }
                    }
                    toast.setMessage(msg + ' ✅');
                    setTimeout(toast.hide, 1000);
                } catch (error) {
                    console.log(error, file);
                    toast.setMessage(msg + ' 🤬');
                    setTimeout(toast.hide, 10000);
                }

                const gnu = Object.fromEntries(Object.entries(frontMatter).sort());
                for (const key in frontMatter) delete frontMatter[key];
                Object.assign(frontMatter, gnu);
            });
    }

    private getVaultCampaignFiles(campaign: VaultCampaign) {
        // console.log(campaign.name, 'getCampaignFiles');
        const matchesGlob = !!campaign.glob ? minimatch.filter(campaign.glob!) : () => true;
        return this.vault.getMarkdownFiles()
            .filter(file => file instanceof TFile)
            .filter(file => file.path.startsWith(campaign.path))
            .filter(file => matchesGlob(file.path));
    }
}
