import { Component, OnDestroy, OnInit } from '@angular/core';
import { fabric } from 'fabric';
import { Canvas } from 'fabric/fabric-impl';

import { MatDialog } from '@angular/material/dialog';

import Post from '../../models/post';
import Comment from 'src/app/models/comment';
import { DialogInterface } from '../../interfaces/dialog.interface';

import { BoardService } from '../../services/board.service';
import { PostService } from '../../services/post.service';

import { PostModalComponent } from '../post-modal/post-modal.component';
import { ConfigurationModalComponent } from '../configuration-modal/configuration-modal.component';
import { FabricPostComponent } from '../fabric-post/fabric-post.component';
import { AddPostComponent } from '../add-post-modal/add-post.component';
import { FabricUtils } from 'src/app/utils/FabricUtils';
import { Mode, Role } from 'src/app/utils/constants';
import { UserService } from 'src/app/services/user.service';
import { Board } from 'src/app/models/board';
import User from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { CommentService } from 'src/app/services/comment.service';
import { LikesService } from 'src/app/services/likes.service';
import Like from 'src/app/models/like';
import { Permissions } from 'src/app/models/permissions';
import { CreateWorkflowModalComponent } from '../create-workflow-modal/create-workflow-modal.component';
import { BucketsModalComponent } from '../buckets-modal/buckets-modal.component';
import { ListModalComponent } from '../list-modal/list-modal.component';
import { POST_COLOR } from 'src/app/utils/constants';
import { FileUploadService } from 'src/app/services/fileUpload.service';
import { SnackbarService } from 'src/app/services/snackbar.service';
import { TaskModalComponent } from '../task-modal/task-modal.component';
import { Project } from 'src/app/models/project';
import { ProjectService } from 'src/app/services/project.service';
import { CanvasService } from 'src/app/services/canvas.service';

interface PostIDNamePair {
  postID: string,
  username: string
}

@Component({
  selector: 'app-canvas',
  templateUrl: './canvas.component.html',
  styleUrls: ['./canvas.component.scss']
})
export class CanvasComponent implements OnInit, OnDestroy {
  boardID: string
  projectID: string
  canvas: Canvas;
  postColor: string;

  user: User
  board: Board
  project: Project

  Math: Math = Math;
  initialClientX: number = 0
  initialClientY: number = 0
  finalClientX: number = 0
  finalClientY: number = 0

  zoom: number = 1

  mode: Mode = Mode.EDIT
  modeType = Mode
  Role: typeof Role = Role

  showList: boolean = false
  showBuckets: boolean = false

  showAddPost: boolean = true
  lockArrowKeys: boolean = false


  unsubListeners: Function[] = []

  constructor(
    public postService: PostService, public boardService: BoardService, 
    public userService: UserService, public authService: AuthService, 
    public commentService: CommentService, public likesService: LikesService, 
    public projectService: ProjectService, 
    protected fabricUtils: FabricUtils, 
    private router: Router,  private activatedRoute: ActivatedRoute,
    public snackbarService: SnackbarService, public dialog: MatDialog,
    public fileUploadService: FileUploadService, public canvasService: CanvasService
  ) {}

  ngOnInit() {
    this.user = this.authService.userData;
    this.canvas = new fabric.Canvas('canvas', this.fabricUtils.canvasConfig);
    this.fabricUtils._canvas = this.canvas;
    this.postColor = POST_COLOR;

    this.configureBoard();
    
    const unsubCanvasEvents = this.initCanvasEventsListener();
    const unsubGroupEvents = this.initGroupEventsListener();

    this.unsubListeners = unsubCanvasEvents.concat(unsubGroupEvents);
  }

  initCanvasEventsListener() {
    const unsubAdd = this.initAddPostListener();
    const unsubRemove = this.initRemovePostListener();
    const unsubMoving = this.initMovingPostListener();
    const unsubExpand = this.initPostClickListener();
    const unsubLike = this.initLikeClickListener();
    const unsubZoom = this.initZoomListener();
    const unsubPan = this.initPanListener();
    const unsubSwipePan = this.initPanSwipeListener();
    const unsubKeyPan = this.initKeyPanningListener();
    const unsubModal = this.hideListsWhenModalOpen();
    const unsubArrowKeyLock = this.lockArrowKeysWhenModalOpen();
    const unsubArrowKeyUnlock = this.unlockArrowKeysWhenModalClose();
    
    return [unsubLike, unsubExpand, unsubModal, unsubAdd, 
            unsubRemove, unsubMoving, unsubZoom, unsubPan, 
            unsubSwipePan, unsubKeyPan, unsubArrowKeyLock, unsubArrowKeyUnlock];
  }

