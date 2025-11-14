const express = require('express');
const dotenv=require('dotenv')
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const AWS = require('aws-sdk');
const { v4: uuid } = require("uuid");



const dynamoose = require('dynamoose');
const jwt = require('jsonwebtoken');
dotenv.config();
const OpenAI=require('openai')
 const client=new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL:"https://openrouter.ai/api/v1",

});

const cookieParser = require('cookie-parser');
const session = require('express-session');
const app = express();
const port = process.env.PORT || 3000;

AWS.config.update({
  region: process.env.AWS_REGION || "us-east-1",
});
dynamoose.aws.sdk = AWS;


// User Schema
const UserSchema = new dynamoose.Schema({
  username: { type: String, hashKey: true },
  passwordHash: String,
});

// Question Schema
const QuestionSchema = new dynamoose.Schema({
  ID: {
    type: Number,
    hashKey: true, // Primary key
  },
  question: String,
  options: {
    type: Array,
    schema: [String],
  },
  answer: {
    type: Array,
    schema: [Number],
  },
});



// Response Schema
const ResponseSchema = new dynamoose.Schema({
  username: { type: String, hashKey: true },
  responses: { type: Array, schema: [Array] },
  score: Number,
  timestamp: Date,
});

// Create Models
const User = dynamoose.model("Users", UserSchema);
const Question = dynamoose.model("QUESTIONS", QuestionSchema);
const Response = dynamoose.model("RESPONSES", ResponseSchema);


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

