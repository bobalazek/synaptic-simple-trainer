var fs = require('fs');
var moment = require('moment');
var synaptic = require('synaptic');
var w2v = require('word2vec');
var natural = require('natural');
var stopwords = require('natural/lib/natural/util/stopwords');
var mkdirp = require('mkdirp');
var helpers = require('./helpers');

var SynapticSimpleTrainer = {
    log: true,
    doTextNormalization: true,
    doTextNormalizationStemming: false, // in the normalization step, if we should also do stemming?
    doTests: true, // should we do the tests while training?
    doTestsEvery: 10, // after how many iterations should we do a test?
    doTemporarySaveEvery: 10, // after how many iterations we should do a temporary save?
    includeStemmedWords: false, // will include the stemmed words, in addition to the normal words (in the train set)
    removeStopWords: false, // should we remove the stop words like: am, am, and, for, each, ...
    continuousTraining: false, // should we use the existing brain and continue add new data?
    bagOfWordsModel: true, // true: bag of words; false: word2vec mode (experimental!)
    maxHiddenLayers: -1, // some training may too long otherweise. Set -1 for unlimited
    brainPath: 'brain/', // the path where all the data will be saved
    timeStart: new Date(),
    timeEnd: null,
    trainData: [], // [{ text: 'some text', class: 'some-cat' }]
    testData: [], // [{ text: 'some text', class: 'some-cat' }]
    trainingSet: [], // the actual training set that will be used for the training
    texts: [], // all the unique texts
    words: {}, // all the unique words
    wordsDictionary: {}, // the dictionary of words: { 'some word': numberOfApperances }
    classes: [], // all the unique classes / categories
    classesDictionary: {},  // the dictionary of words: { 'some-cat': numberOfApperances }
    inputLayers: 0,
    outputLayers: 0,
    hiddenLayers: 0,
    network: null,
    networkData: {},
    trainer: null,
    trainerOptions: {
        rate: [
            .08,
            .04,
            .02, .02,
            .01, .01,
            .005, .005,
            .0025, .0025,
            .00125, .00125, .00125,
            .000625, .000625, .000625,
        ],
        iterations: 2048,
        error: .01,
        shuffle: true,
        cost: synaptic.Trainer.cost.CROSS_ENTROPY,
    },
    // word2vec stuff
    word2VecInputTextFile: null,
    word2VecPhrasesTextFile: null,
    word2VecVectorsTextFile: null,
    word2VecModel: null,
    word2VecModelOptions: {
        size: 256,
        silent: true,
        debug: 0,
    },
    prepareData: function() {
        if (this.log) {
            console.log('-------- Preparing data started --------');
        }

        /********** Train data **********/
        if (!this.trainData.length) {
            throw new Error(
                'Train data not found.'
            );
        }

        if (this.log) {
            console.log('---- Preparing train data ----');
        }

        var trainDataPrepared = false;
        if (this.continuousTraining) {
            var brainPath = this.brainPath+'/brain.json';
            var brainMetadataPath = this.brainPath+'/brain-metadata.json';
            var ifFileExists = helpers.fileExists(brainPath) && helpers.fileExists(brainMetadataPath);
            
            if (!ifFileExists) {
                throw new Error(
                    'No network found. Please train your network first, before you can use continuous training.'
                );
            }
            
            this.prepareTrainData();

            var brainMetadata = JSON.parse(fs.readFileSync(brainMetadataPath));

            /*** Check for duplicated texts ***/
            var duplicatedTexts = [];
            for (var i in this.texts) {
                if (brainMetadata.texts.indexOf(this.texts[i]) !== -1) {
                    duplicatedTexts.push(this.texts[i]);
                }
            }
            var args = process.argv.slice(2);
            if (
                duplicatedTexts.length &&
                args.indexOf('-f') === -1
            ) {
                console.log('We have found some duplicated texts in your new training set.');
                console.log('Are you sure, you want to continue the training?');
                console.log('If so, please append the "-f" flag, at the end of your command.');
                console.log('Duplicated texts:');
                for (var i in duplicatedTexts) {
                    console.log('* '+duplicatedTexts[i]);
                }

                process.exit();
            }

            /*** Check if the networks are compatible ***/
            var newTrainData = this.trainData;
            var trainData = brainMetadata.train_data.concat(newTrainData);

            this.trainData = trainData;
            this.prepareTrainData();

            if (!this.isSameNetwork()) {
                console.log('Seems that there are some new words / classes in your new training set.');
                console.log('In this case you can not use continuous training.');
                process.exit();
            }

            trainDataPrepared = true;
        }

        if (!trainDataPrepared) {
            this.prepareTrainData();
        }

        // Right trim the brain path
        this.brainPath = helpers.trimRight(this.brainPath, '/');

        if (this.log) {
            console.log('-------- Preparing data completed --------');
        }

        return this;
    },
    prepareTrainData: function() {
        var tmp = [];
        var i = 0;
        while (true) {
            var object = this.trainData[i];
            var text = object.text;
            var textClass = object.class;

            if (this.doTextNormalization) {
                text = this.normalize(text)
            }

            if (this.removeStopWords) {
                var newText = '';
                var textWords = text.split(' ');
                for(var j in textWords) {
                    if (stopwords.words.indexOf(textWords[j]) === -1) {
                        newText += textWords[j] + ' ';
                    }
                }
                text = newText.trim();
            }

            if (this.includeStemmedWords) {
                var stemmedText = natural.PorterStemmer.stem(text);

                // Only include, if such a text isn't already added.
                if (this.texts.indexOf(stemmedText) === -1) {
                    this.trainData.push({
                        text: stemmedText,
                        class: textClass,
                    });
                }
            }

            this.texts.push(text);
            if (this.classes.indexOf(textClass) === -1) {
                this.classes.push(textClass);
            }

            tmp.push({
                text: text,
                class: textClass,
            });

            i++;

            var trainDataLength = this.trainData.length;
            if (i >= trainDataLength) {
                break;
            }
        }
        this.trainData = tmp;

        // Preparations
        this.wordsDictionary = helpers.arrayToDictonary(this.texts);
        this.words = helpers.objectKeys(this.wordsDictionary);
        this.classesDictionary = helpers.arrayToDictonary(this.classes);
        for (var i in this.trainData) {
            var object = this.trainData[i];
            var text = object.text;
            var textClass = object.class;

            this.trainingSet.push({
                input: helpers.textToVector(text, this.wordsDictionary),
                output: helpers.textToVector(textClass, this.classesDictionary),
            });
        }

        this.inputLayers = this.words.length;
        this.outputLayers = this.classes.length;
        this.hiddenLayers = parseInt(Math.sqrt(this.inputLayers * this.outputLayers));

        if (
            this.maxHiddenLayers > 0 &&
            this.hiddenLayers > this.maxHiddenLayers
        ) {
            this.hiddenLayers = this.maxHiddenLayers;
        }
    },
    prepareWord2VecModel: function(cb) {
        if (this.log) {
            console.log('-------- Preparing word2vec model started --------');
        }

        var self = this;
        this.word2VecInputTextFile = this.brainPath+'/input.txt';
        this.word2VecPhrasesTextFile = this.brainPath+'/phrases.txt';
        this.word2VecVectorsTextFile = this.brainPath+'/vectors.txt';

        var inputText = '';
        for (var i in this.trainData) {
            inputText += this.trainData[i].text + "\n";
        }

        // Prepare input
        function prepareInput(callback) {
            fs.writeFileSync(
                self.word2VecInputTextFile,
                inputText
            );

            if (callback) {
                callback();
            }
        }

        // Prepare phrases
        function preparePhrases(callback) {
            w2v.word2phrase(
                self.word2VecInputTextFile,
                self.word2VecPhrasesTextFile,
                {
                    silent: true,
                    debug: 0,
                },
                function() {
                    if (self.log) {
                        console.log('---- Phrases prepared ----');
                    }

                    if (callback) {
                        callback();
                    }
                }
            );
        }

        // Prepare vectors
        function prepareVectors(callback) {
            w2v.word2vec(
                self.word2VecPhrasesTextFile,
                self.word2VecVectorsTextFile,
                self.word2VecModelOptions,
                function() {
                    if (self.log) {
                        console.log('---- Vectors prepared ----');
                    }

                    if (callback) {
                        callback();
                    }
                }
            );
        }

        // Load model
        function loadModel(callback) {
            w2v.loadModel(
                self.word2VecVectorsTextFile,
                function(err, model) {
                    if (self.log) {
                        console.log('---- Vectors model loaded ----');
                    }

                    if (callback) {
                        callback(err, model);
                    }
                }
            );
        }

        // Run
        prepareInput(function() {
            preparePhrases(function() {
                prepareVectors(function() {
                    loadModel(function(err, model) {
                        self.word2VecModel = model;
                        self.prepareWord2VecData();

                        if (cb) {
                            cb();
                        }
                    });
                });
            });
        });

        if (this.log) {
            console.log('-------- Preparing word2vec model completed --------');
        }
    },
    prepareWord2VecData: function() {
        this.inputLayers = this.word2VecModelOptions.size;
        this.trainingSet = [];
        var min = -1;
        var max = 1;

        for (var i in this.trainData) {
            var object = this.trainData[i];
            var text = object.text;
            var textClass = object.class;

            var input = new Array(this.inputLayers).fill(0);

            var sentenceWords = text.split(' ');
            for (var i in sentenceWords) {
                var sentenceWord = sentenceWords[i];
                var sentenceWordVector = this.word2VecModel.getVector(sentenceWord);

                // sum together the sentence
                if (sentenceWordVector) {
                    for (var j in sentenceWordVector.values) {
                        // normalizes the values, because word2vec returns values
                        // between -1 and 1 and in this case we need 0 to 1.
                        input[j] = (
                            (input[j] - min) /
                            (max - min)
                        );

                        input[j] += sentenceWordVector.values[j];
                    }
                }
            }

            for (var i in input) {
                // todo: not sure how to fix, if that is the correct way,
                // for the values, that are above the range.
                if (input[i] < 0) {
                    input[i] = 0;
                } else if (input[i] > 1) {
                    input[i] = 1;
                }
            }

            this.trainingSet.push({
                input: input,
                output: helpers.textToVector(textClass, this.classesDictionary, true),
            });
        }

        return this;
    },
    prepareNetworkAndTrainer: function() {
        if (this.log) {
            console.log('-------- Preparing network and trainer started --------');
        }

        var ifHasSameData = this.isSameNetwork(true);

        if (ifHasSameData) {
            if (this.log) {
                console.log('----- Loading existing network ----');
            }

            this.loadExistingNetwork();
        } else {
            if (this.log) {
                console.log('---- Creating new network ----');
            }

            this.network = new synaptic.Architect.Perceptron(
                this.inputLayers,
                this.hiddenLayers,
                this.outputLayers
            );
            this.network.setOptimize(true);
        }

        this.trainer = new synaptic.Trainer(this.network);

        var quantity = synaptic.Neuron.quantity();

        if (this.log) {
            console.log('---- Network info ----');
            console.log('* type: '+(this.bagOfWordsModel ? 'bag of words' : 'word2vec'));
            console.log('* input layers / words: '+this.inputLayers);
            console.log('* hidden layers: '+this.hiddenLayers);
            console.log('* output layers / classes: '+this.outputLayers);
            console.log('* neurons: '+quantity.neurons);
            console.log('* connections: '+quantity.connections);

            console.log('-------- Preparing network and trainer completed --------');
        }

        return this;
    },
    /**
     * @param temporary is we should check for the temporary brain, or the production one?
     */
    isSameNetwork: function(temporary) {
        var path = this.brainPath+'/brain'+(temporary ? '-tmp' : '')+'.json';
        var pathMetadata = this.brainPath+'/brain-'+(temporary ? '-tmp' : '')+'metadata.json';
        var ifFileExists = helpers.fileExists(path) && helpers.fileExists(pathMetadata);

        if (ifFileExists) {
            var networkMetadata = JSON.parse(fs.readFileSync(pathMetadata));

            if (
                helpers.arrayEquals(
                    networkMetadata.words,
                    this.words
                ) &&
                helpers.arrayEquals(
                    networkMetadata.classes,
                    this.classes
                ) &&
                networkMetadata.input_layers === this.inputLayers &&
                networkMetadata.hidden_layers === this.hiddenLayers &&
                networkMetadata.output_layers === this.outputLayers
            ) {
                return true;
            }
        }

        return false;
    },
    loadExistingNetwork: function(path) {
        if (!path) {
            path = this.brainPath+'/brain-tmp.json';
        }

        if (!helpers.fileExists(path)) {
            throw new Error(
                'No network has been found (path: '+path+').'
            );
        }

        var networkData = JSON.parse(fs.readFileSync(path));

        return this.network = synaptic.Network.fromJSON(networkData);
    },
    startTraining: function() {
        if (this.log) {
            console.log('-------- Training started --------');
        }

        var self = this;

        this.networkData.iterations = 0;
        this.networkData.error = 0;
        this.networkData.timeIterationStart = (new Date()).getTime();

        this.trainerOptions.schedule = {
            every: 1,
            do: function(data) {
                self.scheduleCallback(data, self);
            },
        };

        var trainerResults = this.trainer.train(
            this.trainingSet,
            this.trainerOptions
        );

        if (this.log) {
            console.log('-------- Training completed --------');
        }

        return trainerResults;
    },
    scheduleCallback: function(data, self) {
        var timeNow = (new Date()).getTime();
        var timeIterationElapsedSeconds = (timeNow - self.networkData.timeIterationStart) / 1000;
        var timeSinceStartElapsed = timeNow - self.timeStart;

        if (self.log) {
            console.log(
                data.iterations+'. iteration; '+
                'Rate: '+data.rate+'; '+
                'Error: '+data.error+'; '+
                'Time: '+timeIterationElapsedSeconds+' seconds; '+
                'Total: '+moment.utc(timeSinceStartElapsed).format('HH:mm:ss')
            );
            console.log('----------------');
        }

        self.networkData.timeIterationStart = (new Date()).getTime();
        self.networkData.iterations = data.iterations;
        self.networkData.error = data.error;

        if (
            self.doTests &&
            self.doTestsEvery > 0 &&
            data.iterations % self.doTestsEvery === 0
        ) {
            // Test
            if (self.log) {
                self.log = false;
                var testResults = self.test(true);
                console.log('Test results:');
                console.log(testResults);
                self.log = true;
            }
        }

        if (
            self.doTemporarySaveEvery > 0 &&
            data.iterations % self.doTemporarySaveEvery === 0
        ) {
            self.doTemporarySave(data);
        }
    },
    getTopClassesByText: function(text, count) {
        var count = count || 3;

        if (this.doTextNormalization) {
            text = this.normalize(text);
        }

        var matchingClasses = this.network.activate(
            helpers.textToVector(text, this.wordsDictionary)
        );

        return helpers.objectSlice(
            helpers.objectReverse(helpers.objectSort(helpers.classesByValues(
                this.classes,
                matchingClasses
            ))),
            0,
            count-1
        );
    },
    doTemporarySave: function(data) {
        if (this.log) {
            console.log('-------- Doing temporary save --------');
        }

        mkdirp(this.brainPath);

        fs.writeFileSync(
            this.brainPath+'/brain-tmp.json',
            JSON.stringify(this.network.toJSON())
        );
        fs.writeFileSync(
            this.brainPath+'/brain-tmp-metadata.json',
            JSON.stringify({
                iterations: data.iterations,
                error: data.error,
                time_start: this.timeStart,
                time: new Date(), // when it was saved
                words: this.words,
                classes: this.classes,
                texts: this.texts,
                train_data: this.trainData,
                input_layers: this.inputLayers,
                hidden_layers: this.hiddenLayers,
                output_layers: this.outputLayers,
            })
        );

        if (this.log) {
            console.log('-------- Temporary save completed --------');
        }
    },
    saveNetwork: function() {
        if (this.log) {
            console.log('-------- Saving network --------');
        }

        fs.writeFileSync(
            this.brainPath+'/brain.json',
            JSON.stringify(this.network.toJSON())
        );
        fs.writeFileSync(
            this.brainPath+'/brain-metadata.json',
            JSON.stringify({
                iterations: this.networkData.iterations,
                error: this.networkData.error,
                time_start: this.timeStart,
                time: new Date(), // when it was saved
                words: this.words,
                classes: this.classes,
                texts: this.texts,
                train_data: this.trainData,
                input_layers: this.inputLayers,
                hidden_layers: this.hiddenLayers,
                output_layers: this.outputLayers,
            })
        );

        if (this.log) {
            console.log('-------- Saving network completed --------');
        }

        return this;
    },
    cleanup: function() {
        if (this.log) {
            console.log('-------- Cleanup started --------');
        }

        // Cleanup - remove the temporary network and temporary network metadata
        var path = this.brainPath+'/brain-tmp.json';
        if (helpers.fileExists(path)) {
            fs.unlinkSync(path);
        }

        var path = this.brainPath+'/brain-tmp-metadata.json';
        if (helpers.fileExists(path)) {
            fs.unlinkSync(path);
        }

        if (this.log) {
            console.log('-------- Cleanup completed --------');
        }

        return this;
    },
    run: function(callback) {
        console.log('================ Training ================');
        this.prepareNetworkAndTrainer();
        this.startTraining();
        this.saveNetwork();
        this.cleanup();
        this.completed();

        if (callback) {
            callback();
        }
    },
    completed: function() {
        this.timeEnd = new Date();

        console.log('================ Completed ================');
        console.log('* Time: '+this.timeEnd.toString());
        console.log('* Elapsed: '+moment.utc(this.timeEnd.getTime() - this.timeStart.getTime()).format('HH:mm:ss'));
    },
    /**
     * @param ignoreSameNetworkCheck You can disable that, in case you know the network won't be the same (for example, when the network is learning, this should be disabled, because the old network will never be the same as the current / temporary one)
     */
    test: function(ignoreSameNetworkCheck) {
        if (!this.testData.length) {
            throw new Error(
                'Test data not found.'
            );
        }

        var totalCount = this.testData.length;

        if (this.log) {
            console.log('---- Test data info ----')
            console.log('* Total: '+totalCount);
            console.log('----------------');
        }

        if (
            !ignoreSameNetworkCheck &&
            !this.isSameNetwork()
        ) {
            throw new Error(
                '* The current network configuration is not compatible with the last once trained. '+
                'Please train the network again, to get the accurate results.'
            );
        }

        var successCount = 0;
        for (var i in this.testData) {
            var object = this.testData[i];
            var text = object.text;
            var classes = typeof object.classes !== 'undefined'
                ? object.classes
                : []
            ;
            var textClass = typeof object.class !== 'undefined'
                ? object.class
                : false
            ;

            if (textClass) {
                classes.push(textClass);
            }

            var topClasses = this.getTopClassesByText(text);
            for (var j in classes) {
                var textClass = classes[j];
                var isDefined = typeof topClasses[textClass] != 'undefined';
                if (isDefined) {
                    successCount++;
                    break;
                }
            }

            if (this.log) {
                console.log('Text: '+text);
                console.log('Classes: '+classes.join(', '));
                console.log('Top classes: ');
                console.log(topClasses);
                console.log('----');
            }
        }

        var failedCount = totalCount - successCount;
        var successPercentage = 0;
        if (successCount !== 0) {
            var successPercentage = Math.ceil((successCount / totalCount) * 100);
        }

        if (this.log) {
            console.log('-------- Results --------');
            console.log('* Total: '+totalCount);
            console.log('* Success: '+successCount);
            console.log('* Failed: '+failedCount);
            console.log('* Success percentage: '+successPercentage+'%');
        }

        return {
            total_count: totalCount,
            success_count: successCount,
            failed_count: failedCount,
            success_percentage: successPercentage,
        };
    },
    normalize: function(text) {
        text = text
            .toLowerCase()
            .replace(/\W'+/g, ' ')
            .replace(/\s\s+/g, ' ')
            .trim()
        ;

        if (this.doTextNormalizationStemming) {
            text = natural.PorterStemmer.stem(text);
        }

        return text;
    }
}

module.exports = SynapticSimpleTrainer;
