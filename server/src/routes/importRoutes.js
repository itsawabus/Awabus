import express from 'express';
import { downloadTemplate, uploadFile } from '../controllers/importController.js';
import { protectAdmin } from '../middleware/auth.js';

const router = express.Router();

// The filled-in workbook is sent as the raw request body. It is read before
// protectAdmin so that the school (tenant) context protectAdmin sets up carries
// straight on into the controller.
const readFile = express.raw({ type: () => true, limit: '10mb' });

router.get('/:entity/template', protectAdmin, downloadTemplate);
router.post('/:entity', readFile, protectAdmin, uploadFile);

export default router;
