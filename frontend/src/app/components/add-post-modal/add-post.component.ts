import { Component, Inject } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Board } from 'src/app/models/board';
import Bucket from 'src/app/models/bucket';
import Post, { PostType, Tag } from 'src/app/models/post';
import User from 'src/app/models/user';
import { CanvasService } from 'src/app/services/canvas.service';
import {
  NEEDS_ATTENTION_TAG,
  POST_COLOR,
  POST_TAGGED_BORDER_THICKNESS,
} from 'src/app/utils/constants';
import { MyErrorStateMatcher } from 'src/app/utils/ErrorStateMatcher';
import { FabricUtils } from 'src/app/utils/FabricUtils';
import { FabricPostComponent } from '../fabric-post/fabric-post.component';

export interface AddPostDialog {
  type: PostType;
  user: User;
  board: Board;
  bucket?: Bucket;
  spawnPosition: { left: Number; top: Number };
  onComplete?: (post: Post) => any;
}

@Component({
  selector: 'app-dialog',
  templateUrl: './add-post.component.html',
  styleUrls: ['./add-post.component.scss'],
})
export class AddPostComponent {
  user: User;
  board: Board;

  title: string = '';
  message: string = '';

  tags: Tag[] = [];
  tagOptions: Tag[] = [];

  titleControl = new FormControl('', [
    Validators.required,
    Validators.maxLength(50),
  ]);
  msgControl = new FormControl('', [Validators.maxLength(1000)]);
  matcher = new MyErrorStateMatcher();

  constructor(
    public canvasService: CanvasService,
    public fabricUtils: FabricUtils,
    public dialogRef: MatDialogRef<AddPostComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AddPostDialog
  ) {
    this.user = data.user;
    this.board = data.board;
    this.tagOptions = data.board.tags.filter(
      (n) => !this.tags.map((b) => b.name).includes(n.name)
    );
  }

  addTag(event, tagOption): void {
    event.stopPropagation();
    this.tags.push(tagOption);
    this.tagOptions = this.tagOptions.filter((tag) => tag != tagOption);
  }

  removeTag(tag) {
    const index = this.tags.indexOf(tag);
    if (index >= 0) {
      this.tags.splice(index, 1);
    }

    this.tagOptions.push(tag);
  }

  async addPost() {
    const containsAttentionTag = this.tags.find(
      (tag) => tag.name == NEEDS_ATTENTION_TAG.name
    );

    var fabricPost = new FabricPostComponent({
      postID: Date.now() + '-' + this.user.userID,
      boardID: this.board.boardID,
      title: this.title,
      author: this.user.username,
      authorID: this.user.userID,
      desc: this.message,
      tags: this.tags,
      lock: !this.board.permissions.allowStudentMoveAny,
      left: this.data.spawnPosition.left,
      top: this.data.spawnPosition.top,
      color: POST_COLOR,
      stroke: containsAttentionTag ? NEEDS_ATTENTION_TAG.color : null,
      strokeWidth: containsAttentionTag ? POST_TAGGED_BORDER_THICKNESS : null,
    });

    const post: Post = this.fabricUtils.fromFabricPost(fabricPost);
    await this.canvasService.createPost(post);
    return post;
  }

  async addBucketPost() {
    const boardID: string = this.data.bucket!.bucketID;
    const post: Post = {
      postID: Date.now() + '-' + this.user.userID,
      title: this.title,
      desc: this.message,
      tags: this.tags,
      userID: this.user.userID,
      boardID: this.board.boardID,
      fabricObject: null,
    };

    return await this.canvasService.createBucketPost(boardID, post);
  }

  async handleDialogSubmit() {
    let post: Post;

    if (this.data.type == PostType.BUCKET && this.data.bucket) {
      post = await this.addBucketPost();
    } else {
      post = await this.addPost();
    }

    if (this.data.onComplete) {
      this.data.onComplete(post);
    }

    this.dialogRef.close();
  }

  onNoClick(): void {
    this.dialogRef.close();
  }
}
