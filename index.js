const express = require('express');
const cors = require('cors');
const {MongoClient} = require('mongodb');
const app = express();
const PORT = process.env.PORT || 3000;
require('dotenv').config();

app.use(cors());

const URI = process.env.MONGO_URI;

const client = new MongoClient(URI);

app.get('/', (req, res) => {
  res.send('Hello from Render!');
});

app.get('/api/data', (req, res) => {
  res.json({ message: 'Here is your data.' });
});

app.get('/api/users', async (req, res) => {
  console.log('Fetching users...');
  try{
    const db = client.db('SaLuDoTesting');
    console.log('Connected to database:', db.databaseName);
    const collections = await db.collections();
    for (const collection of collections) {
      console.log('Collection name:', collection.collectionName);
    }
    const collection = db.collection('SaLuDoDataBase');
    console.log('Connected to collection:', collection.collectionName);
    const found = await collection.find().toArray(); // Fetch users from the database
    console.log('Found users:', found);
    res.json(found); // Send the users as a JSON response
  }catch(err){
    console.log(err);
    res.json({error: err.message});
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});