import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import clientsRouter from "./clients";
import recordsRouter from "./records";
import dashboardRouter from "./dashboard";
import setupRouter from "./setup";
import documentTypesRouter from "./documentTypes";
import reportsRouter from "./reports";
import clientDocumentsRouter from "./clientDocuments";
import shareholdersRouter from "./shareholders";

const router: IRouter = Router();

router.use(healthRouter);
router.use(setupRouter);
router.use(authRouter);
router.use(clientsRouter);
router.use(recordsRouter);
router.use(dashboardRouter);
router.use(documentTypesRouter);
router.use(reportsRouter);
router.use(clientDocumentsRouter);
router.use(shareholdersRouter);

export default router;
