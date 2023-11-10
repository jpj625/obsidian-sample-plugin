
export class VaultNotePost {
    id?: number;
    name: string;
    content?: string;
    order: number;

    constructor(order: number, name: string, content?: string, id?: number) {
        this.order = order;
        this.name = name;
        this.content = content || '';
        this.id = id;
    }
}
