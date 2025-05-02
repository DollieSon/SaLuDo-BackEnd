const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Hello from Render!');
});

app.get('/api/data', (req, res) => {
  res.json({ message: 'Here is your data.' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});