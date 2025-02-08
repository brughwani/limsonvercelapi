const admin = require('firebase-admin');
import { NextResponse, NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
const withAuth = require('./middleware/withAuth');

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
  const firestore = admin.firestore();

// module.exports = async (req, res) => {
//     res.setHeader('Access-Control-Allow-Origin', '*');
//     res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
//     res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
//     if (req.method === 'OPTIONS') {
//       res.status(200).end();
//       return;
//     }
  
//     if (req.method !== 'GET') {
//       res.status(405).send('Method Not Allowed');
//       return;
//     }
  

     // records.forEachconst { Firestore } = require('@google-cloud/firestore');
  
  // Initialize Firestore
 // const firestore = new Firestore();
  
//   module.exports = async (req, res) => {
//     res.setHeader('Access-Control-Allow-Origin', '*');
//     res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
//     res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
//     if (req.method === 'OPTIONS') {
//       res.status(200).end();
//       return;
//     }
  
//     if (req.method !== 'GET') {
//       res.status(405).send('Method Not Allowed');
//       return;
//     }
  
//     try {
        
//       const { level, brand, category } = req.query;
//       const productsByBrand = {};
//       let response = {};
  
//   //    const records = await firestore.collection('Products').get();
//       const snapshot = await firestore.collection('Products').get();
//       snapshot.forEach(doc => {
//         const data = doc.data();
//         const brandName = data['Brand'];
//         const categoryName = data['Category'];
//         const productName = data['Product name'];
  
//         if (!productsByBrand[brandName]) {
//           productsByBrand[brandName] = {};
//         }
//         if (!productsByBrand[brandName][categoryName]) {
//           productsByBrand[brandName][categoryName] = [];
//         }
//         productsByBrand[brandName][categoryName].push({
//           id: doc.id,
//           name: productName,
//         });
//       });
  
//       switch(level) {
//         case 'brands':
//           response = Object.keys(productsByBrand);
//           break;
//         case 'categories':
//           response = brand ? Object.keys(productsByBrand[brand] || {}) : [];
//           break;
//         case 'products':
//           response = brand && category ? productsByBrand[brand]?.[category] || [] : [];
//           break;
//         default:
//           response = productsByBrand;
//       }
  
//       return res.status(200).json(response);
//     } 
  

// catch (error) {
//     console.error("Server error:", error);
//     res.status(500).json({ error: 'Server error' });
//   }
// }

const handler = async (req, res) => {
   res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
     
      return res.status(200).end();
      
  }
   
   
    if (req.method !== 'GET') {
      res.status(405).send('Method Not Allowed');
      return;
    }
  
const baseurl='https://limsonvercelapi2.vercel.app';
const url1 = new URL(req.url, baseurl);
    

  const level = url1.searchParams.get('level');
  const brand = url1.searchParams.get('brand');
  const category = url1.searchParams.get('category');

  try {
    let products;
   products = JSON.parse(await fs.promises.readFile(path.join(process.cwd(), 'public', 'products.json'), 'utf8'));
   
  

    const productsByBrand = {};
    let responseObj = {};

    products.forEach(data => {
      const brandName = data['Brand name'];
      const categoryName = data['Category'];
      const productName = data['Product Name'];

      if (!productsByBrand[brandName]) {
        productsByBrand[brandName] = {};
      }
      if (!productsByBrand[brandName][categoryName]) {
        productsByBrand[brandName][categoryName] = [];
      }
      productsByBrand[brandName][categoryName].push({
        id: data.id,
        name: productName,
      });
    });

    switch(level) {
      case 'brands':
        responseObj = Object.keys(productsByBrand);
        break;
      case 'categories':
        responseObj = brand ? Object.keys(productsByBrand[brand] || {}) : [];
        break;
      case 'products':
        responseObj = brand && category ? productsByBrand[brand]?.[category] || [] : [];
        break;
      default:
        responseObj = productsByBrand;
    }

    return res.status(200).json(responseObj);
  } catch (error) {
    console.error("Server error:", error);

    return res.status(500).json({ error: 'Server error' });
  }
}

module.exports = withAuth(handler);