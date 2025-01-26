const { name } = require("ejs");
const mongoose = require("mongoose");
require('dotenv').config();

const connect = mongoose.connect(process.env.MONGO_URI);
connect.then(() => {
    console.log("database connected");
}).catch(() => {
    console.log("database not connected");
});

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
        type: String,
        required: true
    },


    password: {
        type: String,
        required: true
    }
}, { versionKey: false });

const AddPatientSchema = new mongoose.Schema({
    Patient_name: { type: String, required: true },
    Patient_address: { type: String },
    Patient_age: { type: Number, required: true },
    gender: { type: String, required: true },
    Patient_mobile: { type:String, required: true,unique:false},
    pid: { type: String, required: true, unique: true },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true }  // Added user reference
}, { versionKey: false });


const MedicineSchema = new mongoose.Schema({
    "brandName": { type: String, required: true },
    "dosageForm": { type: String, required: true },
    "generic": { type: String, required: true },
    "strength": { type: String, required: true },
    "manufacturer": { type: String, required: true }
}, { versionKey: false });

const Medicine = new mongoose.model('Medicine_names', MedicineSchema);
const Patients = new mongoose.model('Patients_Info', AddPatientSchema);
const collection = new mongoose.model("Users", LoginSchema);

module.exports = { collection, Medicine, Patients};

