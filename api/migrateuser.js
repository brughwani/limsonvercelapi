// api/migrate-users.js
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
const serviceAccount = {
  projectId: process.env.project_id,
  privateKey: process.env.firebase_private_key.replace(/\\n/g, '\n'),
  clientEmail: process.env.client_email,
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const firestore = admin.firestore();

async function migrateUsers() {
  try {
    const usersSnapshot = await firestore.collection('Employee').get();

    let migratedCount = 0;
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const phone = userData.Phone.trim();
      const email = `${phone}@xyz.in`;

      // Skip if already migrated
      if (userData.uid) {
        console.log(`Skipping ${email} (already has UID)`);
        continue;
      }

      try {
        // Create user in Firebase Auth
        const userRecord = await admin.auth().createUser({
          email,
          password: userData.password, // Use plaintext password from Firestore
        });

        // Link Firestore document to Auth UID
        await userDoc.ref.update({ uid: userRecord.uid });
        migratedCount++;
        console.log(`Migrated ${email}`);
      } catch (error) {
        if (error.code === 'auth/email-already-exists') {
          console.log(`User ${email} already exists in Auth`);
        } else {
          console.error(`Error migrating ${email}:`, error.message);
        }
      }
    }

    return `Migration complete. ${migratedCount} users migrated.`;
  } catch (error) {
    console.error('Fatal error:', error);
    throw error;
  }
}

module.exports = async (req, res) => {
  try {
    // Ensure only authorized users can trigger migration
    if (req.headers.authorization !== `Bearer ${process.env.migration_key}`) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const result = await migrateUsers();
    res.status(200).send(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};