const express = require('express');
const bcryptjs = require('bcryptjs');
const collection = require("./src/config");
const path = require('path');

const app = express();
const port = 99;

// Middleware to parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Set EJS as the view engine
app.set('view engine', 'ejs');

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// Route: Login Page
app.get('/', (req, res) => {
  res.render('login', { errorMessage: '', successMessage: '', loginMessage: '' });
});

// Route: Signup Page
app.get('/signup', (req, res) => {
  res.render('signup', { errorMessage: '' });
});

// Handle Signup
app.post("/signup", async (req, res) => {
  const { username, password } = req.body;

  try {
    const existingUser = await collection.findOne({ name: username });
    if (existingUser) {
      return res.render("signup", { errorMessage: "Username already exists!" });
    } else {

    const hashedPassword = await bcryptjs.hash(password, 10);
    const newUser = new collection({ name: username, password: hashedPassword });
    await newUser.save();

    res.render("login", { successMessage: "Account created successfully!", errorMessage: '', loginMessage: '' });
  } }catch (err) {
    console.error(err);
    res.render("signup", { errorMessage: "An error occurred. Please try again." });
  }

});

// Handle Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await collection.findOne({ name: username });
    if (!user) {
      return res.render("login", { errorMessage: "Invalid username or password.", successMessage: '', loginMessage: '' });
    }

    const isMatch = await bcryptjs.compare(password, user.password);
    if (isMatch) {
      res.render("home", { loginMessage: "Successfully logged in!" });
    } else {
      res.render("login", { errorMessage: "Invalid username or password.", successMessage: '', loginMessage: '' });
    }
  } catch (err) {
    console.error(err);
    res.render("login", { errorMessage: "An error occurred. Please try again.", successMessage: '', loginMessage: '' });
  }
});

// Start Server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