function authenticateAdmin(req, res, next) {
    const token = req.cookies.token;
    if (!token) return res.redirect('/login');

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.redirect('/login');
        if (user.username !== process.env.admin) {
            return res.status(403).send("Forbidden: Admins only");
        }
        req.user = user;
        next();
    });
}

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
app.post('/signup', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }

    // Check if user already exists
    const existingUser = await User.get(username).catch(() => null);
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists. Please log in.' });
    }

    // Hash the password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Save new user
    const newUser = new User({
      username,
      passwordHash,
    });

    await newUser.save();

     res.redirect('/login');
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
app.post('/admin/generate-quiz', authenticateAdmin, async (req, res) => {
  try {
    const { topic } = req.body;

const prompt = `
You are a strict JSON generator.

Generate EXACTLY 10 MCQ questions for the topic: ${topic}.

Rules:
- Output ONLY raw JSON.
- NO code fences.
- NO backticks.
- NO explanation text.
- NO markdown.
- IDs must be numbers from 1 to 10.
- "question" must be short (max 20 words).
- "options" must contain exactly 4 short strings.
- "answer" must be an ARRAY containing ONE number (0–3), example: [2].

Output format (MATCH EXACTLY):

[
  {
    "ID": 1,
    "question": "text",
    "options": ["A", "B", "C", "D"],
    "answer": [0]
  }
]
`

const completion = await client.responses.create({
  model: "gpt-4.1-mini",
  input: prompt,
  max_tokens: 1500,
  max_output_tokens: 1500,
  temperature: 0.3,
});
    let raw = completion.output_text || "";

// Remove code fences, backticks, etc.
raw = raw.replace(/```/g, "");
raw = raw.replace(/json/gi, "");
raw = raw.replace(/\n/g, "");
raw = raw.replace(/\s+/g, " ").trim();

// Extract ONLY the JSON array using regex:
const match = raw.match(/\[.*\]/);
if (!match) throw new Error("Model did not return JSON array");

const jsonString = match[0];
const quizData = JSON.parse(jsonString);
    // DELETE OLD QUESTIONS
   const oldQuestions = await Question.scan().exec();
for (const q of oldQuestions) await q.delete();

// wait for DynamoDB to complete deletions
await new Promise(res => setTimeout(res, 1000));
    // INSERT NEW QUESTIONS
    for (const q of quizData) {
        q.id= Date.now();
      await Question.create(q);
    }

    res.json({ message: "Quiz generated and saved successfully!" });

  } catch (err) {
    console.error("Admin Generate Quiz Error:", err);
    res.status(500).json({ message: "Error generating quiz" });
  }
});
app.get('/admin-dashboard', authenticateAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
});
app.post('/admin/add-question', authenticateAdmin, async (req, res) => {
  try {
    const { question, options, answer } = req.body;

   const ID = Date.now();

    await Question.create({ ID, question, options, answer });
    res.json({ message: "Question added successfully!" });

  } catch (error) {
    console.error("Admin Add Question Error:", error);
    res.status(500).json({ message: "Error adding question" });
  }
});



app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.get(username);
    if (user && await bcrypt.compare(password, user.passwordHash)) {
      const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.cookie('token', token, { httpOnly: true });
        if (username === process.env.admin) {
      return res.redirect('/admin-dashboard');
  }
  else{
      return res.redirect('/dashboard');
  }
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Login Error:', error);
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
    const token = req.cookies.token;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const username = decoded.username;
    const questions = await Question.scan().exec();

    let score = 0;
    const positiveMarking = 1;
    const negativeMarking = 0.25;

    questions.forEach((question, index) => {
      const correctAnswers = question.answer.sort();
      const userAnswers = receivedResponses[index]?.sort() || [];
      let correctCount = 0;
      let incorrectCount = 0;

      userAnswers.forEach(answer => {
        if (correctAnswers.includes(answer)) correctCount++;
        else incorrectCount++;
      });

      if (correctCount > 0) score += (positiveMarking / correctAnswers.length) * correctCount;
      if (incorrectCount > 0) score -= (negativeMarking * correctAnswers.length) / questions.length;
    });

    await Response.update({ username }, {
      responses: receivedResponses,
      score,
      timestamp: new Date()
    });

    res.status(200).json({ message: 'Responses saved successfully', score });
  } catch (error) {
    console.error('Error saving response:', error);
    res.status(500).json({ error: 'Failed to save responses' });
  }
});

app.get('/questions', authenticateToken, async (req, res) => {
  try {
    const questions = await Question.scan().exec();
    console.log(questions)

    // Universal converter for any nested DynamoDB type
    const unwrap = (val) => {
      if (Array.isArray(val)) return val.map(unwrap);
      if (val && typeof val === 'object') {
        if ('S' in val) return val.S;
        if ('N' in val) return Number(val.N);
        // Handle array of map case: { M: { ... } }
        if ('M' in val) return unwrap(Object.values(val.M));
        // If it's just a normal object or something Dynamoose already parsed
        return Object.values(val).map(unwrap);
      }
      return val;
    };

    const formattedQuestions = questions.map((q) => ({
      ID: q.ID,
      question: q.question,
      options: unwrap(q.options) || [],
      answer: unwrap(q.answer) || [],
    }));

    res.json({ questions: formattedQuestions });
  } catch (error) {
    console.error('Error fetching questions:', error);
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const username = decoded.username;
    const existingResponse = await Response.get(username);

    res.json({ quizAttempted: !!existingResponse });
  } catch (error) {
    console.error('Error checking attempt:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/start', authenticateToken, async (req, res) => {
  try {
    const username = req.user.username;

    // Check if user already has a response record
    const userResponse = await Response.get(username).catch(() => null);

    if (userResponse) {
      // If user already attempted quiz
      res.sendFile(path.join(__dirname, 'public', 'view-result.html'));
    } else {
      // If new user, create an empty response entry
      await Response.create({
        username,
        responses: [],
        score: 0,
        timestamp: new Date(),
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
    const username = req.user.username;

    // Fetch user responses
    const userResponses = await Response.get(username);
    if (!userResponses) {
      return res.status(404).json({ message: 'No responses found for this user' });
    }

    // Fetch all questions
    const questions = await Question.scan().exec();
    const score = userResponses.score || 0;

    // Ensure both arrays are aligned
    const results = questions.map((question, index) => {
      const correctAnswers = [...(question.answer || [])].sort();
      const userAnswers = [...(userResponses.responses[index] || [])].sort();

      const isCorrect = JSON.stringify(correctAnswers) === JSON.stringify(userAnswers);

      // Marking logic
      const positiveMarking = 1;
      const negativeMarking = 0.25;
      let pointsAwarded = 0;
      let correctCount = 0;
      let incorrectCount = 0;

      userAnswers.forEach(answer => {
        if (correctAnswers.includes(answer)) correctCount++;
        else incorrectCount++;
      });

      if (correctCount > 0)
        pointsAwarded += (positiveMarking / correctAnswers.length) * correctCount;

      if (incorrectCount > 0)
        pointsAwarded -= (negativeMarking / correctAnswers.length) * incorrectCount;

      return {
        question: question.question,           // ✅ fixed
        options: question.options || [],       // ✅ fixed
        correctAnswers,
        userAnswers,
        isCorrect,
        pointsAwarded: pointsAwarded.toFixed(2)
      };
    });

    res.json({ results, score });

  } catch (error) {
    console.error('❌ Error in /view-result-data:', error);
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
