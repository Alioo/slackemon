'use strict';

const util = require('util');
const path = require('path');
const fs = require('fs');
const SQLite = require('sqlite3').verbose();
const Bot = require('slackbots');

const PokeOfTheDay = (settings) => {
	this.settings = settings;
	this.settings.name = this.settings.name || 'slackemon';
	this.dbPath = settings.dbPath || path.resolve('slackemon.db');

	this.user = null;
	this.db = null;

};

util.inherits(PokeOfTheDay, Bot);
module.exports = PokeOfTheDay;

PokeOfTheDay.prototype.run = () => {
	PokeOfTheDay.super_.call(this, this.settings);

	this.on('start', this._onStart);
	this.on('message', this._onMessage);

};

PokeOfTheDay.prototype._onStart = () => {
    this._loadBotUser();
    this._connectDb();
    this._firstRunCheck();
};

PokeOfTheDay.prototype._loadBotUser = function () {
    var self = this;
    this.user = this.users.filter(function (user) {
        return user.name === self.name;
    })[0];
};

PokeOfTheDay.prototype._connectDb = function () {
    if (!fs.existsSync(this.dbPath)) {
        console.error('Database path ' + '"' + this.dbPath + '" does not exists or it\'s not readable.');
        process.exit(1);
    }

    this.db = new SQLite.Database(this.dbPath);
};

PokeOfTheDay.prototype._firstRunCheck = function () {
    var self = this;
    self.db.get('SELECT val FROM info WHERE name = "lastrun" LIMIT 1', function (err, record) {
        if (err) {
            return console.error('DATABASE ERROR:', err);
        }

        var currentTime = (new Date()).toJSON();

        // this is a first run
        if (!record) {
            self._welcomeMessage();
            return self.db.run('INSERT INTO info(val, name) VALUES(?, "lastrun")', currentTime);
        }

        // updates with new last running time
        self.db.run('UPDATE info SET val = ? WHERE name = "lastrun"', currentTime);
    });
};

PokeOfTheDay.prototype._welcomeMessage = function () {
    this.postMessageToChannel(this.channels[0].name, 'Ill give you a random pokemon every day!' +
        '\n I`ll give you a new pokemon everyday! just say `pokewhat` or mention' + this.name + '` to invoke me!',
        {as_user: true});
};

PokeOfTheDay.prototype._onMessage = function (message) {
    if (this._isChatMessage(message) &&
        this._isChannelConversation(message) &&
        !this._isFromSelf(message) &&
        this._isMentioningMe(message)
    ) {
        this._replyWithTodaysPokemon(message);
    }
};

PokeOfTheDay.prototype._isChatMessage = function (message) {
    return message.type === 'message' && Boolean(message.text);
};

PokeOfTheDay.prototype._isChannelConversation = function (message) {
    return typeof message.channel === 'string' &&
        message.channel[0] === 'C';
};

PokeOfTheDay.prototype._isFromSelf = function (message) {
    return message.user === this.user.id;
};

PokeOfTheDay.prototype._isMentioningMe = function (message) {
    return message.text.toLowerCase().indexOf('pokewhat') > -1 ||
        message.text.toLowerCase().indexOf(this.name) > -1;
};

PokeOfTheDay.prototype._replyWithTodaysPokemon = (originalMessage) => {
	var self = this;
	self.db.get("SELECT dex_id, name, date FROM pokemon where date = DATE('now') limit 1", function (err, record) {
		if (err) {
			return console.error('DATABASE ERROR: ', err);
		}
		var currentTime = (new Date()).toJSON();
		//create the potd
		if (!record) {
			self.db.get("SELECT dex_id, name, date FROM pokemon, RANDOM() LIMIT 1", function (err, rando) {
				var channel = self._getChannelById(originalMessage.channel);
				self.postMessageToChannel(channel.name, record.name, {as_user: true});
				self.db.run("UPDATE pokemon SET date = DATE('now')WHERE id = ?", rando.id);
			});
		}
		//get the potd
		else {
			var channel = self._getChannelById(originalMessage.channel);
			self.postMessageToChannel(channel.name, record.name, {as_user: true});
			self.db.run("UPDATE pokemon SET date = DATE('now')WHERE id = ?", record.id);
		}
	});
};