  initGroupEventsListener() {
    const unsubBoard = this.boardService.subscribe(this.boardID, this.handleBoardChange);
    const unsubPosts = this.postService.observable(this.boardID, this.handlePostEvent, this.handlePostEvent);
    const unsubLikes = this.likesService.observable(this.boardID, this.handleLikeEvent, true);
    const unsubComms = this.commentService.observable(this.boardID, this.handleCommentEvent, true);

    return [unsubBoard, unsubPosts, unsubLikes, unsubComms];
  }

  showBucketsModal() {
    this.dialog.open(BucketsModalComponent, {
      width: '73vw',
      height: '75vh',
      data: {
        board: this.board,
        user: this.user,
        centerX: this.canvas.getCenter().left,
        centerY: this.canvas.getCenter().top,
      }
    });
  }

  showListModal() {
    this.dialog.open(ListModalComponent, {
      width: '73vw',
      height: '75vh',
      data: {
        board: this.board,
      }
    });
  }

  // configure board
  configureBoard() {
    const map = this.activatedRoute.snapshot.paramMap;

    if (map.has('boardID') && map.has('projectID')) {
      this.boardID = this.activatedRoute.snapshot.paramMap.get('boardID') ?? '';
      this.projectID = this.activatedRoute.snapshot.paramMap.get('projectID') ?? '';
    } else {
      this.router.navigate(['error']);
    }
    
    this.postService.getAll(this.boardID).then((data) => {
      data.forEach((data) => {
        let post = data.data() ?? {}
        if(post.fabricObject){
          let obj = JSON.parse(post.fabricObject);
          this.syncBoard(obj, post.postID);
        }
      })
      this.boardService.get(this.boardID).then((board) => {
        if (board) {
          this.board = board
          board.permissions.allowStudentMoveAny ? this.lockPostsMovement(false) : this.lockPostsMovement(true)
          board.bgImage ? this.updateBackground(board.bgImage.url, board.bgImage.imgSettings) : null
          this.updateShowAddPost(this.board.permissions)
          this.setAuthorVisibilityAll()
        }
      })
    })
    this.projectService.get(this.projectID).then(project => this.project = project)
  }

  openWorkflowDialog() {
    this.dialog.open(CreateWorkflowModalComponent, {
      width: '700px',
      data: {
        board: this.board,
        project: this.project
      }
    });
  }

  // open dialog to get message for a new post
  handleCreatePost() {
    this.mode = Mode.CHOOSING_LOCATION
    this.canvas.defaultCursor = 'copy'
    this.canvas.hoverCursor = 'not-allowed'
    this.snackbarService.queueSnackbar('Click where you want the post to be created!');
    this.canvas.on('mouse:down', this.handleChoosePostLocation);
  }

  handleChoosePostLocation = (opt) => {
    if (opt.target == null) {
      this.canvas.selection = false;
      this.dialog.open(AddPostComponent, {
        width: '500px',
        data: {
          board: this.board,
          user: this.user,
          top: opt.absolutePointer ? opt.absolutePointer.y : 150,
          left: opt.absolutePointer ? opt.absolutePointer.x : 150
        }
      });
    }
    this.snackbarService.dequeueSnackbar();
    this.canvas.off('mouse:down', this.handleChoosePostLocation)
    this.enableEditMode()
  }

  disableChooseLocation() {
    this.snackbarService.dequeueSnackbar();
    this.canvas.off('mouse:down', this.handleChoosePostLocation)
    this.enableEditMode()
  }

  addPost = (title: string, desc = '', left: number, top: number) => {
    var fabricPost = new FabricPostComponent({
      title: title,
      author: this.user.username,
      authorID: this.user.id,
      desc: desc,
      lock: !this.board.permissions.allowStudentMoveAny,
      left: left,
      top: top,
      color: this.postColor
    });
    this.canvas.add(fabricPost);
  }

  openSettingsDialog() {
    this.dialog.open(ConfigurationModalComponent, {
      width: '850px',
      data: {
        board: this.board,
        updatePermissions: this.updatePostPermissions,
        updatePublic: this.updatePublic,
        updateTask: this.updateTask,
        updateBackground: this.updateBackground,
        updateBoardName: this.updateBoardName,
        updateTags: this.updateTags
      }
    });
  }

  updateTags = (tags) => {
    this.boardService.update(this.boardID, { tags: tags })
  }

