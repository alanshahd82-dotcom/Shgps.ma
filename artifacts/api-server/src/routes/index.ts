import { Router, type IRouter } from "express";
import healthRouter from "./health";
import alertsRouter from "./alerts";
import devicesRouter from "./devices";

const router: IRouter = Router();

router.use(healthRouter);
router.use(alertsRouter);
router.use(devicesRouter);

export default router;
