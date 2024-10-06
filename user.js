const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// List of meaningful usernames
const meaningfulUsernames = [
    'brave_tiger',
    'happy_sunshine',
    'creative_writer',
    'adventurous_spirit',
    'tech_guru',
    'nature_lover',
    'music_artist',
    'bookworm',
    'coffee_lover',
    'night_owl'
];

// Connect to MongoDB
mongoose.connect('mongodb+srv://kavyajain1916:K12345678@cluster0.vmxlebi.mongodb.net/QUIZ', { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

// Define the user schema
const userSchema = new mongoose.Schema({
    username: String,
    passwordHash: String
});

// Create a model from the schema
const User = mongoose.model('User', userSchema);

// Function to generate a unique and meaningful username
function generateUsername() {
    // Get a random index from the meaningfulUsernames array
    const randomIndex = Math.floor(Math.random() * meaningfulUsernames.length);
    return meaningfulUsernames[randomIndex];
}

// Function to generate a random password
function generatePassword() {
    // Implement your logic to generate a random password
    return crypto.randomBytes(8).toString('hex'); // Example: e4f82bc9
}

// Function to hash a password
async function hashPassword(password) {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return hashedPassword;
}

// Function to add a user to the database
async function addUser() {
    const username = generateUsername();
    const password = generatePassword();
    const passwordHash = await hashPassword(password);

    const newUser = new User({
        username: username,
        passwordHash: passwordHash
    });

    await newUser.save();
    console.log(`User ${username} added to the database with password: ${password}`);
}

// Function to add multiple users
async function addUsers(count) {
    for (let i = 0; i < count; i++) {
        await addUser();
    }
}

// Call the function to add 10 users
addUsers(10);