  updateBoardName = (name) => {
    this.board.name = name
    this.boardService.update(this.boardID, { name: name })
  }

  updateBackground = (fileString, settings?) => {
    fabric.Image.fromURL(fileString, (img) => {
      if (img && settings) {
        this.canvas.setBackgroundImage(img, this.canvas.renderAll.bind(this.canvas), settings);
      } else if (img && !settings) {
        // TODO: delete old background image
        const imgSettings = this.fabricUtils.createImageSettings(this.canvas, img)
        this.canvas.setBackgroundImage(img, this.canvas.renderAll.bind(this.canvas), imgSettings);
        this.fileUploadService.upload(fileString).then(firebaseUrl => {
          if (this.board.bgImage?.url) {
            this.fileUploadService.delete(this.board.bgImage?.url).then(_ => {
              this.boardService.update(this.boardID, { bgImage: { url: firebaseUrl, imgSettings: imgSettings } })
            })
          }
          else {
            this.boardService.update(this.boardID, { bgImage: { url: firebaseUrl, imgSettings: imgSettings } })
          }
        })

      } else {
        //this.canvas.setBackgroundImage('', this.canvas.renderAll.bind(this.canvas))
        //this.boardService.update(this.boardID, { bgImage: null })
      }
    });
  }

  updatePostPermissions = (permissions: Permissions) => {
    this.boardService.update(this.boardID, { permissions: permissions })
    this.lockPostsMovement(!permissions.allowStudentMoveAny)
    this.updateShowAddPost(permissions)
    this.configureBoard()
  }

  updateShowAddPost(permissions: Permissions) {
    let isStudent = this.user.role == Role.STUDENT
    let isTeacher = this.user.role == Role.TEACHER
    this.showAddPost = (isStudent && permissions.allowStudentEditAddDeletePost) || isTeacher
  }

  updateTask = (title, message) => {
    this.boardService.update(this.boardID, { task: { title: title, message: message } })
  }

  updatePublic = (isPublic) => {
    this.boardService.update(this.boardID, { public: isPublic })
  }

  lockPostsMovement(value) {
    this.canvas.getObjects().map(obj => {
      obj.set({ lockMovementX: value, lockMovementY: value });
    });
    this.canvas.renderAll()
  }

  hideAuthorNames() {
    this.canvas.getObjects().map(obj => {
      this.fabricUtils.updateAuthor(obj, "Anonymous")
    });
    this.canvas.renderAll()
  }

  updateAuthorNames(postToUpdate: PostIDNamePair) {
    let obj = this.fabricUtils.getObjectFromId(postToUpdate.postID)
    if (obj) {
      this.fabricUtils.updateAuthor(obj, postToUpdate.username)
      this.canvas.renderAll()
    }
  }

  setAuthorVisibilityOne(post) {
    if (!this.board) {
      return
    }
    let isStudentAndVisible = this.user.role == Role.STUDENT && this.board.permissions.showAuthorNameStudent
    let IsTeacherAndVisisble = this.user.role == Role.TEACHER && this.board.permissions.showAuthorNameTeacher
    if (!(isStudentAndVisible || IsTeacherAndVisisble)) {
      this.updateAuthorNames({ postID: post.postID, username: "Anonymous" })
    }
    else {
      this.userService.getOneById(post.userID).then((user: any) => {
        this.updateAuthorNames({ postID: post.postID, username: user.username })
      })
    }

  }

  setAuthorVisibilityAll() {
    this.postService.getAll(this.boardID).then((data) => {
      // update all the post names to to the poster's name rather than anonymous
      data.forEach((data) => {
        let post = data.data() ?? {}
        this.setAuthorVisibilityOne(post)
      })
    })
  }

  openTaskDialog() {
    const title = this.board.task.title ? this.board.task.title : 'No task created!';
    const message = this.board.task.message;

    const openDialogCloseSnack = () => {
      this.dialog.open(TaskModalComponent, {
        width: '500px',
        data: {
          title: title,
          message: message
        }
      });
      this.snackbarService.dequeueSnackbar();
    };

    this.snackbarService.queueSnackbar(title, message, {
      action: { name: 'View Full Task!', run: openDialogCloseSnack },
      matSnackbarConfig: { 
        verticalPosition: 'bottom',
        horizontalPosition: 'center',
        panelClass: ['wide-snackbar']
      }
    });
  }

