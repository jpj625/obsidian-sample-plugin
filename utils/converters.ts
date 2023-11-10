import * as showdown from "showdown";

export default class {
    static markdownToHtml(md: string) {
        const converter = new showdown.Converter({
            completeHTMLDocument: false,
            customizedHeaderId: true,
            ghCompatibleHeaderId: false,
            metadata: true,
            parseImgDimensions: true,
            splitAdjacentBlockquotes: true,
            strikethrough: true,
            tables: true,
            underline: true,
        });
        
        converter.setFlavor('vanilla');
        // converter.setFlavor('github');

        const noBrackets = md.replace(/\[\[(?:[^\]]+\|)?([^\]]+)\]\]/g, '$1');

        const html = `<!-- directives:[] -->
        <div id="content">${converter.makeHtml(noBrackets)}</div>`;

        return html;
    }

    static htmlToMarkdown(html: string): string {
        const converter = new showdown.Converter({
            completeHTMLDocument: false,
            customizedHeaderId: true,
            ghCompatibleHeaderId: false,
            metadata: true,
            parseImgDimensions: true,
            splitAdjacentBlockquotes: true,
            strikethrough: true,
            tables: true,
            underline: true,
        });
        
        converter.setFlavor('vanilla');
        
        // const noBrackets = html.replace(/\[\[(?:[^\]]+\|)?([^\]]+)\]\]/g, '$1');

        const md = converter.makeMarkdown(html);

        // const html = converter.makeHtml(noBrackets).toString();

        return md;
    }
}