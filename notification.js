const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.processPaymentAndScheduleNotifications = functions.firestore
    .document('Subscriptions/{subscriptionId}')
    .onCreate(async (snap, context) => {
        const paymentData = snap.data();
        const userEmail = paymentData.userEmail;
        const coachId = paymentData.coachId;
        const schedules = paymentData.schedules;

        const userFcmToken = await getFcmToken('Users', userEmail, true);
        const coachFcmToken = await getFcmToken('Coaches', coachId, false);

        schedules.forEach(schedule => {
            const startTime = new Date(schedule.date + ' ' + schedule.starttime);
            const thirtyMinsBefore = new Date(startTime.getTime() - (30 * 60000));
            const fiveMinsBefore = new Date(startTime.getTime() - (5 * 60000));
        
            // Schedule the notifications for 30 minutes before
            scheduleNotification(userFcmToken, thirtyMinsBefore, '30 minutes to your session');
            scheduleNotification(coachFcmToken, thirtyMinsBefore, '30 minutes to your client\'s session');
        
            // Schedule the notifications for 5 minutes before
            scheduleNotification(userFcmToken, fiveMinsBefore, '5 minutes to your session');
            scheduleNotification(coachFcmToken, fiveMinsBefore, '5 minutes to your client\'s session');
        
            // Schedule the notifications for the actual start time
            scheduleNotification(userFcmToken, startTime, 'Your session is starting now');
            scheduleNotification(coachFcmToken, startTime, 'Your client\'s session is starting now');
        });
        
        return null; // Return a resolved promise
    });

async function getFcmToken(collection, identifier, isUser) {
    const db = admin.firestore();
    let queryField = isUser ? 'email' : 'coachId';
    let querySnapshot = await db.collection(collection).where(queryField, '==', identifier).get();
    if (querySnapshot.empty) {
        console.log(`No document found for ${identifier} in collection ${collection}`);
        return null;
    }
    let doc = querySnapshot.docs[0];
    return doc.data().fcm;
}

function scheduleNotification(fcmToken, notificationTime, message) {
    const db = admin.firestore();
    const notification = {
        fcmToken: fcmToken,
        notificationTime: admin.firestore.Timestamp.fromDate(notificationTime),
        message: message,
        status: 'scheduled'
    };

    db.collection('scheduledNotifications').add(notification)
        .then(docRef => {
            console.log(`Notification scheduled with ID: ${docRef.id}`);
        })
        .catch(error => {
            console.error(`Error scheduling notification: ${error}`);
        });
}

exports.sendDueNotifications = functions.pubsub.schedule('every 1 minutes').onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();
    const db = admin.firestore();
    
    const notificationsSnapshot = await db.collection('scheduledNotifications')
        .where('notificationTime', '<=', now)
        .where('status', '==', 'scheduled')
        .get();
    
    if (notificationsSnapshot.empty) {
        console.log('No due notifications to send.');
        return null;
    }

    notificationsSnapshot.forEach(async (doc) => {
        const notificationData = doc.data();
        await sendFcmNotification(notificationData.fcmToken, notificationData.message);
        // Optionally, delete the notification or mark it as sent
        await db.collection('scheduledNotifications').doc(doc.id).delete();
    });

    return null;
});

async function sendFcmNotification(fcmToken, message) {
    const payload = {
        notification: {
            title: 'Scheduled Notification',
            body: message,
        },
        token: fcmToken,
    };

    try {
        const response = await admin.messaging().send(payload);
        console.log('Successfully sent message:', response);
    } catch (error) {
        console.error('Error sending FCM message:', error);
    }
}