  // send your post to the rest of the group
  sendObjectToGroup(pObject: any) {
    const post: Post = {
      postID: pObject.postID,
      title: pObject.title,
      desc: pObject.desc,
      tags: pObject.tags,
      userID: this.user.id,
      boardID: this.boardID,
      fabricObject: this.fabricUtils.toJSON(pObject),
      timestamp: new Date().getTime(),
    }

    this.canvasService.addPostServer(post);
  }

  // sync board using incoming/outgoing posts
  syncBoard(obj: any, postID: any) {
    var existing = this.fabricUtils.getObjectFromId(postID)

    // delete object from board
    if (obj.removed) {
      if (existing) {
        this.canvas.remove(existing)
      }
      return;
    }

    if (existing) {
      // if title or desc was updated, need to re-render with updated properties
      if (obj.title != existing.title || obj.desc != existing.desc) {
        existing = this.fabricUtils.updatePostTitleDesc(existing, obj.title, obj.desc)
        existing.desc = obj.desc
        existing.title = obj.title
      }

      existing = this.fabricUtils.updateLikeCount(existing, obj)
      existing = this.fabricUtils.updateCommentCount(existing, obj)
      existing.set(obj)
      existing.setCoords()
      this.canvas.renderAll()
    } else {
      this.fabricUtils.renderPostFromJSON(obj)
    }

  }

  handlePostEvent = (post) => {
    if (post && post.fabricObject) {
      var obj = JSON.parse(post.fabricObject);
      this.syncBoard(obj, post.postID);
    }
  }

  handleLikeEvent = (like: Like, change: string) => {
    var post = this.fabricUtils.getObjectFromId(like.postID)
    if (post) {
      post = change == "added" ? this.fabricUtils.incrementLikes(post) : this.fabricUtils.decrementLikes(post)
      this.canvas.renderAll()
      var jsonPost = this.fabricUtils.toJSON(post)
      this.postService.update(post.postID, { fabricObject: jsonPost })
    }
  }

  handleCommentEvent = (comment: Comment) => {
    var post = this.fabricUtils.getObjectFromId(comment.postID)
    if (post) {
      post = this.fabricUtils.incrementComments(post)
      this.canvas.renderAll()
      var jsonPost = this.fabricUtils.toJSON(post);
      this.postService.update(post.postID, { fabricObject: jsonPost })
    }
  }

  initLikeClickListener() {
    this.canvas.on('mouse:down', this.handleLikeClick);

    return () => { 
      this.canvas.off('mouse:down', this.handleLikeClick)
    };
  }

  handleLikeClick = (e: fabric.IEvent) => {
    var post: any = e.target
    var likeButton = e.subTargets?.find(o => o.name == 'like')
    let isStudent = this.user.role == Role.STUDENT
    let isTeacher = this.user.role == Role.TEACHER
    let studentHasPerm = isStudent && this.board.permissions.allowStudentLiking
    if (likeButton && (studentHasPerm || isTeacher)) {
      this.likesService.isLikedBy(post.postID, this.user.id).then((data) => {
        if (data.size == 0) {
          this.canvasService.likeCanvasPostClient(post.postID);
          this.canvasService.likeCanvasPostServer(post.postID, this.user.id, this.board.boardID);
        } else {
          this.canvasService.unlikeCanvasPostClient(post.postID);
          this.canvasService.unlikeCanvasPostServer(data, post.postID);
        }
      })
    }
  }

  initPostClickListener() {
    var isDragging = false;
    var isMouseDown = false;

    const postClickHandler = (e: fabric.IEvent) => {
      if (e.target?.name == 'post') isMouseDown = true;
    };

    const postMovingHandler = (e: fabric.IEvent) => {
      if (e.target?.name == 'post') isDragging = isMouseDown;
    };

    const mouseUpHandler = (e: fabric.IEvent) => {
      var obj: any = e.target;
      
      var likePress = e.subTargets?.find(o => o.name == 'like')
      var isDragEnd = isDragging;
      isDragging = false;
      isMouseDown = false;

      if (!isDragEnd && !likePress && obj?.name == 'post') {
        this.canvas.discardActiveObject().renderAll();
        this.dialog.open(PostModalComponent, {
          minWidth: '700px',
          width: 'auto',
          data: {
            user: this.user,
            post: obj,
            board: this.board
          }
        });
      }
    };

    this.canvas.on('mouse:down', postClickHandler);
    this.canvas.on('mouse:move', postMovingHandler);
    this.canvas.on('mouse:up', mouseUpHandler);

    return () => {
      this.canvas.off('mouse:down', postClickHandler);
      this.canvas.off('mouse:move', postMovingHandler);
      this.canvas.off('mouse:up', mouseUpHandler);
    }
  }

