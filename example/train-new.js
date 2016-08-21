var trainer = require('./../lib/index');

/********** Preparation **********/
console.log('================ Start ================');
console.log('* Time: '+trainer.timeStart.toString());

// Set data
var data = require('./data');
trainer.trainData = data.train_new;
trainer.testData = data.test;
trainer.continuousTraining = true;

// Prepare data
trainer.prepareData();

if (trainer.bagOfWordsModel) {
    trainer.run(function() {
        process.exit();
    });
} else {
    trainer.prepareWord2VecModel(function() {
        trainer.run(function() {
            process.exit();
        });
    });
}
