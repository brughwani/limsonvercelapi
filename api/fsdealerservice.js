import { NextResponse, NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
const withAuth = require('./middleware/withAuth');

const admin = require('firebase-admin');


// if (!admin.apps.length) {
//   const serviceAccount = {
//     projectId: process.env.project_id,
//     privateKey: process.env.firebase_private_key.replace(/\\n/g, '\n'), // Handle newlines
//     clientEmail: process.env.client_email,
//   };


//   admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount),
//   });
// }
 if (!admin.apps.length) {
   try {
     const serviceAccount = {
       projectId: process.env.project_id,
       privateKey: process.env.firebase_private_key.replace(/\\n/g, '\n'),
       clientEmail: process.env.client_email,
     };
     
     admin.initializeApp({
       credential: admin.credential.cert(serviceAccount),
     });
   } catch (error) {
     console.error("Firebase Admin Initialization Error:", error);
   }
 }


const handler = async (req,res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      // const response = NextResponse.json({}, { status: 200 });
      // response.headers.set('Access-Control-Allow-Origin', '*');
      // response.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
      // response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
      // return response;
      return res.status(200).json({});
    }

  if (req.method !== 'GET') {
    res.status(405).send('Method Not Allowed');
    return;
  }
console.log("req",req)


const baseurl='https://limsonvercelapi2.vercel.app';
const url1 = new URL(req.url, baseurl);
    
   

    const locality = url1.searchParams.get('locality');
    const getLocations = url1.searchParams.get('getLocations');
    const getAllDealers = url1.searchParams.get('getAllDealers');
  
    try {
      // Fetch dealer data from static JSON file
  const dealers = JSON.parse(await fs.promises.readFile(path.join(process.cwd(), 'public', 'Dealer.json'), 'utf8'));
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
      
        return res.status(200).json(dealersByLocation);

      }
  
      if (getLocations === 'true') {
        const locations = new Set();
  
        dealers.forEach(record => {
          const location = record.locality;
          if (location) {
            locations.add(location);
          }
        });
        
        return res.status(200).json(Array.from(locations));
      }
  
      if (locality) {
        const filteredDealers = dealers.filter(record => record.locality === locality);
   
        return res.status(200).json(filteredDealers);
      }
   
      return res.status(400).json({ error: 'Missing required query parameters' });
    } catch (error) {
      console.error("Server error:", error);
  
      return res.status(500).json({ error: 'Server error' });
   }
  }

 
  module.exports = withAuth(handler);