  // listen to configuration/permission changes
  handleBoardChange = (board) => {
    this.board = board

    this.lockPostsMovement(!board.permissions.allowStudentMoveAny)
    this.setAuthorVisibilityAll()

    board.bgImage ? this.updateBackground(board.bgImage.url, board.bgImage.imgSettings) : null
    board.name ? this.updateBoardName(board.name) : null
  }

  initAddPostListener() {
    const handleAddPost = (e: fabric.IEvent) => {
      if (e.target) {
        var obj: any = e.target;

        if (!obj.postID) {
          obj.set('postID', Date.now() + '-' + this.user.id);
          fabric.util.object.extend(obj, { postID: obj.postID })
          this.sendObjectToGroup(obj)
        }
      }
    }

    this.canvas.on('object:added', handleAddPost);

    return () => {
      this.canvas.off('object:added', handleAddPost);
    }
  }

  initRemovePostListener() {
    const handleRemovePost = (e: fabric.IEvent) => {
      if (e.target) {
        var obj: any = e.target;
        if (obj.removed) {
          return // already removed
        }

        this.postService.delete(obj.postID)
        obj.set('removed', true);
        fabric.util.object.extend(obj, { removed: true })
        this.sendObjectToGroup(obj);
      }
    }

    this.canvas.on('object:removed', handleRemovePost);

    return () => {
      this.canvas.off('object:removed', handleRemovePost);
    }
  }

  initMovingPostListener() {
    const handleMovingPost = (e: any) => {
      if (e.target) {
        var obj = e.target;

        // Coordinates at which the post was clicked
        var postClickPosition = obj.getLocalPointer(e);

        var left = Math.round((e.pointer.x - postClickPosition.x));
        var top = Math.round((e.pointer.y - postClickPosition.y));

        obj.set({ left: left, top: top })
        obj.setCoords()
        this.canvas.renderAll()

        var id = obj.postID
        obj = this.fabricUtils.toJSON(obj)
        this.postService.update(id, { fabricObject: obj })
      }
    }

    this.canvas.on('object:moving', handleMovingPost);

    return () => {
      this.canvas.off('object:moving', handleMovingPost);
    }
  }

  initZoomListener() {
    const handleZoomEvent = (opt) => {
      var options = (opt.e as unknown) as WheelEvent

      // Condition for pinch gesture on trackpad: 
      // 1. delta Y is an integer or delta X is 0 
      // 2. ctrl key is triggered
      const trackpad_pinch = ((Number.isInteger(options.deltaY) || Math.abs(options.deltaX) < 1e-9))
        && (options.ctrlKey);

      // Condition for mousewheel:
      // 1. delta Y has trailing non-zero decimal points
      // 2. delta X is zero 
      // 3. ctrl key is not triggered
      const mousewheel = !(Math.abs(options.deltaY - Math.floor(options.deltaY)) < 1e-9)
        && Math.abs(options.deltaX) < 1e-9 && !(options.ctrlKey);

      if (trackpad_pinch || mousewheel) {
        var delta = options.deltaY;

        if (mousewheel) {
          this.zoom *= 0.999 ** delta;
        }
        else {
          this.zoom *= 0.99 ** delta;
        }
        if (this.zoom > 20) this.zoom = 20;
        if (this.zoom < 0.01) this.zoom = 0.01;

        this.canvas.zoomToPoint(new fabric.Point(options.offsetX, options.offsetY), this.zoom);
        opt.e.preventDefault();
        opt.e.stopPropagation();
      }
    }

    this.canvas.on('mouse:wheel', handleZoomEvent);

    return () => {
      this.canvas.off('mouse:wheel', handleZoomEvent);
    }
  }

  initPanListener() {
    var isPanning = false;

    const mouseDown = (opt) => {
      if (this.mode == Mode.PAN) {
        isPanning = true;
        this.canvas.selection = false;
        const options = (opt.e as unknown) as WheelEvent
        this.initialClientX = options.clientX;
        this.initialClientY = options.clientY;
      }
    };

    const mouseUp = (opt) => {
      isPanning = false;
      this.canvas.selection = true;
      const options = (opt.e as unknown) as WheelEvent
      this.initialClientX = options.clientX;
      this.initialClientY = options.clientY;
    };

    const handlePan = (opt) => {
      var options = (opt.e as unknown) as WheelEvent
      if (isPanning && options) {
        let delta = new fabric.Point(options.movementX, options.movementY);
        this.canvas.relativePan(delta);
        this.finalClientX = options.clientX;
        this.finalClientY = options.clientY;
      }
    };

    this.canvas.on("mouse:down", mouseDown);
    this.canvas.on("mouse:up", mouseUp);
    this.canvas.on("mouse:move", handlePan);

    return () => {
      this.canvas.off("mouse:down", mouseDown);
      this.canvas.off("mouse:up", mouseUp);
      this.canvas.off("mouse:move", handlePan);
    }
  }

