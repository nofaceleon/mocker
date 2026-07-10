import { Router } from 'express';
import { projectsRouter } from './projects.js';
import { featureGroupsRouter } from './feature-groups.js';
import { mockApisRouter } from './mock-apis.js';
import { mockDataRouter } from './mock-data.js';
import { dataBrowserRouter } from './data-browser.js';
import { adminRouter } from './admin.js';
import { swaggerImportRouter } from './swagger-import.js';
import { callbacksRouter } from './callbacks.js';
import { requestLogsRouter } from './request-logs.js';

const router = Router();

router.use('/projects', projectsRouter);
router.use('/', featureGroupsRouter); // 路径形如 /projects/:pid/feature-groups 与 /feature-groups/:id
router.use('/', mockApisRouter); // 路径形如 /feature-groups/:fgid/mock-apis 与 /mock-apis/:id
router.use('/', mockDataRouter); // /mock-apis/:apiId/data 与 /mock-data/:id
router.use('/', dataBrowserRouter); // /projects/:pid/data-browser 与 /data-browser/...
router.use('/', swaggerImportRouter); // /feature-groups/:fgid/swagger/parse 与 /commit
router.use('/', callbacksRouter); // /mock-apis/:apiId/callback 与 /callback-tasks/...
router.use('/', requestLogsRouter); // /request-logs* 与 /request-logs-filters
router.use('/admin', adminRouter);

export { router as apiRouter };