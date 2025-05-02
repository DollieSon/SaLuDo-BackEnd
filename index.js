const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

app.get('/', (req, res) => {
  res.send('Hello from Render!');
});

app.get('/api/data', (req, res) => {
  res.json({ message: 'Here is your data.' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});