  initPanSwipeListener() {
    const handlePanSwipe = (opt) => {
      let options = (opt.e as unknown) as WheelEvent;

      // Condition for two-finger swipe on trackpad: 
      // 1. delta Y is an integer, 
      // 2. delta X is an integer,
      // 3. ctrl key is not triggered
      const trackpad_twofinger =
        Number.isInteger(options.deltaY) && Number.isInteger(options.deltaX)
        && !(options.ctrlKey);

      if (trackpad_twofinger) {
        let vpt = this.canvas.viewportTransform;
        if (!vpt) return;
        vpt[4] -= options.deltaX;
        vpt[5] -= options.deltaY;
        this.canvas.setViewportTransform(vpt).requestRenderAll();
      }
    }

    this.canvas.on('mouse:wheel', handlePanSwipe);

    return () => {
      this.canvas.off('mouse:wheel', handlePanSwipe);
    }
  }
  
  initKeyPanningListener() {

    document.addEventListener('keydown', (event) => {
      if(!this.lockArrowKeys){
        if(event.key == 'ArrowUp') {
          event.preventDefault();
          this.canvas.relativePan(new fabric.Point(0, 30 * this.canvas.getZoom()));
        }
        else if(event.key == 'ArrowDown') {
          event.preventDefault();
          this.canvas.relativePan(new fabric.Point(0, -30 * this.canvas.getZoom()));
        }
        else if(event.key == 'ArrowLeft') {
          event.preventDefault();
          this.canvas.relativePan(new fabric.Point(30 * this.canvas.getZoom(), 0));
        }
        else if(event.key == 'ArrowRight') {
          event.preventDefault();
          this.canvas.relativePan(new fabric.Point(-30 * this.canvas.getZoom(), 0));
        }
      }
      
    });

    return () => {
      if (document.removeAllListeners) 
        document.removeAllListeners('keydown');
    }
  }

  enablePanMode() {
    this.mode = Mode.PAN
    this.lockPostsMovement(true)
    this.canvas.defaultCursor = 'grab'
    this.canvas.hoverCursor = 'grab'
  }

  enableEditMode() {
    this.mode = Mode.EDIT
    this.lockPostsMovement(false)
    this.canvas.defaultCursor = 'default'
    this.canvas.hoverCursor = 'move'
  }


  handleZoom(event) {
    let center = this.canvas.getCenter()
    let centerX = center.left + (this.finalClientX - this.initialClientX);
    let centerY = center.top + (this.finalClientY - this.initialClientY);
    this.initialClientX = this.finalClientX;
    this.initialClientY = this.finalClientY;

    if (event === 'zoomIn') {
      this.zoom += 0.05;
    }
    else if (event === 'zoomOut') {
      this.zoom -= 0.05;
    }
    else if (event === 'reset') {
      this.zoom = 1;
    }

    if (this.zoom > 20) {
      this.zoom = 20;
    }
    else if (this.zoom < 0.01) {
      this.zoom = 0.01;
    }

    this.canvas.zoomToPoint(new fabric.Point(centerX, centerY), this.zoom);
  }

  hideListsWhenModalOpen() {
    const subscription = this.dialog.afterOpened.subscribe(() => {
      this.showList = false
      this.showBuckets = false
    })

    return () => {
      subscription.unsubscribe();
    }
  }

  lockArrowKeysWhenModalOpen(){
    const subscription = this.dialog.afterOpened.subscribe(()=>{
      this.lockArrowKeys = true
    })
    return ()=>{
      subscription.unsubscribe();
    }
  }
  unlockArrowKeysWhenModalClose(){
    const subscription = this.dialog.afterAllClosed.subscribe(()=>{
      this.lockArrowKeys = false
    })
    return ()=>{
      subscription.unsubscribe();
    }
  }

  ngOnDestroy(): void {
    this.snackbarService.ngOnDestroy();
    for (let unsubFunc of this.unsubListeners) {
      unsubFunc();
    }
  }
}