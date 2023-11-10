import Bottleneck from "bottleneck";
import { VaultCampaign } from "data/VaultCampaign";
import Showdown, { ShowdownExtension } from "showdown";

export function fragWithHTML(html: string): DocumentFragment {
	return createFragment((frag) => (frag.createSpan().innerHTML = html));
}

const limiters: Record<number, Bottleneck> = {};
export function getRateLimiter(campaign: VaultCampaign): Bottleneck {
	const campaignRateLimit = campaign.isBoosted ? 90 : 30;
	// https://github.com/SGrondin/bottleneck#readme
	return limiters[campaign.campaignID] ||
		(limiters[campaign.campaignID] = new Bottleneck({
			reservoir: campaignRateLimit,
			reservoirRefreshAmount: campaignRateLimit,
			reservoirRefreshInterval: 60 * 1000,
			maxConcurrent: 1,
			// minTime: 10000 / campaignRateLimit,
		}));
}

export default class Utils {
	private static embeddedLinks: Record<string, object> = {};

	private static showdownConverter = (() => {
		Showdown.extension(Utils.ObsidianMarkdownExtensions.name, Utils.ObsidianMarkdownExtensions());
		const sd = new Showdown.Converter();
		sd.setFlavor('github');
		sd.setOption('metadata', true);
		sd.setOption('openLinksInNewWindow', true);
		sd.setOption('parseImgDimensions', true);
		sd.setOption('requireSpaceBeforeHeadingText', true);
		sd.setOption('underline', true);

		sd.useExtension(Utils.ObsidianMarkdownExtensions.name);
		return sd;
	})();

	/***
	 * A singleton of Showdown.Converter configured for github-flavored Markdown
	 * with ObsidianMarkdownExtensions to refine linking
	 */
	public static get ShowdownConverter() {
		return Utils.showdownConverter;
	}

	public static ObsidianMarkdownExtensions(): ShowdownExtension[] {
		const linker = {
			type: 'lang',
			regex: /(?<embed>!)?\[\[(?<link>[^\]|]+)(?:\|(?<alias>[^\]]+))?\]\]/g, // finds [[linkies|with stuff]]
			replace: (match: string,
				embed: string, link: string, stuff: string,
				offset: number, _: any, groups: Record<string, string>) => {

				if (!!groups.embed) {
					this.embeddedLinks[groups.link] = groups;
					return match;
				}

				let size = '';
				if (Number.isNumber(stuff)) {
					size = ` height="${stuff}" width="${stuff}"`;
					stuff = '';
				}

				return `<a href="${link}"${size}>${stuff || link}</a>`;
			}
		};

		const nooper = {
			type: 'lang',
			filter: function (text: string, readonlyConverter: Showdown.Converter, options: Showdown.ConverterOptions) {
				return text;
			}
		};

		return [linker, nooper];
	}
}