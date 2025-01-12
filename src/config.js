// Importing necessary modules
const { name } = require("ejs"); // Destructuring 'name' from 'ejs' module (not used in this snippet)
const mongoose = require("mongoose"); // Importing mongoose for MongoDB operations

// Connecting to MongoDB
const connect = mongoose.connect("mongodb+srv://milon:milon@cluster0.3ccfb.mongodb.net/Prescription") 
// Handling connection success and failure
connect.then(() => {
    console.log("database connected"); // Log message when database connection is successful
}).catch(() => {
    console.log("database not connected"); // Log message when database connection fails
});

// Defining the schema for the 'users' collection
const LoginSchema = new mongoose.Schema({
    fullname: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    qualification: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true
    },
    mobileNumber: {
        type: Number,
        required: true
    },


    password: {
        type: String,
        required: true
    }
}, { versionKey: false });

const AddPatientSchema = new mongoose.Schema({
    Patient_name: { type: String, required: true },
    Patinet_address: { type: String, required: true },
    gender: { type: String, required: true },
    Patient_mobile: { type: String, required: true },
    pid: { type: String, required: true }
}, { versionKey: false }); 

const MedicineSchema = new mongoose.Schema({
    "brandName": { type: String, required: true },
    "dosageForm": { type: String, required: true },
    "generic": { type: String, required: true },
    "strength": { type: String, required: true },
    "manufacturer": { type: String, required: true }
}, { versionKey: false });


// Create a model for the Medicine_names collection
const Medicine = new mongoose.model('Medicine_names', MedicineSchema);
const Patients = new mongoose.model('Patients_Info', AddPatientSchema)


// Creating a mongoose model based on the schema for the 'Users' collection
const collection = new mongoose.model("Users", LoginSchema);

// Exporting the mongoose model for use in other parts of the application
module.exports = { collection, Medicine, Patients };

