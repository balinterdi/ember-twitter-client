var APIAdapter = Ember.Object.extend({
  apiRoot: 'http://localhost:3000',
  token: window.localStorage.token,

  initiateSession: function() {
    var newSessionURL = this.get('apiRoot') + '/session/new';
    window.location = newSessionURL;
  },

  createTweet: function(tweet) {
    //TODO: Extract all the necessary attributes
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
  profileImageUrl: Ember.computed.alias('user.profileImageUrl'),
  screenName:      Ember.computed.alias('user.screenName'),
  text: '',
  user: null,
  urls: [],
  media: [],
  retweetedBy: '', // name of the retweeter if it's a retweet

  save: function(adapter) {
    return adapter.createTweet(this);
  }
});

App.User = Ember.Object.extend({
  name: '',
  screenName: '',
  profileImageUrl: ''
});

App.Tweets = Ember.ArrayProxy.extend(Ember.SortableMixin, {
  sortProperties: ['created_at'],
  sortAscending: false,
});

App.Router.map(function() {
  this.route('token', { path: '/token/:token' });
  this.resource('user', function() {
    this.route('home');
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
    return this.transitionTo('user.home');
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
      var userController = this.controllerFor('user');
      var homeController = this.controllerFor('user.home');

      var user =  userController.get('model');
      var tweet = userController.get('newTweet');
      tweet.setProperties({
        author: user.screen_name,
        profileImageUrl: user.profile_image_url
      });
      homeController.get('tweets').unshiftObject(tweet);
      tweet.save(this.adapter);
      userController.clearTweet();
    }
  },

  beforeModel: function() {
    this.controllerFor('user').clearTweet();
  },

  model: function() {
    return this.adapter.ajax('GET', '/user.json');
  }
});

App.UserHomeRoute = App.AuthenticatedRoute.extend({
  setupController: function(controller, model) {
    var tweetsPromise = this.adapter.ajax('GET', '/twitter/timelines/home.json');
    tweetsPromise.then(function(tweets) {
      var tweetObjects = tweets.map(function(tweet) {
        var isRetweet = tweet.retweeted_status;
        var originalTweet = isRetweet ? tweet.retweeted_status : tweet;
        var user = App.User.create({
          name: originalTweet.user.name,
          screenName: originalTweet.user.screen_name,
          profileImageUrl: originalTweet.user.profile_image_url
        });

        return App.Tweet.create({
          text: originalTweet.text,
          user: user,
          urls: originalTweet.entities.urls,
          media: originalTweet.entities.media,
          retweetedBy: isRetweet ? tweet.user.name : null
        })
      });
      controller.set('tweets', tweetObjects);
    });
  }
});

App.UserTimelineRoute = App.AuthenticatedRoute.extend({
  model: function(params) {
    var route = this;
    return Ember.RSVP.Promise(function(resolve, reject) {
      //TODO: Implement the reject branch, too
      route.adapter.ajax('GET', '/twitter/users/' + params.screenName + '.json').then(function(user) {
        var userObject = App.User.create({
          name: user.name,
          screenName: user.screen_name,
          profileImageUrl: user.profile_image_url
        })
        resolve(userObject);
      })
    })
  },
  setupController: function(controller, model) {
    var tweetsPromise = this.adapter.ajax('GET', '/twitter/timelines/' + model.get('screenName') + '.json');
    //FIXME: Fix duplication between UserHomeRoute and here
    tweetsPromise.then(function(tweets) {
      var tweetObjects = tweets.map(function(tweet) {
        var isRetweet = tweet.retweeted_status;
        var originalTweet = isRetweet ? tweet.retweeted_status : tweet;
        var user = App.User.create({
          name: originalTweet.user.name,
          screenName: originalTweet.user.screen_name,
          profileImageUrl: originalTweet.user.profile_image_url
        });

        return App.Tweet.create({
          text: originalTweet.text,
          user: user,
          urls: originalTweet.entities.urls,
          media: originalTweet.entities.media,
          retweetedBy: isRetweet ? tweet.user.name : null
        })
      });
      controller.set('tweets', tweetObjects);
    });
  }
});

App.UserController = Ember.ObjectController.extend({
  newTweet: null,
  clearTweet: function() {
    this.set('newTweet', App.Tweet.create({ text: '' }));
  }

});

//TODO: We can probably remove that once user timelines work
App.UserHomeController = Ember.ObjectController.extend({
  tweets: []
});
App.UserTimelineController = Ember.ObjectController.extend({
  tweets: []
});

App.TweetController = Ember.ObjectController.extend({
  biggerProfileImage: function() {
    return this.get('profileImageUrl').replace('normal', 'bigger');
  }.property('profileImageUrl'),

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

