import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ticketsRouter from "./tickets";
import parseImageRouter from "./parse-image";
import parseVoiceRouter from "./parse-voice";

const router: IRouter = Router();

router.use(healthRouter);
router.use(parseImageRouter);
router.use(parseVoiceRouter);
router.use(ticketsRouter);

export default router;
