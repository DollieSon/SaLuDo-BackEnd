import { Router, Request, Response } from 'express';
import { AuthMiddleware, AuthenticatedRequest } from './middleware/auth';
import { DashboardService } from '../services/DashboardService';
import { connectDB } from '../mongo_db';

const router = Router();

/**
 * @route   GET /api/dashboard/stats
 * @desc    Get dashboard statistics (admin only)
 * @access  Private (Admin)
 */
router.get('/stats', AuthMiddleware.authenticate, AuthMiddleware.requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await connectDB();
    const dashboardService = new DashboardService(db);
    
    const stats = await dashboardService.getStats();
    
    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error.message
    });
  }
});

export default router;
