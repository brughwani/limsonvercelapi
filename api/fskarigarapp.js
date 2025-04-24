

const handler = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
  
    if (req.method === 'PATCH') {
      try {
        const updates = req.body;
        if (!updates.id || !updates.fields) {
          return res.status(400).json({ error: 'Invalid update format' });
        }
        
        console.log('Updates received:', updates);
  
        const docRef = firestore.collection('Admin').doc(updates.id);
        // Use set with merge:true to append new fields (or update existing keys)
        await docRef.set(updates.fields, { merge: true });
  
        return res.status(200).json({
          message: 'Records updated successfully',
          records: { id: updates.id, fields: updates.fields }
        });
      } catch (error) {
        console.error('Error updating record:', error);
        res.status(500).json({ error: error.message });
      }
    }
  };
  
  module.exports = withAuth(handler);