const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const cors = require('cors')
const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

const SECRET_KEY = 'your_secret_key';
const users = [
  { id: 1, username: 'admin', password: 'password' },
  { id: 2, username: 'user1', password: '123456' }
];

let shoppingLists = [];
let currentListId = 1;
let currentItemId = 1;

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

const swaggerDocument = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'openapi.json'), 'utf8')
);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Authenticate and get JWT token
app.post('/api/v1/authenticate', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });

  const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '1h' });
  res.json({ token });
});

// Create a shopping list
app.post('/api/v1/shopping-lists', authenticateToken, (req, res) => {
  const { name } = req.body;
  const newList = {
    id: currentListId++,
    name,
    userId: req.user.id,
    items: []
  };
  shoppingLists.push(newList);
  res.status(201).json(newList);
});

// Get all shopping lists for the authenticated user
app.get('/api/v1/shopping-lists', authenticateToken, (req, res) => {
  const userLists = shoppingLists.filter(list => list.userId === req.user.id);
  const response = userLists.map(list => ({ id: list.id, name: list.name }));
  res.json(response);
});

// Get items of a specific shopping list
app.get('/api/v1/shopping-lists/:id/items', authenticateToken, (req, res) => {
  const listId = parseInt(req.params.id);
  const list = shoppingLists.find(l => l.id === listId && l.userId === req.user.id);
  if (!list) return res.status(404).json({ message: 'List not found' });
  res.json(list.items);
});

// Add item to a shopping list
app.post('/api/v1/shopping-lists/:id/items', authenticateToken, (req, res) => {
  const listId = parseInt(req.params.id);
  const list = shoppingLists.find(l => l.id === listId && l.userId === req.user.id);
  if (!list) return res.status(404).json({ message: 'List not found' });

  const { name, quantity, mustHave } = req.body;
  const newItem = {
    id: currentItemId++,
    name,
    quantity,
    mustHave
  };
  list.items.push(newItem);
  res.status(201).json(newItem);
});

// Update item in a shopping list
app.put('/api/v1/shopping-lists/:id/items/:itemId', authenticateToken, (req, res) => {
  const listId = parseInt(req.params.id);
  const id = parseInt(req.params.itemId);
  const { name, quantity, mustHave } = req.body;
  const list = shoppingLists.find(l => l.id === listId && l.userId === req.user.id);
  if (!list) return res.status(404).json({ message: 'List not found' });

  const item = list.items.find(i => i.id === id);
  if (!item) return res.status(404).json({ message: 'Item not found' });

  item.name = name;
  item.quantity = quantity;
  item.mustHave = mustHave;

  res.json(item);
});

// Delete item from a shopping list
app.delete('/api/v1/shopping-lists/:id/items/:itemId', authenticateToken, (req, res) => {
  const listId = parseInt(req.params.id);
  const itemId = parseInt(req.params.itemId);
  const list = shoppingLists.find(l => l.id === listId && l.userId === req.user.id);
  if (!list) return res.status(404).json({ message: 'List not found' });

  const itemIndex = list.items.findIndex(i => i.id === itemId);
  if (itemIndex === -1) return res.status(404).json({ message: 'Item not found' });

  list.items.splice(itemIndex, 1);
  res.status(204).send();
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
