import express from 'express';
import authRoutes from './auth.js';
import serviceRoutes from './services.js';
import serviceTypeRoutes from './serviceTypes.js';
import availabilityRoutes from './availability.js';
import bookingRoutes from './bookings.js';
import notificationRoutes from './notifications.js';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/services', serviceRoutes);
router.use('/service-types', serviceTypeRoutes);
router.use('/availability', availabilityRoutes);
router.use('/bookings', bookingRoutes);
router.use('/notifications', notificationRoutes);

export default router;

