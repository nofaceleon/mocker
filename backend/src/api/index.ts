import { Router } from 'express';
import { projectsRouter } from './projects.js';
import { featureGroupsRouter } from './feature-groups.js';
import { mockApisRouter } from './mock-apis.js';
import { mockDataRouter } from './mock-data.js';
import { dataBrowserRouter } from './data-browser.js';
import { adminRouter } from './admin.js';

const router = Router();

router.use('/projects', projectsRouter);
router.use('/', featureGroupsRouter); // 路径形如 /projects/:pid/feature-groups 与 /feature-groups/:id
router.use('/', mockApisRouter); // 路径形如 /feature-groups/:fgid/mock-apis 与 /mock-apis/:id
router.use('/', mockDataRouter); // /mock-apis/:apiId/data 与 /mock-data/:id
router.use('/', dataBrowserRouter); // /projects/:pid/data-browser 与 /data-browser/...
router.use('/admin', adminRouter);

export { router as apiRouter };