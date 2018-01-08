var mongoose = require('mongoose');

// create task schema
var TaskSchema = new mongoose.Schema({
    sender_psid: String,
    task: String,
    dt: Date
});

var TaskModel = mongoose.model('TaskModel', TaskSchema);

module.exports = {
    TaskModel: TaskModel
}