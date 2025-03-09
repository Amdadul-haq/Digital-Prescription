const express = require('express');
const bcryptjs = require('bcryptjs');
require('dotenv').config();
const { collection, Medicine, Patients} = require("./src/config");
const session = require('express-session');
const path = require('path');
const rateLimit = require('express-rate-limit');
//const puppeteer = require('puppeteer');
const isProduction = process.env.NODE_ENV === 'production';

const puppeteer = isProduction ? require('puppeteer-core') : require('puppeteer');
const chromium = isProduction ? require('@sparticuz/chromium') : null;

const ejs = require('ejs');
const app = express();
app.set('trust proxy', 1); // Trust first proxy
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: "secret key",
  resave: false,
  saveUninitialized: true,

}));


// Define isAuthenticated middleware before routes
function isAuthenticated(req, res, next) {
  if (req.session.userId) {
    return next();  // Proceed to the next middleware or route
  } else {
    res.redirect('/');  // Redirect if not authenticated
  }
}
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,  // Limit each IP to 5 login attempts
  message: 'Too many login attempts. Please try again later.'
});

app.set('view engine', 'ejs');

app.use(express.static(path.join(__dirname, "public")));

app.get('/', (req, res) => {
  res.render('login', { errorMessage: '', successMessage: '' });
});

app.get('/signup', (req, res) => {
  res.render('signup', { errorMessage: '' });
});

app.get('/home',isAuthenticated, (req, res) => {
  if (!req.session.username) {
    return res.redirect('/'); // Redirect to login if not logged in
  }
  res.render('home', { username: req.session.username, successMessage: '', errorMessage:'' });
});
app.get('/create-report', (req, res) => {
  res.render('create_report', {username: req.session.username});
});

app.get('/add-medicine', isAuthenticated,(req, res) => {
  res.render('add_medicine', { username: req.session.username, errorMessage: '', successMessage: '' });
});

app.get('/add-patient',isAuthenticated, (req, res) => {
  res.render('add_patient', { username: req.session.username, errorMessage: '', successMessage: '' });
});

app.get('/prescription',isAuthenticated, async (req, res) => {

  res.render('prescription', {
    username: req.session.username,
    successMessage: '',
    errorMessage: ''
  });

});

app.get('/medicines/search',isAuthenticated, async (req, res) => {
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

app.get('/search-medicine', isAuthenticated,async (req, res) => {
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

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

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

      res.render("login", { successMessage: "Account created successfully!", errorMessage: '' });
    }
  } catch (err) {
    console.error(err);
    res.render("signup", { errorMessage: "An error occurred. Please try again." });
  }

});

app.post('/login', loginLimiter,async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await collection.findOne({ name: username });
    if (!user) {
      return res.render("login", { errorMessage: "Invalid username or password.", successMessage: '' });
    }

    const isMatch = await bcryptjs.compare(password, user.password);
    if (isMatch) {
      req.session.userId = user._id; 
      req.session.username = user.fullname; // Store username in session
      req.session.qualification = user.qualification;
      req.session.address = user.address;
      req.session.mobileNumber = user.mobileNumber;

      // req.session.
      // res.redirect('/home');
      res.render("home", { successMessage: "Successfully logged in!", errorMessage:'', username: req.session.username });
    } else {
      res.render("login", { errorMessage: "Invalid username or password.", successMessage: '' });
    }
  } catch (err) {
    console.error(err);
    res.render("login", { errorMessage: "An error occurred. Please try again.", successMessage: '' });
  }
});

app.post('/add-medicine',isAuthenticated, async (req, res) => {
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

app.get('/get-patient-info',isAuthenticated, async (req, res) => {
  const { id } = req.query;
  try {
    const patient = await Patients.findOne({ pid: id, addedBy: req.session.userId }); // Restrict access

    if (patient) {
      res.json({
        name: patient.Patient_name || '',
        address: patient.Patient_address || '',
        Age: patient.Patient_age || '',
        Sex: patient.gender || ''
      });
    } else {
      res.json(null);
    }
  } catch (err) {
    res.status(500).send('Error retrieving patient info');
  }
});

app.post('/check-patient-mobile', isAuthenticated, async (req, res) => {
  const { Patient_mobile } = req.body; // Extract mobile number from the request body

  try {
    // Search for an existing patient with the same mobile number, scoped to the logged-in user
    const existingPatient = await Patients.findOne({
      Patient_mobile,
      addedBy: req.session.userId // Restrict search to patients added by the logged-in user
    });

    // If patient exists, return a JSON response with `exists: true`
    if (existingPatient) {
      return res.json({ exists: true });
    }

    // If no patient is found, return a JSON response with `exists: false`
    res.json({ exists: false });
  } catch (error) {
    console.error('Error checking patient mobile:', error);

    // In case of any error, send an error response
    res.status(500).json({ exists: false, error: 'An error occurred while checking the mobile number.' });
  }
});

app.post('/add-patient', isAuthenticated, async (req, res) => {
  const { Patient_name, Patient_address, Patient_age, gender, Patient_mobile } = req.body;

  const generateUniquePid = async () => {
    let unique = false;
    let pid;
    while (!unique) {
      pid = Math.floor(100000 + Math.random() * 900000).toString();
      const existingPatient = await Patients.findOne({ pid: pid });
      if (!existingPatient) {
        unique = true;
      }
    }
    return pid;
  };

  try {

    const pid = await generateUniquePid();
    const newPatient = new Patients({
      Patient_name,
      Patient_address,
      Patient_age,
      gender,
      Patient_mobile,
      pid,
      addedBy: req.session.userId  // Store the logged-in user ID
    });

    await newPatient.save();

    res.render('add_patient', {
      username: req.session.username,
      errorMessage: '',
      successMessage: 'Patient details are successfully added!'
    });

  } catch (error) {
    console.error('Error saving patient details:', error);
    res.render('add_patient', {
      errorMessage: 'Failed to add patient. Please try again.',
      successMessage: '',
      username: req.session.username
    });
  }
});
app.get("/patient-details", isAuthenticated, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const patients = await Patients.find({ addedBy: req.session.userId }) // Filter by user
      .skip(skip)
      .limit(limit)
      .sort({ Patient_name: 1 });

    const totalPatients = await Patients.countDocuments({ addedBy: req.session.userId });
    const totalPages = Math.ceil(totalPatients / limit);

    res.render("patients_details", {
      patients,
      totalPages,
      currentPage: page,
      searchQuery: "",
    });
  } catch (error) {
    console.error("Error fetching patient details:", error);
    res.status(500).send("Server Error");
  }
});

