const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/mydatabase';
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  age: Number,
  hobbies: [String]
})

const User = mongoose.model('User', userSchema);

app.get('/', (req, res) => {
  res.send('Hello from Render!');
});

app.get('/api/data', (req, res) => {
  res.json({ message: 'Here is your data.' });
});

app.get('/api/users', (req, res) => {
  try{
   const users =  User.find({});
   res.json(users);
  }catch(err){
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});