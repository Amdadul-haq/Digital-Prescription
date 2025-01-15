const express = require('express');
const bcryptjs = require('bcryptjs');
const { collection, Medicine, Patients } = require("./src/config");
const path = require('path');
const session = require('express-session');
const puppeteer = require('puppeteer');
const ejs = require('ejs');
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
// Configure session middleware
app.use(session({
  secret: 'your-secret-key', // Replace with a secure key
  resave: false,
  saveUninitialized: true,
}));

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

// Route: Home Page
// Route: Home Page
app.get('/home', (req, res) => {
  if (!req.session.username) {
    return res.redirect('/'); // Redirect to login if not logged in
  }
  res.render('home', { username: req.session.username, loginMessage: '' });
});


// Route: Add Medicine Page
app.get('/add-medicine', (req, res) => {
  res.render('add_medicine', { username: req.session.username, errorMessage: '', successMessage: '' });
});

app.get('/add-patient', (req, res) => {
  res.render('add_patient', { username: req.session.username, errorMessage: '', successMessage: '' });
});



// Route: Prescription Page
app.get('/prescription', async (req, res) => {

  res.render('prescription', {
    username: req.session.username,
    successMessage: '',
    errorMessage: ''
  });

});


app.get('/medicines/search', async (req, res) => {
  const { brandName, page = 1, limit = 10 } = req.query;

  try {
    const query = { brandName: { $regex: `^${brandName}`, $options: 'i' } }; // Case-insensitive, starts with

    const skip = (page - 1) * limit; // Calculate offset
    const medicines = await Medicine.find(query).skip(skip).limit(Number(limit));
    const totalMedicines = await Medicine.countDocuments(query); // Total matching documents

    res.json({
      medicines,
      currentPage: Number(page),
      totalPages: Math.ceil(totalMedicines / limit),
      totalMedicines,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching medicine data.', error });
  }
});



app.get('/search-medicine', async (req, res) => {
  const query = req.query.query;
  try {
    const medicines = await Medicine.find({ "brandName": { $regex: query, $options: 'i' } })
      .sort({ "brandName": 1 }) // Sort alphabetically
      .limit(30);

    // Optionally prioritize results where the query matches the beginning of the name
    const sortedResults = medicines.sort((a, b) => {
      if (a["brandName"].toLowerCase().startsWith(query.toLowerCase())) return -1;
      if (b["brandName"].toLowerCase().startsWith(query.toLowerCase())) return 1;
      return 0;
    });

    res.json(sortedResults.map(med => ({ brandName: med["brandName"] })));
  } catch (error) {
    console.error('Error searching medicines:', error);
    res.status(500).json({ error: 'Failed to search medicines' });
  }
});


// Route: Logout
app.get('/logout', (req, res) => {
  res.redirect('/'); // Redirect to login page
});


// Handle Signup
app.post("/signup", async (req, res) => {
  const { fullname, username, qualification, address, mobileNumber, password } = req.body;

  try {
    const existingUser = await collection.findOne({ name: username });
    if (existingUser) {
      return res.render("signup", { errorMessage: "Username already exists!" });
    } else {

      const hashedPassword = await bcryptjs.hash(password, 10);
      const newUser = new collection({ fullname: fullname, name: username, qualification: qualification, address: address, mobileNumber: mobileNumber, password: hashedPassword });
      await newUser.save();

      res.render("login", { successMessage: "Account created successfully!", errorMessage: '', loginMessage: '' });
    }
  } catch (err) {
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
      req.session.username = user.fullname; // Store username in session
      req.session.qualification = user.qualification;
      req.session.address = user.address;
      req.session.mobileNumber = user.mobileNumber;

      // req.session.
      // res.redirect('/home');
      res.render("home", { loginMessage: "Successfully logged in!", username: req.session.username });
    } else {
      res.render("login", { errorMessage: "Invalid username or password.", successMessage: '', loginMessage: '' });
    }
  } catch (err) {
    console.error(err);
    res.render("login", { errorMessage: "An error occurred. Please try again.", successMessage: '', loginMessage: '' });
  }
});

app.post('/add-medicine', async (req, res) => {
  const {
    brandName,
    dosageForm,
    generic,
    strength,
    manufacturer
  } = req.body;

  try {
    // Validate that all required fields are provided
    if (!brandName || !dosageForm || !generic || !strength || !manufacturer) {
      return res.render('add_medicine', {
        errorMessage: 'All fields are required.',
        successMessage: '',
        username: req.session.username
      });
    }

    // Create a new instance of the Medicine model
    const newMedicine = new Medicine({
      brandName,
      dosageForm,
      generic,
      strength,
      manufacturer
    });

    // Save the new medicine to the database
    await newMedicine.save();

    res.render('add_medicine', {
      username: req.session.username,
      errorMessage: '',
      successMessage: 'Medicine successfully added!'
    });
  } catch (error) {
    console.error('Error saving medicine to the database:', error);
    res.render('add_medicine', {
      errorMessage: 'Failed to add medicine. Please try again.',
      successMessage: '',
      username: req.session.username
    });
  }
});


app.post('/add-patient', async (req, res) => {
  const { Patient_name, Patinet_address, gender, Patient_mobile, pid } = req.body;

  try {
    const existingPatient = await Patients.findOne({ pid: pid });
    if (existingPatient) {
      return res.render("add_patient", { successMessage: '', errorMessage: "Patient Id  already exists!", username: req.session.username });
      // Create a new instance of the Patients model
    } else {
      const newPatient = new Patients({ Patient_name, Patinet_address, gender, Patient_mobile, pid });

      // Save the new patient to the database
      await newPatient.save();

      res.render('add_patient', {
        username: req.session.username,
        errorMessage: '',
        successMessage: 'Patients details are successfully added!'
      });
    }
  } catch (error) {
    console.error('Error saving patient details to the database:', error);
    res.render('add_patient', {
      errorMessage: 'Failed to add patient. Please try again.',
      successMessage: '',
      username: req.session.username
    });
  }
});


app.post("/add-prescription", async (req, res) => {
  const {
    id,
    patientName,
    patientAge,
    diagonosis,
    history,
    cc,
    bp, pulse, weight, temperature,
    medicine,
    feedingRules,
    feedDays,
    test,
    nextVisitDate
  } = req.body;



  const { username, qualification, address, mobileNumber } = req.session;

  try {
    // Ensure these fields are always arrays
    const medicinesArray = Array.isArray(medicine) ? medicine : [medicine];
    const feedingRulesArray = Array.isArray(feedingRules) ? feedingRules : [feedingRules];
    const feedDaysArray = Array.isArray(feedDays) ? feedDays : [feedDays];

    const complaintsList = cc ? cc.split(',').map(item => item.trim()) : [];
    const testList = test ? test.split(',').map(item => item.trim()) : [];
    const historyList = history ? history.split(',').map(item => item.trim()) : [];

    // Combine medicines with feeding rules and days
    const medicines = medicinesArray.map((med, i) => ({
      name: med,
      rules: feedingRulesArray[i] || '',
      days: feedDaysArray[i] || ''
    }));

    // Render EJS template with data
    const templatePath = path.join(__dirname,'views', 'template.ejs');
    const htmlContent = await ejs.renderFile(templatePath, {
      // doctorName: username,
      id,
      // qualification,
      // address,
      // mobileNumber,
      patientName,
      patientAge,
      historyList,
      testList,
      diagnosis: diagonosis,
      medicines,
      nextVisitDate,
      complaintsList,
      bp, pulse, weight, temperature,
       generatedOn: new Date().toLocaleString()
    });

    // Launch Puppeteer and generate PDF
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfPath = path.join(__dirname, 'prescriptions', `${id}-${patientName}.pdf`);
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true
    });

    await browser.close();

    // Send the PDF file to the client
    res.download(pdfPath, `${id}-${patientName}.pdf`, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
        res.status(500).send('Error generating PDF');
      }
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).send('Error generating PDF');
  }
});













// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
