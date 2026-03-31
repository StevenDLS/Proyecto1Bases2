const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');

const evaluationSchema = new mongoose.Schema({
  evaluationId: { type: String, required: true, unique: true },
  courseId: { type: String, required: true },
  title: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  questions: [{
    questionId: String,
    text: String,
    options: [{ optionId: String, text: String, isCorrect: Boolean }]
  }],
  createdAt: { type: Date, default: Date.now }
});

const resultSchema = new mongoose.Schema({
  evaluationId: { type: String, required: true },
  studentId: { type: String, required: true },
  courseId: { type: String, required: true },
  answers: [{ questionId: String, selectedOptionId: String }],
  score: Number,
  correctCount: Number,
  totalQuestions: Number,
  submittedAt: { type: Date, default: Date.now }
});
resultSchema.index({ evaluationId: 1, studentId: 1 }, { unique: true });

const Evaluation = mongoose.models.Evaluation ||
  mongoose.model('Evaluation', evaluationSchema, 'evaluations');
const EvaluationResult = mongoose.models.EvaluationResult ||
  mongoose.model('EvaluationResult', resultSchema, 'evaluation_results');

const createEvaluation = async (data, courseId) => {
  const evaluationId = uuidv4();
  const questions = (data.questions || []).map(q => ({
    questionId: uuidv4(),
    text: q.text,
    options: (q.options || []).map(o => ({
      optionId: uuidv4(),
      text: o.text,
      isCorrect: !!o.isCorrect
    }))
  }));
  const evaluation = await Evaluation.create({
    evaluationId, courseId, title: data.title,
    startDate: new Date(data.startDate), endDate: new Date(data.endDate),
    questions
  });
  return evaluation.toObject();
};

const getEvaluationsByCourse = async (courseId) => {
  return Evaluation.find({ courseId }).select('-questions.options.isCorrect').lean();
};

const getEvaluationById = async (evaluationId, includeAnswers = false) => {
  const query = Evaluation.findOne({ evaluationId });
  if (!includeAnswers) query.select('-questions.options.isCorrect');
  return query.lean();
};

const submitEvaluation = async (evaluationId, studentId, answers, courseId) => {
  const existing = await EvaluationResult.findOne({ evaluationId, studentId });
  if (existing) {
    const err = new Error('Ya enviaste esta evaluación');
    err.status = 409;
    throw err;
  }

  const evaluation = await Evaluation.findOne({ evaluationId }).lean();
  if (!evaluation) {
    const err = new Error('Evaluación no encontrada');
    err.status = 404;
    throw err;
  }

  const now = new Date();
  if (now < evaluation.startDate || now > evaluation.endDate) {
    const err = new Error('La evaluación no está disponible en este momento');
    err.status = 400;
    throw err;
  }

  let correctCount = 0;
  const totalQuestions = evaluation.questions.length;

  for (const question of evaluation.questions) {
    const answer = answers.find(a => a.questionId === question.questionId);
    if (!answer) continue;
    const correctOption = question.options.find(o => o.isCorrect);
    if (correctOption && answer.selectedOptionId === correctOption.optionId) {
      correctCount++;
    }
  }

  const score = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

  const result = await EvaluationResult.create({
    evaluationId, studentId,
    courseId: courseId || evaluation.courseId,
    answers, score, correctCount, totalQuestions
  });
  return result.toObject();
};

const getStudentResults = async (studentId, courseId) => {
  return EvaluationResult.find({ studentId, courseId }).lean();
};

const getAllResultsByCourse = async (courseId) => {
  return EvaluationResult.find({ courseId }).lean();
};

module.exports = {
  createEvaluation, getEvaluationsByCourse, getEvaluationById,
  submitEvaluation, getStudentResults, getAllResultsByCourse
};
