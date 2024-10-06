const mongoose = require('mongoose');

// Define the Question model
const QuestionSchema = new mongoose.Schema({
  ID: { type: Number, required: true },
  question: { type: String, required: true },
  options: [{ type: String, required: true }],
  answer: [{ type: Number, required: true }] // Allow multiple correct answers
});

const Question = mongoose.model('QUESTIONS', QuestionSchema);

// Connect to MongoDB
mongoose.connect('mongodb+srv://kavyajain1916:K12345678@cluster0.vmxlebi.mongodb.net/QUIZ', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// Define the questions
const questions = [
  { 
    ID : 1,
    question: "What is the primary purpose of a feasibility study in new venture creation?",
    options: [
      "To evaluate market demand and competition",
      "To secure funding from investors",
      "To develop a business plan",
      "To hire key personnel"
    ],
    answer: [0] // "To evaluate market demand and competition" as the correct answer
  },
  { 
    ID : 2,
    question: "Which of the following factors are critical for assessing the scalability of a new venture?",
    options: [
      "Technological innovation",
      "Market reach",
      "Brand reputation",
      "Employee satisfaction"
    ],
    answer: [0, 1] // "Technological innovation" and "Market reach" as correct answers
  },
  { 
    ID : 3,
    question: "What is a pivot in the context of startup strategy?",
    options: [
      "A sudden increase in market demand",
      "A change in business model or product strategy",
      "A merger with a competitor",
      "A decision to cease operations"
    ],
    answer: [1] // "A change in business model or product strategy" as the correct answer
  },
  { 
    ID : 4,
    question: "Which of the following factors contribute to a sustainable competitive advantage?",
    options: [
      "Low pricing strategy",
      "Exclusive partnerships",
      "Limited customer base",
      "Short-term goals"
    ],
    answer: [1] // "Exclusive partnerships" as the correct answer
  },
  { 
    ID : 5,
    question: "What is the significance of a unique selling proposition (USP) for a new venture?",
    options: [
      "To attract potential employees",
      "To differentiate from competitors and attract customers",
      "To secure government grants",
      "To minimize operational costs"
    ],
    answer: [1] // "To differentiate from competitors and attract customers" as the correct answer
  },
  { 
    ID : 6,
    question: "Which of the following stages in the entrepreneurial process involves creating a prototype or minimum viable product (MVP)?",
    options: [
      "Idea generation",
      "Business planning",
      "Market entry",
      "Product development"
    ],
    answer: [3] // "Product development" as the correct answer
  },
  { 
    ID : 7,
    question: "What is the role of intellectual property (IP) rights in protecting a new venture's innovations?",
    options: [
      "To increase production efficiency",
      "To secure government subsidies",
      "To prevent competitors from copying unique ideas or inventions",
      "To ensure workplace safety"
    ],
    answer: [2] // "To prevent competitors from copying unique ideas or inventions" as the correct answer
  },
  { 
    ID : 8,
    question: "Which of the following metrics is commonly used to measure customer acquisition cost (CAC) for a new venture?",
    options: [
      "Total revenue",
      "Social media followers",
      "Marketing expenses divided by number of new customers",
      "Employee turnover rate"
    ],
    answer: [2] // "Marketing expenses divided by number of new customers" as the correct answer
  },
  { 
    ID : 9,
    question: "What is the significance of a lean startup approach in new venture creation?",
    options: [
      "To minimize employee turnover",
      "To reduce time and resources spent on product development",
      "To maximize profit margins",
      "To expand market reach globally"
    ],
    answer: [1] // "To reduce time and resources spent on product development" as the correct answer
  },
  { 
    ID : 10,
    question: "Which of the following strategies can help new ventures mitigate risks associated with market uncertainty?",
    options: [
      "Diversifying product offerings",
      "Increasing fixed costs",
      "Ignoring customer feedback",
      "Relying solely on intuition"
    ],
    answer: [0] // "Diversifying product offerings" as the correct answer
  }
];

// Insert the questions into the database
const addQuestions = async () => {
  try {
    await Question.insertMany(questions);
    console.log('Questions added successfully');
  } catch (err) {
    console.log(err);
  } finally {
    mongoose.connection.close();
  }
};

addQuestions();