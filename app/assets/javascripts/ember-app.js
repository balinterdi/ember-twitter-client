var APIAdapter = Ember.Object.extend({
  apiRoot: 'http://localhost:3000',
  token: window.localStorage.token,

  initiateSession: function() {
    var newSessionURL = this.get('apiRoot') + '/session/new';
    window.location = newSessionURL;
  },

  ajax: function(type, path) {
    return Ember.$.ajax(this.get('apiRoot') + path, {
      type: type,
      headers: { 'X-OAuth-Token': this.get('token') }
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
  profileImageUrl: '',
  author: '', // screen_name of the original tweeter
  urls: [],
  media: [],
  retweetedBy: null // name of the retweeter if it's a retweet
});

App.TwitterUser = Ember.Object.extend({
});

App.Tweets = Ember.ArrayProxy.extend(Ember.SortableMixin, {
  sortProperties: ['created_at'],
  sortAscending: false,
});

App.Router.map(function() {
  this.route('token', { path: '/token/:token' });
  this.resource('user', function() {
    this.route('home');
    this.route('timeline', { path: '/timelines/:screen_name' });
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
  model: function() {
    return this.adapter.ajax('GET', '/user.json');
  }
});

App.UserHomeRoute = App.AuthenticatedRoute.extend({
  setupController: function(controller, model) {
    var tweetsPromise = this.adapter.ajax('GET', '/twitter/timelines/home.json');
    tweetsPromise.then(function(tweets) {
      var tweetObjects = tweets.map(function(tweet) {
        // console.log(tweet.text.length);
        var isRetweet = tweet.retweeted_status;
        var originalTweet = isRetweet ? tweet.retweeted_status : tweet;
        /*
        if (tweet.retweeted_status) {
          console.log("RT");
          console.log(tweet.retweeted_status.text);
        }
        */
        return App.Tweet.create({
          text: originalTweet.text,
          profileImageUrl: originalTweet.user.profile_image_url,
          author: originalTweet.user.screen_name,
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
    return this.adapter.ajax('GET', '/twitter/users/' + params.screen_name + '.json');
  },
  setupController: function(controller, model) {
    var tweetsPromise = this.adapter.ajax('GET', '/twitter/timelines/' + model.screen_name + '.json');
    tweetsPromise.then(function(tweets) {
      controller.set('tweets', tweets);
    });
  }
});

App.UserController = Ember.ObjectController.extend();
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

