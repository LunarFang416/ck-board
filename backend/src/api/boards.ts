import { Router } from "express";
import { BoardModel } from "../models/Board";
import dalBoard from "../repository/dalBoard";

const router = Router();

router.post("/", async (req, res) => {
  const board: BoardModel = req.body;

  const savedBoard = await dalBoard.create(board);
  res.status(200).json(savedBoard);
});

router.post("/multiple", async (req, res) => {
  const ids = req.body;

  const boards = await dalBoard.getMultipleByIds(ids);
  res.status(200).json(boards);
});

router.post("/:id", async (req, res) => {
  const id = req.params.id;
  const { name, members, task, permissions, bgImage, tags, initialZoom } =
    req.body;

  const board: Partial<BoardModel> = Object.assign(
    {},
    name === null ? null : { name },
    members === null ? null : { members },
    task === null ? null : { task },
    permissions === null ? null : { permissions },
    bgImage === null ? null : { bgImage },
    tags === null ? null : { tags },
    initialZoom === null ? null : { initialZoom }
  );

  const updatedBoard = await dalBoard.update(id, board);
  res.status(200).json(updatedBoard);
});

router.get("/:id", async (req, res) => {
  const id = req.params.id;

  const board = await dalBoard.getById(id);
  res.status(200).json(board);
});

router.get("/users/:id", async (req, res) => {
  const id = req.params.id;

  const boards = await dalBoard.getByUserId(id);
  res.status(200).json(boards);
});

export default router;
