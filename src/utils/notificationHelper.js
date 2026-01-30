const prisma = require('../database/db');

async function sendNotificationToRoles(title, message, type, roles) {
    try {
        // Get all users with the specified roles
        const users = await prisma.user.findMany({
            where: {
                deletedAt: null,
                role: {
                    name: { in: roles },
                },
            },
            select: {
                id: true,
                name: true,
                role: {
                    select: {
                        name: true,
                    },
                },
            },
        });

        if (users.length === 0) {
            console.log(`No users found with roles: ${roles.join(', ')}`);
            return [];
        }

        // Create notifications for all users
        const notifications = await Promise.all(
            users.map((user) =>
                prisma.notification.create({
                    data: {
                        title,
                        message,
                        type: type || 'info',
                        userId: user.id,
                    },
                })
            )
        );

        console.log(
            `Created ${notifications.length} notifications for roles: ${roles.join(', ')}`
        );
        return notifications;
    } catch (error) {
        console.error('Error sending notifications to roles:', error);
        throw error;
    }
}

async function sendNotificationToUsers(title, message, type, userIds) {
    try {
        if (!userIds || userIds.length === 0) {
            console.log('No user IDs provided for notifications');
            return [];
        }

        // Create notifications for all specified users
        const notifications = await Promise.all(
            userIds.map((userId) =>
                prisma.notification.create({
                    data: {
                        title,
                        message,
                        type: type || 'info',
                        userId,
                    },
                })
            )
        );

        console.log(`Created ${notifications.length} notifications for specific users`);
        return notifications;
    } catch (error) {
        console.error('Error sending notifications to users:', error);
        throw error;
    }
}

async function sendReportNotification(report, action, actorRole, actorName) {
    try {
        let title, message, type, targetRoles, targetUserIds;

        if (action === 'CREATED') {
            // Staff created a report - notify ADMIN and MASTER
            title = 'Laporan Baru';
            message = `${actorName} membuat laporan: "${report.title}"`;
            type = 'REPORT_CREATED';
            targetRoles = ['ADMIN', 'MASTER'];

            return await sendNotificationToRoles(title, message, type, targetRoles);
        } else if (action === 'RESPONSE') {
            // Someone responded to a report
            title = 'Respon Laporan';
            message = `${actorName} merespon laporan: "${report.title}"`;
            type = 'REPORT_RESPONSE';

            if (actorRole === 'ADMIN') {
                // Admin responded - notify MASTER and report creator (STAFF)
                const masterNotifications = await sendNotificationToRoles(
                    title,
                    message,
                    type,
                    ['MASTER']
                );

                const staffNotifications = await sendNotificationToUsers(
                    title,
                    message,
                    type,
                    [report.userId]
                );

                return [...masterNotifications, ...staffNotifications];
            } else if (actorRole === 'MASTER') {
                // Master responded - notify ADMIN and report creator (STAFF)
                const adminNotifications = await sendNotificationToRoles(
                    title,
                    message,
                    type,
                    ['ADMIN']
                );

                const staffNotifications = await sendNotificationToUsers(
                    title,
                    message,
                    type,
                    [report.userId]
                );

                return [...adminNotifications, ...staffNotifications];
            }
        }

        return [];
    } catch (error) {
        console.error('Error sending report notification:', error);
        throw error;
    }
}

module.exports = {
    sendNotificationToRoles,
    sendNotificationToUsers,
    sendReportNotification,
};
