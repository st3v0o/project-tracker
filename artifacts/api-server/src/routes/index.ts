import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ticketsRouter from "./tickets";
import parseImageRouter from "./parse-image";
import parseVoiceRouter from "./parse-voice";
import importCsvRouter from "./import-csv";

const router: IRouter = Router();

router.use(healthRouter);
router.use(parseImageRouter);
router.use(parseVoiceRouter);
router.use(importCsvRouter);
router.use(ticketsRouter);

export default router;
