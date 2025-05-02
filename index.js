const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const app = express();
const PORT = process.env.PORT || 3000;
require('dotenv').config();

app.use(cors());

const URI = process.env.MONGO_URI;
const client = new MongoClient(URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

let db; // Store the database connection

// Connect to MongoDB once when the server starts
client.connect()
  .then(() => {
    console.log('Connected to MongoDB');
    db = client.db('SaLuDoTesting'); // Set the database connection
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1); // Exit the application if the connection fails
  });

// Routes
app.get('/', (req, res) => {
  res.send('Hello from Render!');
});

app.get('/api/data', (req, res) => {
  res.json({ message: 'Here is your data.' });
});

app.get('/api/users', async (req, res) => {
  try {
    const collection = db.collection('SaLuDoDataBase');
    const users = await collection.find().toArray();
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});