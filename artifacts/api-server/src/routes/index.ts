import { Router, type IRouter } from "express";
import dealHunterRouter from "./deal-hunter";
import healthRouter from "./health";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dealHunterRouter);

export default router;
