import { NextResponse, NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
const withAuth = require('./middleware/withAuth');

//const withAuth = require('./withAuth');

const admin = require('firebase-admin');


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
 //const firestore = admin.firestore();



// module.exports = async (req, res) => {
//   res.setHeader('Access-Control-Allow-Origin', '*');
//   res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
//   res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

//   if (req.method === 'OPTIONS') {
//     res.status(200).end();
//     return;
//   }

//   if (req.method !== 'GET') {
//     res.status(405).send('Method Not Allowed');
//     return;
//   }

//   try {
//   // Fetch dealer data from static JSON file
//   const dealers = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public', 'Dealers.json'), 'utf8'));


//     const { locality, getLocations, getAllDealers } = req.query;

//     if (getAllDealers === 'true') {
//       const dealersByLocation = {};
//     //  const records = await firestore.collection('Dealer').get();

//       dealers.forEach(doc => {
//    //     const record = doc.data();
//         const location = record.locality;
//         const dealerInfo = {
//           id: doc.id,
//           dealerName: record['Dealer name'],
//           location: location
//         };

//         if (location) {
//           if (!dealersByLocation[location]) {
//             dealersByLocation[location] = [];
//           }
//           dealersByLocation[location].push(dealerInfo);
//         }
//       });

//       return res.status(200).json(dealersByLocation);
//     }

//     if (getLocations === 'true') {
//       const locations = new Set();
//       const records = await firestore.collection('Dealer').get();

//       records.forEach(doc => {
//         const location = doc.data().locality;
//         if (location) {
//           locations.add(location);
//         }
//       });

//       return res.status(200).json(Array.from(locations));
//     }

//     if (locality) {
//       const records = await firestore.collection('Dealer').where('locality', '==', locality).get();
//       const dealers = records.docs.map(doc => ({
//         id: doc.id,
//         dealerName: doc.data()['Dealer name'],
//         location: doc.data().locality
//       }));

//       return res.status(200).json(dealers);
//     }

//     res.status(400).json({ error: 'Missing required query parameters' });

//   } catch (error) {
//     console.error("Server error:", error);
//     res.status(500).json({ error: 'Server error' });
//   }
// };


const handler = async (req, res) => {
  // res.setHeader('Access-Control-Allow-Origin', '*');
  // res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  // res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).send('Method Not Allowed');
    return;
  }
console.log("req",req)

const { nextUrl } = req;
const searchParams = nextUrl.searchParams;
    

// console.log("req.url", req.NextUrl);
// const { searchParams } = new URL(req.NextUrl);
  //  const { searchParams } = new URL(req.url);
 // const { searchParams } = new URL("https://limsonvercelapi2.vercel.app"+req.url);
    const locality = searchParams.get('locality');
    const getLocations = searchParams.get('getLocations');
    const getAllDealers = searchParams.get('getAllDealers');
  
    try {
      // Fetch dealer data from static JSON file
      const dealers = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public', 'Dealer.json'), 'utf8'));
  
      if (getAllDealers === 'true') {
        const dealersByLocation = {};
        
  
        dealers.forEach(record => {
          const location = record.locality;
          const dealerInfo = {
            id: record.id,
            dealerName: record['Dealer name'],
            location: location
          };
  
          if (location) {
            if (!dealersByLocation[location]) {
              dealersByLocation[location] = [];
            }
            dealersByLocation[location].push(dealerInfo);
          }
        });
        const response = NextResponse.json(dealersByLocation);
        response.headers.set('Access-Control-Allow-Origin', '*');
        response.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
        return response;
      }
  
      if (getLocations === 'true') {
        const locations = new Set();
  
        dealers.forEach(record => {
          const location = record.locality;
          if (location) {
            locations.add(location);
          }
        });
        const response = NextResponse.json(Array.from(locations));
        response.headers.set('Access-Control-Allow-Origin', '*');
        response.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
        return response;
      }
  
      if (locality) {
        const filteredDealers = dealers.filter(record => record.locality === locality);
        const response = NextResponse.json(filteredDealers);
    
        response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
      return response;
      }
      const response = NextResponse.json({ error: 'Missing required query parameters' }, { status: 400 });
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
      return response;
    } catch (error) {
      console.error("Server error:", error);
    const response = NextResponse.json({ error: 'Server error' }, { status: 500 });
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return response;
   }
  }

  export async function OPTIONS(req) {
    const response = NextResponse.json({});
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return response;
  }
  module.exports = withAuth(handler);