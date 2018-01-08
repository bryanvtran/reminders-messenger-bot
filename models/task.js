var mongoose = require('mongoose');

// create task schema
var TaskSchema = new mongoose.Schema({
    sender_psid: String,
    task: String,
    dt: Date
});

var Task = mongoose.model('Task', TaskSchema);

module.exports = {
    Task: Task
}