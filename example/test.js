var trainer = require('./../lib/index');

/********** Preparation **********/
console.log('================ Start ================');
console.log('* Time: '+trainer.timeStart.toString());

// Set data
var data = require('./data');
trainer.trainData = data.train;
trainer.testData = data.test;

// Prepare data
trainer.prepareData();

console.log('-------- Loading network --------');
trainer.loadExistingNetwork(
    trainer.brainPath+'/brain.json'
);

console.log('================ Testing ================');
trainer.test();

trainer.completed();

process.exit();
