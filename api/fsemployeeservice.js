//const { Firestore } = require('@google-cloud/firestore');

// // Initialize Firestore
// const firestore = new Firestore();

const admin = require('firebase-admin');
const withAuth = require('./middleware/withAuth');




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



const handler = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    try {
      if (!req.body.fields) {
        throw new Error('Missing fields object in request body');
      }

      const {
        'First name': firstName,
        'Last name': lastName,
        'Role': role,
        'Phone Number': phone,
        'Password': password,
        'Address': address,
        'Personal Mobile Number': personalPhoneNumber,
        'salary': salary
      } = req.body.fields;

      const userRecord = await admin.auth().createUser({
        email: `${phone}@xyz.in`,
        password: password,
      });
      

      console.log('Data to be inserted:', req.body.fields);

      const data = {
        "First name": firstName,
        "Last name": lastName,
        "Role": role,
        "Phone": phone,
        "password": password,
        "address": address,
        "personal phone number": personalPhoneNumber,
        "salary": salary,
      };
      console.log('Data to be inserted:', data);

      const docRef = await firestore.collection('Employee').add(data);
      return res.status(200).json({ id: docRef.id });
    } catch (error) {
      console.error('Employee creation error:', error);
      return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  }

  if (req.method === 'GET') {
  try {
    const { filterField, filterValue, getKarigars, fields } = req.query;
    console.log('GET request received');
    console.log('Query parameters:', req.query);

    if (getKarigars === 'true') {
      const employees = await firestore.collection('Employee').where('Role', '==', 'Karigar').get();
      
      const result = employees.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return res.status(200).json(result);
    }

    // if (filterField && filterValue) {
    //   const validFields = ['Phone', 'empcode', 'First name','Last name', 'Role', 'address', 'personal phone number', 'salary'];
    //   if (!validFields.includes(filterField)) {
    //     return res.status(400).json({ error: 'Invalid filtering field. Allowed fields are: ' + validFields.join(', ') });
    //   }

    //   const records = await firestore.collection('Employee').where(filterField, '==', filterValue).get();

    //   const retrievedRecords = records.docs.map(doc => ({
    //     id: doc.id,
    //     empcode: doc.data().empcode,
    //     Phone: doc.data().Phone
    //   }));

    //   if (retrievedRecords.length > 0) {
    //     return res.status(200).json(retrievedRecords);
    //   }
    //   return res.status(404).json({ message: 'No records found for that filter' });
    // }

if (fields) {
  console.log('Raw fields parameter:', fields);
  
  let selectedFields = [];
  
  try {
    // Parse the fields parameter
    if (Array.isArray(fields)) {
      selectedFields = fields;
    } else if (typeof fields === 'string') {
      if (fields.startsWith('[')) {
        selectedFields = JSON.parse(fields);
      } else {
        selectedFields = fields.split(',').map(field => field.trim());
      }
    }
    
    console.log('Parsed fields:', selectedFields);
    
    if (selectedFields.length === 0) {
      return res.status(400).json({ message: 'No fields selected' });
    }

    // MANUAL APPROACH: Get all documents and filter fields manually
    const records = await firestore.collection('Employee').get();
    console.log('Total records found:', records.size);

    const employeesWithSelectedFields = records.docs.map(doc => {
      const docData = doc.data();
      const selectedData = {};
      
      selectedFields.forEach(field => {
        // Handle field names with spaces - they exist as-is in the document
        selectedData[field] = docData[field];
      });
      
      return {
        id: doc.id,
        ...selectedData,
      };
    }).filter(employee => {
      // Filter out empty documents if needed
      return Object.keys(employee).length > 1; // At least one field besides id
    });

    console.log('Filtered employees count:', employeesWithSelectedFields.length);

    if (employeesWithSelectedFields.length > 0) {
      return res.status(200).json(employeesWithSelectedFields);
    }
    return res.status(404).json({ message: 'No employee records found' });
  } catch (error) {
    console.error('Error parsing fields parameter:', error);
    return res.status(400).json({ message: 'Invalid fields parameter' });
  }
}

    // If no valid query parameters are provided
  //   return res.status(400).json({ 
  //     error: 'Missing required query parameters. Use one of: getKarigars, filterField+filterValue, or fields' 
  //   });

  // } catch (error) {
  //   console.error('Server error:', error);
  //   res.status(500).json({ error: 'Server error: ' + error.message });
  // }





module.exports = withAuth(handler);


  // if (req.method === 'GET') {
  //   try {
  //     const { filterField, filterValue, getKarigars, fields } = req.query;

  //     if (getKarigars === 'true') {
  //       const employees = await firestore.collection('Employee').where('Role', '==', 'Karigar').get();

  //       const result = employees.docs.map(doc => ({
  //         id: doc.id,
  //         ...doc.data()
  //       }));

  //       return res.status(200).json(result);
  //     }

  //     if (filterField && filterValue) {
  //       const validFields = ['Phone', 'empcode', 'name'];
  //       if (!validFields.includes(filterField)) {
  //         return res.status(400).json({ error: 'Invalid filtering field. Allowed fields are: ' + validFields.join(', ') });
  //       }

  //       const records = await firestore.collection('Employee').where(filterField, '==', filterValue).get();

  //       const retrievedRecords = records.docs.map(doc => ({
  //         id: doc.id,
  //         empcode: doc.data().empcode,
  //         Phone: doc.data().Phone
  //       }));

  //       if (retrievedRecords.length > 0) {
  //         return res.status(200).json(retrievedRecords);
  //       }
  //       return res.status(404).json({ message: 'No records found for that filter' });
  //     }

  //     if (fields) {
  //       let selectedFields = Array.isArray(fields) ? fields : fields.split(',').map(field => field.trim().replace(/[\[\]"']/g, ''));

  //       if (!selectedFields || selectedFields.length === 0) {
  //         return res.status(400).json({ message: 'No fields selected' });
  //       }

  //       const records = await firestore.collection('Employee').select(...selectedFields).get();

  //       const employeesWithSelectedFields = records.docs.map(doc => {
  //         const selectedData = {};
  //         selectedFields.forEach(field => {
  //           selectedData[field] = doc.data()[field];
  //         });
  //         return {
  //           id: doc.id,
  //           ...selectedData,
  //         };
  //       });

  //       if (employeesWithSelectedFields.length > 0) {
  //         return res.status(200).json(employeesWithSelectedFields);
  //       }
  //       return res.status(404).json({ message: 'No employee records found' });
  //     }

  //     return res.status(400).json({ error: 'Missing required query parameters. Use one of: getKarigars, filterField+filterValue, or fields' });

  //   } catch (error) {
  //     console.error(error);
  //     res.status(500).json({ error: 'Server error' });
  //   }
  // }