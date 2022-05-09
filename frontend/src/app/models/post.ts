export default class Post {
    postID: string;
    boardID: string;
    title: string;
    desc: string;
    tags: Tag[];
    userID: string;
    fabricObject: string|null;
    timestamp?: number;
}
  
export class Tag {
    boardID?: string;
    name: string;
    color: string;
}

export enum PostType {
    BOARD,
    BUCKET
}