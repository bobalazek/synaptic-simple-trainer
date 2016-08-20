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

For a more detailed example, please view the `/example` folder.

## Todo
* documentation
* word2vec implementation
