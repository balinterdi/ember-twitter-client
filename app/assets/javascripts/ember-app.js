window.App = Ember.Application.create();

var apiRoot = 'http://localhost:3000';
var newSessionURL = apiRoot + '/session/new';
var ajax = function(type, path, token) {
  return Ember.$.ajax(path, {
    type: type,
    headers: { 'X-OAuth-Token': token }
  })
}

var apiGet = function(path) {
  return Ember.$.getJSON(apiRoot + path);
}

App.Token = Ember.Object.extend({
  token: null
});

App.Router.map(function() {
  this.route('token', { path: '/token/:token' });
  this.resource('user', function() {
    this.route('home');
    this.route('timeline', { path: '/timelines/:screen_name' });
  })
});

App.IndexRoute = Ember.Route.extend({
  beforeModel: function(transition) {
    if (!window.localStorage.token) {
      window.location = newSessionURL;
    } else {
      return this.transitionTo('user.home');
    }
  }
});

App.TokenRoute = Ember.Route.extend({
  model: function(params) {
    return App.Token.create({ token: params.token });
  },
  afterModel: function(model, transition) {
    window.localStorage.token = model.get('token');
    this.transitionTo('index');
  }
});

App.UserRoute = Ember.Route.extend({
  model: function() {
    return ajax('GET', '/user.json', window.localStorage.token);
  }
});

App.UserHomeRoute = Ember.Route.extend({
  model: function() {
    return this.controllerFor('user').get('model');
  },
  setupController: function(controller, model) {
    var tweetsPromise = ajax('GET', '/timelines/home.json', window.localStorage.token);
    tweetsPromise.then(function(tweets) {
      controller.set('tweets', tweets);
    });
  }
});

App.UserTimelineRoute = Ember.Route.extend({
  model: function(params) {
    return ajax('GET', '/user_info/' + params.screen_name + '.json', window.localStorage.token);
  },
  setupController: function(controller, model) {
    var tweetsPromise = ajax('GET', '/timelines/' + model.screen_name + '.json', window.localStorage.token);
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
    return this.get('user.profile_image_url').replace('normal', 'bigger');
  }.property('user.profile_image_url')
});

Ember.Handlebars.helper('html', function(tweet, options) {
  var replaceUrls = function(text, urlData) {
    var start = urlData.indices[0];
    var end   = urlData.indices[1];
    return text.slice(0, start) + '<a href="' + urlData.expanded_url + '">' + urlData.display_url + '</a>' + text.slice(end);
  }

  // Essentially there is no way to extract urls from RTs from the data Twitter provides
  // so we might as well go simply matching urls in the text
  var text = tweet.get('text').replace(/\n/g, '<br />');
  var urlEntities = tweet.get('entities.urls');

  var withUrls = text;
  urlEntities.forEach(function(urlData) {
    //FIXME: This breaks when there are multiple urls
    withUrls = replaceUrls(text, urlData);
  });

  var mediaEntities = tweet.get('entities.media') || [];
  mediaEntities.forEach(function(urlData) {
    withUrls = replaceUrls(withUrls, urlData);
  });

  return new Handlebars.SafeString(withUrls);
});

