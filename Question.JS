import AWS from "aws-sdk";
import dynamoose from "dynamoose";

AWS.config.update({
  region: "us-east-1", // replace with your actual region
});

dynamoose.aws.sdk = AWS;

// Define schema (similar to your Mongoose model)
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

// Create model (like mongoose.model)
const Question = dynamoose.model("QUESTIONS", QuestionSchema);

// Define questions (same as your MongoDB version)
const questions = [
  {
    ID: 1,
    question:
      "What is the primary purpose of a feasibility study in new venture creation?",
    options: [
      "To evaluate market demand and competition",
      "To secure funding from investors",
      "To develop a business plan",
      "To hire key personnel",
    ],
    answer: [0],
  },
  {
    ID: 2,
    question:
      "Which of the following factors are critical for assessing the scalability of a new venture?",
    options: [
      "Technological innovation",
      "Market reach",
      "Brand reputation",
      "Employee satisfaction",
    ],
    answer: [0, 1],
  },
  // ... rest of your questions ...
];

// Function to insert data into DynamoDB
async function addQuestions() {
  try {
    for (const q of questions) {
      await Question.create(q);
    }
    console.log("✅ Questions added successfully to DynamoDB");
  } catch (err) {
    console.error("❌ Error inserting questions:", err);
  }
}

addQuestions();
