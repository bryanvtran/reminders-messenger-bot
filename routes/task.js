var TaskModel = require("../models/task").TaskModel;

exports.create = function(req, res) {
    let body = req.body;
    let psid = body.psid;
    let task = body.task;
    let dt = new Date();

    if (!psid || !task || !dt) {
        return res.status(200).send({ status: 'fail', msg: 'All fields are required' });
    }

    // Create an instance of model
    var task_instance = new TaskModel({ 
        sender_psid: psid,
        task: task,
        dt: dt
    });

    // Save the new model instance, passing a callback
    task_instance.save(function (err) {
        if (err) { return res.status(200).send({ status: 'fail' }); }

        // saved!
        console.log('Saved!');
        return res.status(200).send({ status: 'success' });
    });
}

exports.getAll = function(req, res) {
    TaskModel.find(function (err, tasks) {
        if (err) return console.error(err);
        res.send(tasks);
    });
}

exports.get = function(req, res) {
    let psid = req.query['psid'];
    if (!psid) {
        return res.status(200).send({ status: 'fail', msg: 'PSID is required.' });
    }

    TaskModel.find({ sender_psid: psid }, function (err, tasks) {
        if (err) return console.error(err);
        res.send(tasks);
    });
}