app.get("/search-patient", isAuthenticated, async (req, res) => {
  try {
    const { query } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const searchCriteria = query
      ? {
        addedBy: req.session.userId,  // Restrict by user
        $or: [
          { Patient_name: { $regex: query, $options: "i" } },
          { Patient_mobile: { $regex: query, $options: "i" } },
          { pid: { $regex: query, $options: "i" } }
        ]
      }
      : { addedBy: req.session.userId };

    const patients = await Patients.find(searchCriteria)
      .skip(skip)
      .limit(limit);

    const totalPatients = await Patients.countDocuments(searchCriteria);
    const totalPages = Math.ceil(totalPatients / limit);

    res.render("patients_details", {
      patients,
      totalPages,
      currentPage: page,
      searchQuery: query || "",
    });
  } catch (error) {
    console.error("Error searching patients:", error);
    res.status(500).send("Server Error");
  }
});

app.post("/add-prescription",isAuthenticated, async (req, res) => {
  const {
    id,
    patientName,
    PatientAge,
    sex,
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

  try {
    const generatedOn = new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' });
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
      id,
      patientName,
      PatientAge,
      historyList,
      sex,
      testList,
      diagnosis: diagonosis,
      medicines,
      nextVisitDate,
      complaintsList,
      bp, pulse, weight, temperature,
      generatedOn
    });

    // Launch Puppeteer and generate PDF
    // const browser = await puppeteer.launch({
    //   args: ['--no-sandbox', '--disable-setuid-sandbox']
    // });
    const browser = await puppeteer.launch(
      isProduction
        ? {
          executablePath: await chromium.executablePath(),
          args: chromium.args,
          headless: chromium.headless,
        }
        : {
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        }
    );

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

app.delete('/delete-patient/:id', async (req, res) => {
  try {
    const result = await Patients.deleteOne({ _id: req.params.id, addedBy: req.session.userId });
    if (result.deletedCount > 0) {
      res.json({ success: true });
    } else {
      res.json({ success: false });
    }
  } catch (error) {
    console.error('Error deleting patient:', error);
    res.status(500).json({ success: false });
  }
});

app.post('/update-patient', async (req, res) => {
  const { id, Patient_name, Patient_address, Patient_age, gender, Patient_mobile } = req.body;
  try {
    await Patients.updateOne(
      { _id: id, addedBy: req.session.userId },
      { $set: { Patient_name, Patient_address, Patient_age, gender, Patient_mobile } }
    );
    res.redirect('/patient-details');
  } catch (error) {
    console.error('Error updating patient:', error);
    res.status(500).send("Failed to update patient");
  }
});


app.post('/generate-report', async (req, res) => {
  const {
    patientId,
    patientName,
    patientAge,
    patientSex,
    labId,
    refferedBy,
    sampleDate,
    testName,
    result
  } = req.body;

  try {
   
    const generatedOn = new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' });
    // Render EJS template with data
    const templatePath = path.join(__dirname, 'views', 'report_template.ejs');
    const htmlContent = await ejs.renderFile(templatePath, {
      patientId,
      patientName,
      patientAge,
      patientSex,
      labId,
      refferedBy,
      sampleDate,
      testName,
      result,
      generatedOn

    });

    // Launch Puppeteer and generate PDF
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfPath = path.join(__dirname, 'reports', `${patientId}_Report.pdf`);
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true
    });

    await browser.close();

    // Send the PDF file to the client
    res.download(pdfPath, `${patientId}_Report.pdf`, (err) => {
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
