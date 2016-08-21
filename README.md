# Synaptic Simple Trainer
A ready to go text classification trainer based on synaptic


## Installation
```cmd
npm install synaptic-simple-trainer --save
```


## How to use
### data.js
```js
var data = {
    train: [
        {
            text: 'that was a very good movie',
            class: 'positive',
        },
        {
            text: 'this was a great movie',
            class: 'positive',
        },
        {
            text: 'the movie was awesome',
            class: 'positive',
        },
        {
            text: 'I absolutely loved the movie',
            class: 'positive',
        },
        {
            text: 'the movie was pretty bad',
            class: 'positive',
        },
    ],
    test: [
        {
            text: 'it was a good movie',
            class: 'positive',
        },
        {
            text: 'it was bad',
            class: 'negative',
        },
    ],
};

module.exports = data;
```

### train.js
```js
var trainer = require('synaptic-simple-trainer');
var data = require('./data');

trainer.trainData = data.train;
trainer.testData = data.test;

trainer.prepareData();
trainer.run(function() {
    process.exit();
});
```

### test.js
```js
var trainer = require('synaptic-simple-trainer');
var data = require('./data');

trainer.trainData = data.train;
trainer.testData = data.test;

trainer.test();
trainer.completed();

process.exit();

```

Once everything is ready, just run `node example/train.js`. After it's run at least once, you'll be able to test it with `node example/test.js`, because the brain (network) was saved, and will be reused.

For a more detailed example, please view the `/example` folder.

Note: If you add new words / classes to your trainData (trainingSet), you will need to re-train the network again! In case you have a larger training set, you may not need to re-train (but only, if all the existing words / classes already exist)!


## Changelog
### 0.2.0
* Added removeStopWords option
* Readme updates
* Added example of continuous training
* Added continuousTraining option

### 0.1.0
* Initial release


## Todo
* documentation
* word2vec implementation


## License
Synaptic Simple Trainer is licensed under the MIT license.
