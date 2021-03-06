var APIAdapter = Ember.Object.extend({
  apiRoot: 'http://localhost:3000',
  token: window.localStorage.token,

  initiateSession: function() {
    var newSessionURL = this.get('apiRoot') + '/session/new';
    window.location = newSessionURL;
  },

  createTweet: function(tweet) {
    this.ajax('POST', '/twitter/tweets.json', tweet.getProperties('text'));
  },

  ajax: function(type, path, payload) {
    return Ember.$.ajax(this.get('apiRoot') + path, {
      type: type,
      headers: { 'X-OAuth-Token': this.get('token') },
      data: (payload || {})
    })
  }
});

window.App = Ember.Application.create({
  ready: function() {
    this.register('main:adapter', APIAdapter);
    this.inject('route', 'adapter', 'main:adapter');
  }
});

App.Token = Ember.Object.extend({
  token: null
});

App.Tweet = Ember.Object.extend({
  text: '',
  user: null,
  urls: [],
  media: [],
  originalTweet: null,
  screenName: Ember.computed.alias('user.screenName'),
  profileImageUrl: Ember.computed.alias('user.profileImageUrl'),
  author: Ember.computed.any('originalTweet.user', 'user'),
  authorName: Ember.computed.alias('author.name'),
  authorProfileImageUrl: Ember.computed.alias('author.profileImageUrl'),

  isRetweet: function() {
    return !Ember.isNone(this.get('originalTweet'));
  }.property('originalTweet'),

  retweetedBy: function() {
    if (this.get('originalTweet')) {
      return this.get('user.name');
    }
  }.property('originalTweet', 'user.name'),

  save: function(adapter) {
    return adapter.createTweet(this);
  },

});

App.Tweet.reopenClass({
  createFromResponse: function(tweet, user, originalTweet) {
    return App.Tweet.create({
      text: tweet.text,
      user: user,
      urls: tweet.entities.urls,
      media: tweet.entities.media,
      originalTweet: originalTweet
    })
  }
});

App.User = Ember.Object.extend({
  name: '',
  screenName: '',
  profileImageUrl: '',
  statusesCount: '',
  friendsCount: '',
  followersCount: ''
});

App.User.reopenClass({
  createFromResponse: function(user) {
    return App.User.create({
      name: user.name,
      screenName: user.screen_name,
      profileImageUrl: user.profile_image_url,
      statusesCount: user.statuses_count,
      friendsCount: user.friends_count,
      followersCount: user.followers_count
    })
  }
});


App.Router.map(function() {
  this.route('token', { path: '/token/:token' });
  this.resource('user', function() {
    this.route('timeline', { path: '/timelines/:screenName' });
  })
});

App.AuthenticatedRoute = Ember.Route.extend({
  beforeModel: function() {
    if (!this.adapter.get('token')) {
      this.adapter.initiateSession();
    }
  }
});

App.IndexRoute = Ember.Route.extend({
  beforeModel: function(transition) {
    return this.transitionTo('user.index');
  }
});

App.TokenRoute = Ember.Route.extend({
  model: function(params) {
    var token = params.token;
    window.localStorage.token = token;
    this.adapter.set('token', token);
    return token;
  },
  afterModel: function(model, transition) {
    this.transitionTo('index');
  }
});

App.UserRoute = App.AuthenticatedRoute.extend({
  actions: {
    sendTweet: function() {
      var user =  this.controller.get('model');
      var tweet = this.controller.get('newTweet');
      tweet.setProperties({ user: user });

      var userIndexController = this.controllerFor('user.index');
      userIndexController.get('tweets').unshiftObject(tweet);
      tweet.save(this.adapter);
      this.controller.clearTweet();
    }
  },

  model: function() {
    var route = this;
    return Ember.RSVP.Promise(function(resolve, reject) {
      route.adapter.ajax('GET', '/user.json').then(function(user) {
        var userObject = App.User.createFromResponse(user);
        resolve(userObject);
      });
    })
  }
});

App.UserIndexRoute = App.AuthenticatedRoute.extend({
  setupController: function(controller, model) {
    var tweetsPromise = this.adapter.ajax('GET', '/twitter/timelines/home.json');
    controller.setTweets(tweetsPromise);
  }
});

App.UserTimelineRoute = App.AuthenticatedRoute.extend({
  model: function(params) {
    var route = this;
    return Ember.RSVP.Promise(function(resolve, reject) {
      route.adapter.ajax('GET', '/twitter/users/' + params.screenName + '.json').then(function(user) {
        var userObject = App.User.createFromResponse(user);
        resolve(userObject);
      })
    })
  },
  setupController: function(controller, model) {
    var tweetsPromise = this.adapter.ajax('GET', '/twitter/timelines/' + model.get('screenName') + '.json');
    controller.setTweets(tweetsPromise);
  }
});

App.UserController = Ember.ObjectController.extend({
  newTweet: null,
  clearTweet: function() {
    this.set('newTweet', App.Tweet.create({ text: '' }));
  }

});

App.TimelineController = Ember.Mixin.create({
  showRetweets: true,
  filteredTweets: function() {
    var tweets = this.get('tweets');
    if (!this.get('showRetweets')) {
      tweets = tweets.filterProperty('isRetweet', false);
    }
    return tweets;
  }.property('showRetweets', 'tweets.@each'),

  setTweets: function(promise) {
    var controller = this;
    promise.then(function(tweets) {
      var tweetObjects = tweets.map(function(tweet) {
        var originalTweet, originalUser,
            isRetweet = tweet.retweeted_status;
        if (isRetweet) {
          originalUser  = App.User.createFromResponse(tweet.retweeted_status.user);
          originalTweet = App.Tweet.createFromResponse(tweet.retweeted_status, originalUser);
        }
        var user = App.User.createFromResponse(tweet.user);
        return App.Tweet.createFromResponse(tweet, user, originalTweet);
      });
      controller.set('tweets', tweetObjects);
    });
  }
});

App.UserIndexController = Ember.ObjectController.extend(App.TimelineController, {
  tweets: []
});
App.UserTimelineController = Ember.ObjectController.extend(App.TimelineController, {
  tweets: []
});

App.TweetController = Ember.ObjectController.extend({
  biggerProfileImage: function() {
    return this.get('authorProfileImageUrl').replace('normal', 'bigger');
  }.property('authorProfileImageUrl'),

  retweetedLine: function() {
    if (this.get('retweetedBy')) {
      return "Retweeted by " + this.get('retweetedBy');
    }
  }.property('retweetedBy'),

  parsedText: function() {
    var makeUrl = function(text, urlData) {
      var start = urlData.indices[0];
      var end   = urlData.indices[1];
      return '<a href="' + urlData.expanded_url + '">' + urlData.display_url + '</a>';
    }

    var outText = '';
    var text  = this.get('text');

    var urls =  this.get('urls').concat(this.get('media') || []);
    var pos = 0;
    for (var i=0, url; i < urls.length; i++) {
      url = urls[i];
      outText += text.slice(pos, url.indices[0]);
      outText += makeUrl(text, url);
      pos = url.indices[1];
    }
    outText += text.slice(pos, text.length);

    outText = outText.replace(/\n/g, '<br />');
    return new Handlebars.SafeString(outText);

  }.property('text', 'urls.@each', 'media.@each')
});

