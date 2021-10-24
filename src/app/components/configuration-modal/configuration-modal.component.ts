import { Component, Inject } from '@angular/core';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { BoardService } from 'src/app/services/board.service';
import { MatChipInputEvent } from '@angular/material/chips';

@Component({
  selector: 'app-configuration-modal',
  templateUrl: './configuration-modal.component.html',
  styleUrls: ['./configuration-modal.component.scss']
})
export class ConfigurationModalComponent {
  readonly separatorKeysCodes = [ENTER, COMMA] as const;

  boardName: string
  bgImgURL: any

  taskTitle: string
  taskMessage: string

  allowStudentMoveAny: boolean

  tags: string[]

  constructor(
    public dialogRef: MatDialogRef<ConfigurationModalComponent>,
    public boardService: BoardService,
    @Inject(MAT_DIALOG_DATA) public data: any) {
      this.allowStudentMoveAny = data.board.permissions.allowStudentMoveAny
      this.boardName = data.board.name
      this.taskTitle = data.board.task.title
      this.taskMessage = data.board.task.message
      this.tags = data.board.tags ?? []
    }

  addTag(event: MatChipInputEvent) {
    if (event.value)
      this.tags.push(event.value)
    event.chipInput!.clear();
  }

  removeTag(tagRemove) {
    this.tags = this.tags.filter(tag => tag != tagRemove)
  }

  handleImageUpload(e) {
    var file = e.target.files[0];
    var reader = new FileReader();
    reader.onload = (f) => {
        this.bgImgURL = f.target?.result;
    };
    reader.readAsDataURL(file);
  }

  handleDialogSubmit() {
    if (this.bgImgURL) this.data.updateBackground(this.bgImgURL)
    this.data.updateBoardName(this.boardName)
    this.data.updateTask(this.taskTitle, this.taskMessage)
    this.data.updatePermissions(this.allowStudentMoveAny)
    this.data.updateTags(this.tags)

    this.dialogRef.close();
  }

  onNoClick(): void {
    this.dialogRef.close();
  }
}
