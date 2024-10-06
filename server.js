require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const { MongoClient } = require('mongodb');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const app = express();
const port = 3000;

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
//set the quiz time.......................................................................................................
let QuizTime=10;//minutes
//............................................................................................
app.use(cookieParser());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: QuizTime* 60 * 1000 }
}));

let questions;

client.connect(err => {
    if (err) {
        console.error('Error connecting to MongoDB', err);
        process.exit(1);
    }
    console.log('Connected to MongoDB');
});

function authenticateToken(req, res, next) {
    const token = req.cookies.token;
    if (!token) {
        return res.redirect('/login');
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.log('Token verification failed:', err);
            return res.redirect('/login');
        }
        req.user = user;
        next();
    });
}

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const database = client.db('QUIZ');
        const collection = database.collection('users');

        const user = await collection.findOne({ username });
        if (user && await bcrypt.compare(password, user.passwordHash)) {
            const token = jwt.sign({ username }, 'your-secret-key', { expiresIn: '1h' });
            res.cookie('token', token, { httpOnly: true });
            res.redirect('/dashboard'); // Redirect to the dashboard after successful login
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});
app.get('/dashboard', authenticateToken, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/responses', authenticateToken, async (req, res) => {
    const receivedResponses = req.body;
    try {
        const database = client.db('QUIZ');
        const responsesCollection = database.collection('responses');
        const questionsCollection = database.collection('questions');

        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const username = decoded.username;
        const questions = await questionsCollection.find({}).toArray();

        let score = 0;
        const positiveMarking = 1;
        const negativeMarking = 0.25;

        questions.forEach((question, index) => {
            const correctAnswers = question.answer.sort();
            const userAnswers = receivedResponses[index]?.sort() || [];
            let correctCount = 0;
            let incorrectCount = 0;

            userAnswers.forEach(answer => {
                if (correctAnswers.includes(answer)) {
                    correctCount++;
                } else {
                    incorrectCount++;
                }
            });

            if (correctCount > 0) {
                const partialScore = (positiveMarking / correctAnswers.length) * correctCount;
                score += partialScore;
            }

            if (incorrectCount > 0) {
                const partialPenalty = (negativeMarking * correctAnswers.length) / questions.length;
                score -= partialPenalty;
            }
        });

        await responsesCollection.updateOne(
            { username },
            { 
                $set: { 
                    responses: receivedResponses, 
                    score, 
                    timestamp: new Date() 
                } 
            },
            { upsert: true }
        );

        res.status(200).json({ message: 'Responses received successfully', score });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to save responses' });
    }
});

app.get('/questions', authenticateToken, async (req, res) => {
    try {
        const database = client.db('QUIZ');
        const collection = database.collection('questions');

        questions = await collection.find({}, { projection: { ID: 1, question: 1, options: 1 } }).toArray();
        res.json({ questions });

        const quizEndTime = new Date(Date.now() + QuizTime * 60 * 1000);
        req.session.quizEndTime = quizEndTime;
        console.log('Quiz end time set:', quizEndTime);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/timer', authenticateToken, (req, res) => {
    if (!req.session.cookie.expires) {
        return res.status(400).json({ message: 'Quiz end time not set' });
    }
    const remainingTime = Math.floor((req.session.cookie.expires - Date.now()) / 1000);
    res.json({ remainingTime });
});


app.get('/check-quiz-attempt', authenticateToken, async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const username = decoded.username;

        const database = client.db('QUIZ');
        const collection = database.collection('responses');

        const userQuizData = await collection.findOne({ username });

        res.json({ quizAttempted: !!userQuizData });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/start', authenticateToken, async (req, res) => {
    try {
        const username = req.user.username;
        const database = client.db('QUIZ');
        const responsesCollection = database.collection('responses');

        const userResponse = await responsesCollection.findOne({ username });
        if (userResponse) {
            res.sendFile(path.join(__dirname, 'public', 'view-result.html'));
        } else {
            await responsesCollection.insertOne({ 
                username, 
                responses: [], 
                score: 0, 
                timestamp: new Date() 
            });
            res.sendFile(path.join(__dirname, 'public', 'quiz.html'));
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/view-result-data', authenticateToken, async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const decoded = jwt.verify(token, 'your-secret-key');
        const username = decoded.username;

        const database = client.db('QUIZ');
        const responsesCollection = database.collection('responses');
        const questionsCollection = database.collection('questions');

        const userResponses = await responsesCollection.findOne({ username });

        if (!userResponses) {
            return res.status(404).json({ message: 'No responses found for this user' });
        }

        const questions = await questionsCollection.find({}).toArray();

        let score = userResponses.score;

        const results = questions.map((question, index) => {
            const correctAnswers = question.answer.sort();
            const userAnswers = userResponses.responses[index]?.sort() || [];
            const isCorrect = JSON.stringify(correctAnswers) === JSON.stringify(userAnswers);

            let pointsAwarded = 0;
            const positiveMarking = 1;
            const negativeMarking = 0.25;

            let correctCount = 0;
            let incorrectCount = 0;

            userAnswers.forEach(answer => {
                if (correctAnswers.includes(answer)) {
                    correctCount++;
                } else {
                    incorrectCount++;
                }
            });

            if (correctCount > 0) {
                const partialScore = (positiveMarking / correctAnswers.length) * correctCount;
                pointsAwarded += partialScore;
            }

            if (incorrectCount > 0) {
                const partialPenalty = (negativeMarking / correctAnswers.length) * incorrectCount;
                pointsAwarded -= partialPenalty;
            }

            console.log({
                question: question.question,
                options: question.options,
                correctAnswers,
                userAnswers,
                pointsAwarded: pointsAwarded.toFixed(2)
            });

            return {
                question: question.question,
                options: question.options,
                correctAnswers,
                userAnswers,
                isCorrect,
                pointsAwarded: pointsAwarded.toFixed(2)
            };
        });

        res.json({ results, score });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Catch-all route to handle all other requests and redirect to index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
