export interface IEntityResponse<TEntity>
{
    status: number;
    headers: Record<string, string>;
    // arrayBuffer: ArrayBuffer;
    json: {
        data: TEntity;
        links: {
            first: string;
            last: string;
            next: string;
            prev: string;
        };
    };
    text: string;
}