const admin = require('firebase-admin');
//const bcrypt = require('bcrypt');
const axios = require('axios');

//const withAuth = require('./withAuth');


const { Firestore } = require('@google-cloud/firestore');

if (!admin.apps.length) {
  const serviceAccount = {
    projectId: process.env.project_id,
    privateKey: process.env.firebase_private_key.replace(/\\n/g, '\n'), // Handle newlines
    clientEmail: process.env.client_email,
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const firestore = admin.firestore();

const fs=new Firestore();
async function getIdToken(email,password) {
  try {
    const response = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.firebase_web_api_key}`,
      {
        email,
        password,
        returnSecureToken: true
      }
    );
    return response.data.idToken;
  } catch (error) {
    console.error('Error exchanging custom token for ID token:', error);
    throw error;
  }
}
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone, password, app } = req.body;

console.log('Request body:', req.body);
  if (!phone || !password) {
    return res.status(400).json({ error: 'Phone and password are required' });
  }

  try {
    // Trim whitespace and ensure case sensitivity
    const trimmedPhone = phone.trim();

    const emp=await firestore.collection('Employee').get()

    console.log(emp.docs.map(doc=>doc.data()));



 // Fetch user by phone number
 const userSnapshot1 = await firestore.collection('Employee').where('Phone', '==', phone).limit(1).get();
console.log(userSnapshot1);
    // Fetch user by phone number
    const userSnapshot = await firestore.collection('Employee').where('Phone', '==', trimmedPhone).get();
console.log(`Found ${userSnapshot1.size} user(s)`); // Log the number of users found
   // console.log(`Found ${userSnapshot.size} user(s)`); // Log the number of users found


    if (userSnapshot.empty) {
      return res.status(400).json({ error: 'User not found' });
    }

    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();

    console.log('User data:', userData);
    console.log(userDoc);

    // Create a dummy email from the phone number
    const email = `${trimmedPhone}@xyz.in`;

    // Check password — field may be stored as 'password' or 'Password'
    const storedPassword = userData.password || userData.Password;
    console.log('Stored password field:', { lowercase: userData.password, uppercase: userData.Password, resolved: storedPassword });
    if (!storedPassword || password.trim() !== storedPassword.trim()) {
      return res.status(400).json({ error: 'Invalid password' });
    }

    // Check role and app access
    const role = userData.Role.toLowerCase();
    if (role !== app) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Ensure Firebase Auth user exists with correct password before signing in
    try {
      // Try to get existing Auth user
      const existingUser = await admin.auth().getUserByEmail(email);
      // User exists — update password to match Firestore in case it's out of sync
      await admin.auth().updateUser(existingUser.uid, { password: storedPassword });
      console.log('Updated Firebase Auth password for:', email);
    } catch (authError) {
      if (authError.code === 'auth/user-not-found') {
        // User doesn't exist in Firebase Auth — create them
        await admin.auth().createUser({ email, password: storedPassword });
        console.log('Created Firebase Auth user for:', email);
      } else {
        console.error('Error syncing Firebase Auth user:', authError);
      }
    }

    const idToken = await getIdToken(email, storedPassword);
  console.log(userData)

  console.log('Role:', role);
  console.log('name:', userData["First name"]);
    

    return res.status(200).json({ token: idToken, role: role,user:{name: userData["First name"],} });
  } catch (error) {
    console.error('Error signing in:', error);
    return res.status(500).json({ error: 'Server error' });
  }

};